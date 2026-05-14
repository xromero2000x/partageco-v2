import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { createNotification, createNotifications, type RelatedEntityType } from "@/lib/notifications.server";
import type { Database } from "@/integrations/supabase/types";

type OfferUpdate = Database["public"]["Tables"]["subscription_offers"]["Update"];

// ---------- Types ----------
export type OfferStatus =
  | "draft"
  | "pending_review"
  | "active"
  | "paused"
  | "rejected"
  | "archived";
export type OfferVisibility = "private" | "public" | "admin_only";

const ALLOWED_TRANSITIONS: Record<OfferStatus, OfferStatus[]> = {
  draft: ["pending_review", "archived"],
  pending_review: ["active", "rejected"],
  active: ["paused"],
  paused: ["pending_review", "archived"],
  rejected: ["archived"],
  archived: [],
};

// ---------- Helpers (server-only) ----------
async function loadActorContext(userId: string) {
  const { data: u } = await supabaseAdmin
    .from("users")
    .select("id,account_status,email_verified_at,deleted_at")
    .eq("id", userId)
    .maybeSingle();
  if (!u || u.deleted_at) throw new Error("forbidden");
  const { data: admin } = await supabaseAdmin
    .from("admin_users")
    .select("admin_role")
    .eq("user_id", userId);
  const roles = (admin ?? []).map((a) => a.admin_role as string);
  return {
    user: u,
    isActive: u.account_status === "active",
    isVerified: !!u.email_verified_at,
    isModerator: roles.includes("moderation_admin"),
    isSuper: roles.includes("super_admin"),
    isSupport: roles.includes("support_admin"),
    roles,
  };
}

function requireActiveVerified(actor: { isActive: boolean; isVerified: boolean }) {
  if (!actor.isActive) throw new Error("account_not_active");
  if (!actor.isVerified) throw new Error("email_not_verified");
}

function diffFields<T extends Record<string, unknown>>(before: T, after: T) {
  const changed: string[] = [];
  for (const k of Object.keys(after)) {
    if (JSON.stringify(before[k]) !== JSON.stringify(after[k])) changed.push(k);
  }
  return changed;
}

const ALLOWED_AUDIT_ACTIONS = new Set([
  "offer_created",
  "offer_submitted",
  "offer_accepted",
  "offer_rejected",
  "offer_paused",
  "offer_archived",
  "offer_plan_assigned",
  "subscription_category_updated",
  "subscription_service_updated",
  "subscription_service_created",
  "subscription_service_plan_created",
  "subscription_service_plan_updated",
  "subscription_service_plan_disabled",
  "user_created",
  "email_verified",
]);

async function writeAudit(params: {
  actorUserId: string | null;
  actorType: "user" | "admin" | "system";
  actionType: string;
  entityType: string;
  entityId: string;
  before: Record<string, unknown> | null;
  after: Record<string, unknown> | null;
}) {
  if (!ALLOWED_AUDIT_ACTIONS.has(params.actionType)) {
    throw new Error(`audit_action_not_allowed:${params.actionType}`);
  }
  const before = params.before ?? {};
  const after = params.after ?? {};
  const changedFields = diffFields(before, after);
  const envelope = {
    entity_type: params.entityType,
    entity_id: params.entityId,
    changed_fields: changedFields,
    before,
    after,
  };
  const auditRow = {
    actor_user_id: params.actorUserId,
    actor_type: params.actorType,
    action_type: params.actionType,
    entity_type: params.entityType,
    entity_id: params.entityId,
    previous_value: envelope as unknown as never,
    new_value: envelope as unknown as never,
  };
  await supabaseAdmin.from("audit_logs").insert(auditRow);
}

async function notifyAdmins(params: {
  title: string;
  body: string;
  relatedEntityType: RelatedEntityType;
  relatedEntityId: string;
}) {
  const { data: admins } = await supabaseAdmin
    .from("admin_users")
    .select("user_id,admin_role")
    .in("admin_role", ["moderation_admin", "super_admin"]);
  if (!admins || admins.length === 0) return;
  await createNotifications(
    admins.map((a) => ({
      recipient_user_id: a.user_id,
      notification_type: "admin_action" as const,
      title: params.title,
      body: params.body,
      related_entity_type: params.relatedEntityType,
      related_entity_id: params.relatedEntityId,
    })),
  );
}

async function notifyUser(params: {
  recipientUserId: string;
  title: string;
  body: string;
  relatedEntityType: RelatedEntityType;
  relatedEntityId: string;
}) {
  await createNotification({
    recipient_user_id: params.recipientUserId,
    notification_type: "admin_action",
    title: params.title,
    body: params.body,
    related_entity_type: params.relatedEntityType,
    related_entity_id: params.relatedEntityId,
  });
}

// ---------- Public reads ----------
export const listMarketplaceOffers = createServerFn({ method: "GET" }).handler(
  async () => {
    const { data, error } = await supabaseAdmin
      .from("subscription_offers")
      .select(
        `id,title,description,monthly_price_amount,currency,available_slots,total_slots,service_plan_id,created_at,owner_user_id,
         category:subscription_categories!subscription_offers_category_id_fkey(id,slug,name),
         service:subscription_services!subscription_offers_service_id_fkey(id,slug,name),
         plan:subscription_service_plans!subscription_offers_service_plan_id_fkey(id,slug,name,is_active),
         owner:users!subscription_offers_owner_user_id_fkey(id,account_status,deleted_at,created_at,email_verified_at)`
      )
      .eq("offer_status", "active")
      .eq("visibility", "public")
      .gt("available_slots", 0)
      .order("created_at", { ascending: false })
      .limit(100);
    if (error) return { offers: [] };
    const visible = (data ?? []).filter(
      (o) =>
        o.owner &&
        (o.owner as { account_status?: string }).account_status === "active" &&
        (o.owner as { deleted_at?: string | null }).deleted_at === null
    );

    // Bulk-fetch owner profiles + owner active-offer counts (trust signals).
    const ownerIds = Array.from(new Set(visible.map((o) => o.owner_user_id))) as string[];
    const profilesMap = new Map<string, string>();
    if (ownerIds.length > 0) {
      const { data: profs } = await supabaseAdmin
        .from("user_profiles")
        .select("user_id,display_name")
        .in("user_id", ownerIds);
      for (const p of profs ?? []) profilesMap.set(p.user_id as string, p.display_name as string);
    }

    return {
      offers: visible.map((o) => {
        const plan = o.plan as { id?: string; slug?: string; name?: string; is_active?: boolean } | null;
        const owner = o.owner as { id?: string; created_at?: string; email_verified_at?: string | null } | null;
        return {
          id: o.id,
          title: o.title,
          description: o.description,
          monthly_price_amount: o.monthly_price_amount,
          currency: o.currency,
          available_slots: o.available_slots,
          created_at: o.created_at,
          category_slug: (o.category as { slug?: string } | null)?.slug ?? null,
          category_name: (o.category as { name?: string } | null)?.name ?? null,
          service_slug: (o.service as { slug?: string } | null)?.slug ?? null,
          service_name: (o.service as { name?: string } | null)?.name ?? null,
          plan_id: plan?.is_active ? plan.id ?? null : null,
          plan_slug: plan?.is_active ? plan.slug ?? null : null,
          plan_name: plan?.is_active ? plan.name ?? null : null,
          owner_user_id: o.owner_user_id,
          owner_display_name: profilesMap.get(o.owner_user_id as string) ?? "Membre",
          owner_member_since: owner?.created_at ?? null,
          owner_email_verified: !!owner?.email_verified_at,
        };
      }),
    };
  }
);

export const getPublicOffer = createServerFn({ method: "GET" })
  .inputValidator((d: { offerId: string }) =>
    z.object({ offerId: z.string().uuid() }).parse(d)
  )
  .handler(async ({ data }) => {
    const { data: o } = await supabaseAdmin
      .from("subscription_offers")
      .select(
        `id,title,description,monthly_price_amount,currency,available_slots,offer_status,visibility,owner_user_id,
         category:subscription_categories!subscription_offers_category_id_fkey(name),
         service:subscription_services!subscription_offers_service_id_fkey(slug,name),
         plan:subscription_service_plans!subscription_offers_service_plan_id_fkey(slug,name,is_active),
         owner:users!subscription_offers_owner_user_id_fkey(account_status,deleted_at)`
      )
      .eq("id", data.offerId)
      .maybeSingle();
    if (!o) throw new Error("not_found");
    const owner = o.owner as { account_status?: string; deleted_at?: string | null } | null;
    const isPublic =
      o.offer_status === "active" &&
      o.visibility === "public" &&
      o.available_slots > 0 &&
      owner?.account_status === "active" &&
      owner?.deleted_at === null;
    if (!isPublic) throw new Error("not_found");
    const plan = o.plan as { slug?: string; name?: string; is_active?: boolean } | null;
    return {
      offer: {
        id: o.id,
        title: o.title,
        description: o.description,
        monthly_price_amount: o.monthly_price_amount,
        currency: o.currency,
        available_slots: o.available_slots,
        owner_user_id: o.owner_user_id,
        category_name: (o.category as { name?: string } | null)?.name ?? null,
        service_slug: (o.service as { slug?: string } | null)?.slug ?? null,
        service_name: (o.service as { name?: string } | null)?.name ?? null,
        plan_slug: plan?.is_active ? plan.slug ?? null : null,
        plan_name: plan?.is_active ? plan.name ?? null : null,
      },
    };
  });

export const listCategories = createServerFn({ method: "GET" }).handler(async () => {
  const { data } = await supabaseAdmin
    .from("subscription_categories")
    .select("id,slug,name")
    .eq("is_active", true)
    .order("name");
  return { categories: data ?? [] };
});

export const listServices = createServerFn({ method: "GET" })
  .inputValidator((d: { categoryId?: string }) =>
    z.object({ categoryId: z.string().uuid().optional() }).parse(d)
  )
  .handler(async ({ data }) => {
    let q = supabaseAdmin
      .from("subscription_services")
      .select("id,slug,name,category_id")
      .eq("is_active", true)
      .order("name");
    if (data.categoryId) q = q.eq("category_id", data.categoryId);
    const { data: rows } = await q;
    return { services: rows ?? [] };
  });

// Public read: active plans for a given service
export const listServicePlans = createServerFn({ method: "GET" })
  .inputValidator((d: { serviceId: string }) =>
    z.object({ serviceId: z.string().uuid() }).parse(d)
  )
  .handler(async ({ data }) => {
    const { data: rows } = await supabaseAdmin
      .from("subscription_service_plans")
      .select("id,slug,name,description,sort_order,is_active,service_id")
      .eq("service_id", data.serviceId)
      .eq("is_active", true)
      .order("sort_order")
      .order("name");
    return { plans: rows ?? [] };
  });

// ---------- Owner: list & get own ----------
export const listMyOffers = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { userId } = context;
    const { data } = await supabaseAdmin
      .from("subscription_offers")
      .select(
        `id,title,offer_status,visibility,available_slots,total_slots,monthly_price_amount,currency,created_at,
         category:subscription_categories!subscription_offers_category_id_fkey(name),
         service:subscription_services!subscription_offers_service_id_fkey(slug,name),
         plan:subscription_service_plans!subscription_offers_service_plan_id_fkey(slug,name,is_active)`
      )
      .eq("owner_user_id", userId)
      .order("created_at", { ascending: false });
    const rows = (data ?? []).map((o) => {
      const plan = o.plan as { slug?: string; name?: string; is_active?: boolean } | null;
      return {
        ...o,
        service_slug: (o.service as { slug?: string } | null)?.slug ?? null,
        service_name: (o.service as { name?: string } | null)?.name ?? null,
        plan_slug: plan?.is_active ? plan.slug ?? null : null,
        plan_name: plan?.is_active ? plan.name ?? null : null,
      };
    });
    return { offers: rows };
  });

export const getMyOffer = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { offerId: string }) =>
    z.object({ offerId: z.string().uuid() }).parse(d)
  )
  .handler(async ({ data, context }) => {
    const { userId } = context;
    const { data: o } = await supabaseAdmin
      .from("subscription_offers")
      .select(
        `*,
         category:subscription_categories!subscription_offers_category_id_fkey(slug,name),
         service:subscription_services!subscription_offers_service_id_fkey(slug,name),
         plan:subscription_service_plans!subscription_offers_service_plan_id_fkey(slug,name,is_active)`
      )
      .eq("id", data.offerId)
      .maybeSingle();
    if (!o) throw new Error("not_found");
    const actor = await loadActorContext(userId);
    if (o.owner_user_id !== userId && !actor.isModerator && !actor.isSuper && !actor.isSupport) {
      throw new Error("forbidden");
    }
    const plan = (o as { plan?: { slug?: string; name?: string; is_active?: boolean } | null }).plan ?? null;
    const service = (o as { service?: { slug?: string; name?: string } | null }).service ?? null;
    const category = (o as { category?: { slug?: string; name?: string } | null }).category ?? null;
    return {
      offer: {
        ...o,
        service_slug: service?.slug ?? null,
        service_name: service?.name ?? null,
        category_name: category?.name ?? null,
        plan_slug: plan?.is_active ? plan.slug ?? null : null,
        plan_name: plan?.is_active ? plan.name ?? null : null,
      },
    };
  });

// ---------- Owner: create ----------
const CreateOfferInput = z.object({
  service_id: z.string().uuid(),
  category_id: z.string().uuid(),
  service_plan_id: z.string().uuid(),
  title: z.string().min(2).max(120),
  description: z.string().max(4000).optional().nullable(),
  total_slots: z.number().int().min(1).max(50),
  monthly_price_amount: z.number().positive().max(10000),
});

async function assertActivePlanForService(planId: string, serviceId: string) {
  const { data: plan } = await supabaseAdmin
    .from("subscription_service_plans")
    .select("id,service_id,is_active")
    .eq("id", planId)
    .maybeSingle();
  if (!plan || !plan.is_active) throw new Error("service_plan_required");
  if (plan.service_id !== serviceId) throw new Error("service_plan_service_mismatch");
}

export const createOffer = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => CreateOfferInput.parse(d))
  .handler(async ({ data, context }) => {
    const { userId } = context;
    const actor = await loadActorContext(userId);
    requireActiveVerified(actor);

    const [{ data: svc }, { data: cat }] = await Promise.all([
      supabaseAdmin
        .from("subscription_services")
        .select("id,is_active,category_id")
        .eq("id", data.service_id)
        .maybeSingle(),
      supabaseAdmin
        .from("subscription_categories")
        .select("id,is_active")
        .eq("id", data.category_id)
        .maybeSingle(),
    ]);
    if (!svc || !svc.is_active) throw new Error("service_not_available");
    if (!cat || !cat.is_active) throw new Error("category_not_available");
    if (svc.category_id !== data.category_id) throw new Error("service_category_mismatch");

    await assertActivePlanForService(data.service_plan_id, data.service_id);

    const insertPayload = {
      owner_user_id: userId,
      service_id: data.service_id,
      category_id: data.category_id,
      service_plan_id: data.service_plan_id,
      title: data.title,
      description: data.description ?? null,
      total_slots: data.total_slots,
      available_slots: data.total_slots,
      monthly_price_amount: data.monthly_price_amount,
      currency: "EUR" as const,
      billing_period: "monthly" as const,
      offer_status: "draft" as const,
      visibility: "private" as const,
    };
    const { data: created, error } = await supabaseAdmin
      .from("subscription_offers")
      .insert(insertPayload)
      .select("id")
      .single();
    if (error || !created) throw new Error("create_failed");

    await writeAudit({
      actorUserId: userId,
      actorType: "user",
      actionType: "offer_created",
      entityType: "subscription_offers",
      entityId: created.id,
      before: null,
      after: insertPayload,
    });
    return { id: created.id };
  });

// ---------- Owner: update ----------
const UpdateOfferInput = z.object({
  offerId: z.string().uuid(),
  patch: z.object({
    title: z.string().min(2).max(120).optional(),
    description: z.string().max(4000).nullable().optional(),
    total_slots: z.number().int().min(1).max(50).optional(),
    monthly_price_amount: z.number().positive().max(10000).optional(),
    service_id: z.string().uuid().optional(),
    category_id: z.string().uuid().optional(),
    service_plan_id: z.string().uuid().optional(),
  }),
});

export const updateOffer = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => UpdateOfferInput.parse(d))
  .handler(async ({ data, context }) => {
    const { userId } = context;
    const actor = await loadActorContext(userId);
    requireActiveVerified(actor);

    const { data: o } = await supabaseAdmin
      .from("subscription_offers")
      .select("*")
      .eq("id", data.offerId)
      .maybeSingle();
    if (!o) throw new Error("not_found");
    if (o.owner_user_id !== userId) throw new Error("forbidden");
    if (!["draft", "rejected", "paused"].includes(o.offer_status)) {
      throw new Error("offer_not_editable");
    }

    if (data.patch.service_id || data.patch.category_id) {
      const sid = data.patch.service_id ?? o.service_id;
      const cid = data.patch.category_id ?? o.category_id;
      const [{ data: svc }, { data: cat }] = await Promise.all([
        supabaseAdmin.from("subscription_services").select("id,is_active,category_id").eq("id", sid).maybeSingle(),
        supabaseAdmin.from("subscription_categories").select("id,is_active").eq("id", cid).maybeSingle(),
      ]);
      if (!svc || !svc.is_active) throw new Error("service_not_available");
      if (!cat || !cat.is_active) throw new Error("category_not_available");
      if (svc.category_id !== cid) throw new Error("service_category_mismatch");
    }

    // Plan obligatoire pour toute offre modifiée après Phase 14D.
    const finalServiceId = data.patch.service_id ?? o.service_id;
    const finalPlanId = data.patch.service_plan_id ?? o.service_plan_id;
    if (!finalPlanId) throw new Error("service_plan_required");
    await assertActivePlanForService(finalPlanId, finalServiceId);

    const patch: Record<string, unknown> = { ...data.patch, updated_at: new Date().toISOString() };
    if (typeof data.patch.total_slots === "number") {
      patch.available_slots = data.patch.total_slots;
    }
    if (!data.patch.service_plan_id && o.service_plan_id !== finalPlanId) {
      patch.service_plan_id = finalPlanId;
    }

    const { error } = await supabaseAdmin
      .from("subscription_offers")
      .update(patch as OfferUpdate)
      .eq("id", o.id);
    if (error) throw new Error("update_failed");

    return { ok: true };
  });

// ---------- Transitions ----------
function ensureTransition(from: OfferStatus, to: OfferStatus) {
  const allowed = ALLOWED_TRANSITIONS[from] ?? [];
  if (!allowed.includes(to)) throw new Error("transition_forbidden");
}

const OfferIdInput = z.object({ offerId: z.string().uuid() });

export const submitOffer = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => OfferIdInput.parse(d))
  .handler(async ({ data, context }) => {
    const { userId } = context;
    const actor = await loadActorContext(userId);
    requireActiveVerified(actor);

    const { data: o } = await supabaseAdmin
      .from("subscription_offers")
      .select("*")
      .eq("id", data.offerId)
      .maybeSingle();
    if (!o) throw new Error("not_found");
    if (o.owner_user_id !== userId) throw new Error("forbidden");
    ensureTransition(o.offer_status as OfferStatus, "pending_review");

    if (
      !o.service_id ||
      !o.category_id ||
      !o.title ||
      o.total_slots < 1 ||
      o.available_slots == null ||
      Number(o.monthly_price_amount) <= 0 ||
      o.currency !== "EUR" ||
      o.billing_period !== "monthly"
    ) {
      throw new Error("offer_incomplete");
    }

    const before = { offer_status: o.offer_status, visibility: o.visibility };
    const after = { offer_status: "pending_review", visibility: "admin_only" };
    const { error } = await supabaseAdmin
      .from("subscription_offers")
      .update({ ...after, updated_at: new Date().toISOString() } as OfferUpdate)
      .eq("id", o.id);
    if (error) throw new Error("update_failed");

    await notifyAdmins({
      title: "Offre à modérer",
      body: `Une nouvelle offre est en attente de modération: ${o.title}`,
      relatedEntityType: "offer",
      relatedEntityId: o.id,
    });
    await writeAudit({
      actorUserId: userId,
      actorType: "user",
      actionType: "offer_submitted",
      entityType: "subscription_offers",
      entityId: o.id,
      before,
      after,
    });
    return { ok: true };
  });

export const acceptOffer = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => OfferIdInput.parse(d))
  .handler(async ({ data, context }) => {
    const { userId } = context;
    const actor = await loadActorContext(userId);
    if (!actor.isModerator && !actor.isSuper) throw new Error("forbidden");

    const { data: o } = await supabaseAdmin
      .from("subscription_offers")
      .select("*")
      .eq("id", data.offerId)
      .maybeSingle();
    if (!o) throw new Error("not_found");
    ensureTransition(o.offer_status as OfferStatus, "active");

    const before = { offer_status: o.offer_status, visibility: o.visibility };
    const after = { offer_status: "active", visibility: "public" };
    const { error } = await supabaseAdmin
      .from("subscription_offers")
      .update({ ...after, updated_at: new Date().toISOString() } as OfferUpdate)
      .eq("id", o.id);
    if (error) throw new Error("update_failed");

    await notifyUser({
      recipientUserId: o.owner_user_id,
      title: "Offre acceptée",
      body: `Votre offre « ${o.title} » a été acceptée et est désormais publique.`,
      relatedEntityType: "offer",
      relatedEntityId: o.id,
    });
    await writeAudit({
      actorUserId: userId,
      actorType: "admin",
      actionType: "offer_accepted",
      entityType: "subscription_offers",
      entityId: o.id,
      before,
      after,
    });
    return { ok: true };
  });

export const rejectOffer = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => OfferIdInput.parse(d))
  .handler(async ({ data, context }) => {
    const { userId } = context;
    const actor = await loadActorContext(userId);
    if (!actor.isModerator && !actor.isSuper) throw new Error("forbidden");

    const { data: o } = await supabaseAdmin
      .from("subscription_offers")
      .select("*")
      .eq("id", data.offerId)
      .maybeSingle();
    if (!o) throw new Error("not_found");
    ensureTransition(o.offer_status as OfferStatus, "rejected");

    const before = { offer_status: o.offer_status, visibility: o.visibility };
    const after = { offer_status: "rejected", visibility: "private" };
    const { error } = await supabaseAdmin
      .from("subscription_offers")
      .update({ ...after, updated_at: new Date().toISOString() } as OfferUpdate)
      .eq("id", o.id);
    if (error) throw new Error("update_failed");

    await notifyUser({
      recipientUserId: o.owner_user_id,
      title: "Offre rejetée",
      body: `Votre offre « ${o.title} » a été rejetée par la modération.`,
      relatedEntityType: "offer",
      relatedEntityId: o.id,
    });
    await writeAudit({
      actorUserId: userId,
      actorType: "admin",
      actionType: "offer_rejected",
      entityType: "subscription_offers",
      entityId: o.id,
      before,
      after,
    });
    return { ok: true };
  });

export const pauseOffer = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => OfferIdInput.parse(d))
  .handler(async ({ data, context }) => {
    const { userId } = context;
    const actor = await loadActorContext(userId);
    requireActiveVerified(actor);

    const { data: o } = await supabaseAdmin
      .from("subscription_offers")
      .select("*")
      .eq("id", data.offerId)
      .maybeSingle();
    if (!o) throw new Error("not_found");
    if (o.owner_user_id !== userId) throw new Error("forbidden");
    ensureTransition(o.offer_status as OfferStatus, "paused");

    const before = { offer_status: o.offer_status, visibility: o.visibility };
    const after = { offer_status: "paused", visibility: "private" };
    const { error } = await supabaseAdmin
      .from("subscription_offers")
      .update({ ...after, updated_at: new Date().toISOString() } as OfferUpdate)
      .eq("id", o.id);
    if (error) throw new Error("update_failed");

    await writeAudit({
      actorUserId: userId,
      actorType: "user",
      actionType: "offer_paused",
      entityType: "subscription_offers",
      entityId: o.id,
      before,
      after,
    });
    return { ok: true };
  });

export const archiveOffer = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => OfferIdInput.parse(d))
  .handler(async ({ data, context }) => {
    const { userId } = context;
    const actor = await loadActorContext(userId);

    const { data: o } = await supabaseAdmin
      .from("subscription_offers")
      .select("*")
      .eq("id", data.offerId)
      .maybeSingle();
    if (!o) throw new Error("not_found");

    const isOwner = o.owner_user_id === userId;
    if (!isOwner && !actor.isSuper) throw new Error("forbidden");
    if (isOwner) requireActiveVerified(actor);

    ensureTransition(o.offer_status as OfferStatus, "archived");

    const nowIso = new Date().toISOString();
    const before = {
      offer_status: o.offer_status,
      visibility: o.visibility,
      archived_at: o.archived_at,
    };
    const after = { offer_status: "archived", visibility: "private", archived_at: nowIso };
    const { error } = await supabaseAdmin
      .from("subscription_offers")
      .update({ ...after, updated_at: nowIso } as OfferUpdate)
      .eq("id", o.id);
    if (error) throw new Error("update_failed");

    await writeAudit({
      actorUserId: userId,
      actorType: isOwner ? "user" : "admin",
      actionType: "offer_archived",
      entityType: "subscription_offers",
      entityId: o.id,
      before,
      after,
    });
    return { ok: true };
  });

// ---------- Admin reads ----------
export const listAdminOffers = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { status?: OfferStatus | "all" } | undefined) =>
    z
      .object({
        status: z
          .enum(["draft", "pending_review", "active", "paused", "rejected", "archived", "all"])
          .optional(),
      })
      .parse(d ?? {})
  )
  .handler(async ({ data, context }) => {
    const { userId } = context;
    const actor = await loadActorContext(userId);
    if (!actor.isSupport && !actor.isModerator && !actor.isSuper) {
      throw new Error("forbidden");
    }
    let q = supabaseAdmin
      .from("subscription_offers")
      .select(
        `id,title,offer_status,visibility,available_slots,total_slots,monthly_price_amount,currency,created_at,owner_user_id,
         owner_profile:user_profiles!user_profiles_user_id_fkey(display_name),
         category:subscription_categories!subscription_offers_category_id_fkey(name),
         service:subscription_services!subscription_offers_service_id_fkey(name)`
      )
      .order("created_at", { ascending: false })
      .limit(200);
    if (data.status && data.status !== "all") q = q.eq("offer_status", data.status);
    const { data: rows } = await q;
    return { offers: rows ?? [], canModerate: actor.isModerator || actor.isSuper, canArchive: actor.isSuper };
  });

export const getAdminOffer = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { offerId: string }) =>
    z.object({ offerId: z.string().uuid() }).parse(d)
  )
  .handler(async ({ data, context }) => {
    const { userId } = context;
    const actor = await loadActorContext(userId);
    if (!actor.isSupport && !actor.isModerator && !actor.isSuper) {
      throw new Error("forbidden");
    }
    const { data: o } = await supabaseAdmin
      .from("subscription_offers")
      .select(
        `*,
         owner_profile:user_profiles!user_profiles_user_id_fkey(display_name),
         category:subscription_categories!subscription_offers_category_id_fkey(name,slug),
         service:subscription_services!subscription_offers_service_id_fkey(name,slug)`
      )
      .eq("id", data.offerId)
      .maybeSingle();
    if (!o) throw new Error("not_found");
    return { offer: o, canModerate: actor.isModerator || actor.isSuper, canArchive: actor.isSuper };
  });

export const getAdminContext = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const actor = await loadActorContext(context.userId);
    return {
      isSupport: actor.isSupport,
      isModerator: actor.isModerator,
      isSuper: actor.isSuper,
      isAnyAdmin: actor.isSupport || actor.isModerator || actor.isSuper,
      isActive: actor.isActive,
      isVerified: actor.isVerified,
    };
  });

// ---------- Owner: edit authorization probe ----------
export const getOfferEditAuthorization = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { offerId: string }) =>
    z.object({ offerId: z.string().uuid() }).parse(d)
  )
  .handler(async ({ data, context }) => {
    const { userId } = context;
    const { data: o } = await supabaseAdmin
      .from("subscription_offers")
      .select("id,owner_user_id,offer_status,title,description,total_slots,available_slots,monthly_price_amount,currency,billing_period,visibility,service_id,category_id,service_plan_id")
      .eq("id", data.offerId)
      .maybeSingle();
    if (!o) throw new Error("not_found");
    const actor = await loadActorContext(userId);
    const isOwner = o.owner_user_id === userId;
    if (!isOwner) throw new Error("forbidden");
    const editableStatuses = ["draft", "rejected", "paused"];
    const reasons: string[] = [];
    if (!actor.isActive) reasons.push("account_not_active");
    if (!actor.isVerified) reasons.push("email_not_verified");
    if (!editableStatuses.includes(o.offer_status)) reasons.push("offer_not_editable");
    return {
      offer: o,
      canEdit: reasons.length === 0,
      reasons,
      mustPauseFirst: o.offer_status === "active",
    };
  });

// ---------- Admin: services & categories management ----------
export const listAdminCategoriesAndServices = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const actor = await loadActorContext(context.userId);
    if (!actor.isSuper) throw new Error("forbidden");
    const [{ data: categories }, { data: services }] = await Promise.all([
      supabaseAdmin
        .from("subscription_categories")
        .select("id,slug,name,is_active")
        .order("name"),
      supabaseAdmin
        .from("subscription_services")
        .select("id,slug,name,description,category_id,is_active,created_at")
        .order("name"),
    ]);
    return { categories: categories ?? [], services: services ?? [] };
  });

const CreateServiceInput = z.object({
  category_id: z.string().uuid(),
  name: z.string().min(2).max(80),
  slug: z.string().min(2).max(80).regex(/^[a-z0-9-]+$/, "slug_invalid"),
  description: z.string().max(2000).optional().nullable(),
  is_active: z.boolean().optional(),
});

export const createInternalService = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => CreateServiceInput.parse(d))
  .handler(async ({ data, context }) => {
    const { userId } = context;
    const actor = await loadActorContext(userId);
    if (!actor.isSuper) throw new Error("forbidden");
    const { data: cat } = await supabaseAdmin
      .from("subscription_categories")
      .select("id,is_active")
      .eq("id", data.category_id)
      .maybeSingle();
    if (!cat) throw new Error("category_not_found");
    const normalizedDescription =
      data.description != null && data.description.trim() !== ""
        ? data.description.trim()
        : null;
    const insertPayload = {
      category_id: data.category_id,
      name: data.name.trim(),
      slug: data.slug.trim(),
      description: normalizedDescription,
      is_active: data.is_active ?? true,
    };
    const { data: created, error } = await supabaseAdmin
      .from("subscription_services")
      .insert(insertPayload)
      .select("id")
      .single();
    if (error || !created) throw new Error("create_failed");
    await writeAudit({
      actorUserId: userId,
      actorType: "admin",
      actionType: "subscription_service_created",
      entityType: "subscription_services",
      entityId: created.id,
      before: null,
      after: insertPayload,
    });
    return { id: created.id };
  });

const UpdateServiceInput = z.object({
  serviceId: z.string().uuid(),
  patch: z.object({
    name: z.string().min(2).max(80).optional(),
    category_id: z.string().uuid().optional(),
    description: z.string().max(2000).nullable().optional(),
    is_active: z.boolean().optional(),
  }),
});

export const updateInternalService = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => UpdateServiceInput.parse(d))
  .handler(async ({ data, context }) => {
    const { userId } = context;
    const actor = await loadActorContext(userId);
    if (!actor.isSuper) throw new Error("forbidden");
    const { data: svc } = await supabaseAdmin
      .from("subscription_services")
      .select("*")
      .eq("id", data.serviceId)
      .maybeSingle();
    if (!svc) throw new Error("not_found");
    if (data.patch.category_id) {
      const { data: cat } = await supabaseAdmin
        .from("subscription_categories")
        .select("id")
        .eq("id", data.patch.category_id)
        .maybeSingle();
      if (!cat) throw new Error("category_not_found");
    }
    const normalizedPatch: Record<string, unknown> = { ...data.patch };
    if ("description" in normalizedPatch) {
      const v = normalizedPatch.description;
      normalizedPatch.description =
        typeof v === "string" && v.trim() !== "" ? v.trim() : null;
    }
    const before: Record<string, unknown> = {};
    const after: Record<string, unknown> = {};
    for (const k of Object.keys(normalizedPatch)) {
      before[k] = (svc as Record<string, unknown>)[k];
      after[k] = normalizedPatch[k];
    }
    const { error } = await supabaseAdmin
      .from("subscription_services")
      .update({ ...normalizedPatch, updated_at: new Date().toISOString() })
      .eq("id", svc.id);
    if (error) throw new Error("update_failed");
    await writeAudit({
      actorUserId: userId,
      actorType: "admin",
      actionType: "subscription_service_updated",
      entityType: "subscription_services",
      entityId: svc.id,
      before,
      after,
    });
    return { ok: true };
  });

// ---------- Admin: service plans management (super_admin only) ----------
export const listAdminServicePlans = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const actor = await loadActorContext(context.userId);
    if (!actor.isSuper) throw new Error("forbidden");
    const { data: rows } = await supabaseAdmin
      .from("subscription_service_plans")
      .select("id,service_id,slug,name,description,sort_order,is_active,created_at,updated_at")
      .order("service_id")
      .order("sort_order");
    return { plans: rows ?? [] };
  });

const CreateServicePlanInput = z.object({
  service_id: z.string().uuid(),
  slug: z.string().min(1).max(64).regex(/^[a-z0-9_-]+$/, "slug_invalid"),
  name: z.string().min(1).max(120),
  description: z.string().max(2000).optional().nullable(),
  sort_order: z.number().int().min(0).max(999).optional(),
  is_active: z.boolean().optional(),
});

export const createServicePlan = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => CreateServicePlanInput.parse(d))
  .handler(async ({ data, context }) => {
    const actor = await loadActorContext(context.userId);
    if (!actor.isSuper) throw new Error("forbidden");
    const { data: svc } = await supabaseAdmin
      .from("subscription_services")
      .select("id,is_active")
      .eq("id", data.service_id)
      .maybeSingle();
    if (!svc) throw new Error("service_not_found");
    const description =
      data.description != null && data.description.trim() !== "" ? data.description.trim() : null;
    const insertPayload = {
      service_id: data.service_id,
      slug: data.slug.trim(),
      name: data.name.trim(),
      description,
      sort_order: data.sort_order ?? 0,
      is_active: data.is_active ?? true,
    };
    const { data: created, error } = await supabaseAdmin
      .from("subscription_service_plans")
      .insert(insertPayload)
      .select("id")
      .single();
    if (error || !created) throw new Error("create_failed");
    await writeAudit({
      actorUserId: context.userId,
      actorType: "admin",
      actionType: "subscription_service_plan_created",
      entityType: "subscription_service_plans",
      entityId: created.id,
      before: null,
      after: insertPayload,
    });
    return { id: created.id };
  });

const UpdateServicePlanInput = z.object({
  planId: z.string().uuid(),
  patch: z.object({
    name: z.string().min(1).max(120).optional(),
    description: z.string().max(2000).nullable().optional(),
    sort_order: z.number().int().min(0).max(999).optional(),
    is_active: z.boolean().optional(),
  }),
});

export const updateServicePlan = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => UpdateServicePlanInput.parse(d))
  .handler(async ({ data, context }) => {
    const actor = await loadActorContext(context.userId);
    if (!actor.isSuper) throw new Error("forbidden");
    const { data: plan } = await supabaseAdmin
      .from("subscription_service_plans")
      .select("*")
      .eq("id", data.planId)
      .maybeSingle();
    if (!plan) throw new Error("not_found");

    const normalized: Record<string, unknown> = { ...data.patch };
    if ("description" in normalized) {
      const v = normalized.description;
      normalized.description = typeof v === "string" && v.trim() !== "" ? v.trim() : null;
    }

    const wasActive = plan.is_active === true;
    const willBeActive = "is_active" in normalized ? normalized.is_active === true : wasActive;

    if (wasActive && !willBeActive) {
      // empêche la désactivation si des offres non archivées la référencent
      const { count } = await supabaseAdmin
        .from("subscription_offers")
        .select("id", { count: "exact", head: true })
        .eq("service_plan_id", plan.id)
        .neq("offer_status", "archived");
      if ((count ?? 0) > 0) {
        throw new Error("plan_in_use");
      }
    }

    const before: Record<string, unknown> = {};
    const after: Record<string, unknown> = {};
    for (const k of Object.keys(normalized)) {
      before[k] = (plan as Record<string, unknown>)[k];
      after[k] = normalized[k];
    }

    const { error } = await supabaseAdmin
      .from("subscription_service_plans")
      .update({ ...normalized, updated_at: new Date().toISOString() })
      .eq("id", plan.id);
    if (error) throw new Error("update_failed");

    const isDisable = wasActive && !willBeActive;
    await writeAudit({
      actorUserId: context.userId,
      actorType: "admin",
      actionType: isDisable ? "subscription_service_plan_disabled" : "subscription_service_plan_updated",
      entityType: "subscription_service_plans",
      entityId: plan.id,
      before,
      after,
    });
    return { ok: true };
  });
