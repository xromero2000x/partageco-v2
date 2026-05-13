import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { createNotification } from "@/lib/notifications.server";

// ---------- Helpers ----------
type Actor = {
  user: { id: string; account_status: string; email_verified_at: string | null; deleted_at: string | null };
  isActive: boolean;
  isVerified: boolean;
  isSuper: boolean;
  isModerator: boolean;
  isSupport: boolean;
};

async function loadActor(userId: string): Promise<Actor> {
  const { data: u } = await supabaseAdmin
    .from("users")
    .select("id,account_status,email_verified_at,deleted_at")
    .eq("id", userId)
    .maybeSingle();
  if (!u || u.deleted_at) throw new Error("forbidden");
  const { data: admins } = await supabaseAdmin
    .from("admin_users")
    .select("admin_role")
    .eq("user_id", userId);
  const roles = (admins ?? []).map((a) => a.admin_role as string);
  return {
    user: u,
    isActive: u.account_status === "active",
    isVerified: !!u.email_verified_at,
    isSuper: roles.includes("super_admin"),
    isModerator: roles.includes("moderation_admin"),
    isSupport: roles.includes("support_admin"),
  };
}

function requireActiveVerified(a: Actor) {
  if (a.user.account_status === "suspended") throw new Error("account_suspended");
  if (a.user.account_status === "deletion_requested") throw new Error("account_deletion_requested");
  if (!a.isActive) throw new Error("action_not_authorized");
  if (!a.isVerified) throw new Error("email_not_verified");
}

const ALLOWED_PARTICIPATION_AUDIT = new Set([
  "participation_created",
  "participation_accepted",
  "participation_rejected",
  "participation_cancelled",
  "payment_record_created",
  "payment_record_cancelled",
]);

function diff<T extends Record<string, unknown>>(before: T, after: T) {
  const changed: string[] = [];
  const keys = new Set([...Object.keys(before), ...Object.keys(after)]);
  for (const k of keys) {
    if (JSON.stringify(before[k]) !== JSON.stringify(after[k])) changed.push(k);
  }
  return changed;
}

async function writeAudit(p: {
  actorUserId: string | null;
  actorType: "user" | "admin" | "system";
  actionType: string;
  entityType: string;
  entityId: string;
  before: Record<string, unknown> | null;
  after: Record<string, unknown> | null;
}) {
  if (!ALLOWED_PARTICIPATION_AUDIT.has(p.actionType)) {
    throw new Error(`audit_action_not_allowed:${p.actionType}`);
  }
  const before = p.before ?? {};
  const after = p.after ?? {};
  const envelope = {
    entity_type: p.entityType,
    entity_id: p.entityId,
    changed_fields: diff(before, after),
    before,
    after,
  };
  await supabaseAdmin.from("audit_logs").insert({
    actor_user_id: p.actorUserId,
    actor_type: p.actorType,
    action_type: p.actionType,
    entity_type: p.entityType,
    entity_id: p.entityId,
    previous_value: envelope as unknown as never,
    new_value: envelope as unknown as never,
  });
}

async function notifyUser(p: {
  recipientUserId: string;
  notificationType: "participation_request" | "participation_status_changed";
  title: string;
  body: string;
  relatedEntityId: string;
}) {
  await createNotification({
    recipient_user_id: p.recipientUserId,
    notification_type: p.notificationType,
    title: p.title,
    body: p.body,
    related_entity_type: "co_subscription",
    related_entity_id: p.relatedEntityId,
  });
}

async function recalcSlots(offerId: string) {
  await supabaseAdmin.rpc("recalc_offer_available_slots", { p_offer_id: offerId });
}

// ---------- Action availability (offer detail) ----------
export const getOfferActionAvailability = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { offerId: string }) => z.object({ offerId: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    const { userId } = context;
    const actor = await loadActor(userId);

    const { data: o } = await supabaseAdmin
      .from("subscription_offers")
      .select("id,owner_user_id,offer_status,visibility,available_slots")
      .eq("id", data.offerId)
      .maybeSingle();
    if (!o) return { allowed: false, reason: "offer_unavailable" };

    if (actor.user.account_status === "suspended")
      return { allowed: false, reason: "account_suspended" };
    if (actor.user.account_status === "deletion_requested")
      return { allowed: false, reason: "account_deletion_requested" };
    if (!actor.isVerified) return { allowed: false, reason: "email_not_verified" };
    if (!actor.isActive) return { allowed: false, reason: "action_not_authorized" };
    if (o.offer_status !== "active" || o.visibility !== "public")
      return { allowed: false, reason: "offer_not_public" };
    if (o.available_slots <= 0) return { allowed: false, reason: "no_slots_available" };
    if (o.owner_user_id === userId) return { allowed: false, reason: "self_participation_forbidden" };

    const { data: existing } = await supabaseAdmin
      .from("co_subscriptions")
      .select("id,participation_status")
      .eq("offer_id", o.id)
      .eq("subscriber_user_id", userId)
      .in("participation_status", ["requested", "accepted_pending_payment", "active"]);
    if (existing && existing.length > 0)
      return { allowed: false, reason: "participation_already_exists" };

    return { allowed: true as const, reason: null };
  });

// ---------- Request participation ----------
export const requestParticipation = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { offerId: string }) => z.object({ offerId: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    const { userId } = context;
    const actor = await loadActor(userId);
    requireActiveVerified(actor);

    const { data: o } = await supabaseAdmin
      .from("subscription_offers")
      .select("id,owner_user_id,offer_status,visibility,available_slots,title")
      .eq("id", data.offerId)
      .maybeSingle();
    if (!o) throw new Error("offer_unavailable");
    if (o.offer_status !== "active") throw new Error("offer_unavailable");
    if (o.visibility !== "public") throw new Error("offer_not_public");
    if (o.available_slots <= 0) throw new Error("no_slots_available");
    if (o.owner_user_id === userId) throw new Error("self_participation_forbidden");

    const { data: existing } = await supabaseAdmin
      .from("co_subscriptions")
      .select("id")
      .eq("offer_id", o.id)
      .eq("subscriber_user_id", userId)
      .in("participation_status", ["requested", "accepted_pending_payment", "active"]);
    if (existing && existing.length > 0) throw new Error("participation_already_exists");

    const insertPayload = {
      offer_id: o.id,
      subscriber_user_id: userId,
      owner_user_id: o.owner_user_id,
      participation_status: "requested" as const,
    };
    const { data: created, error } = await supabaseAdmin
      .from("co_subscriptions")
      .insert(insertPayload)
      .select("id,requested_at")
      .single();
    if (error || !created) throw new Error("generic_error");

    await writeAudit({
      actorUserId: userId,
      actorType: "user",
      actionType: "participation_created",
      entityType: "co_subscriptions",
      entityId: created.id,
      before: null,
      after: { ...insertPayload, requested_at: created.requested_at },
    });
    await notifyUser({
      recipientUserId: o.owner_user_id,
      notificationType: "participation_request",
      title: "Nouvelle demande de participation",
      body: `Une demande a été déposée sur votre offre « ${o.title} ».`,
      relatedEntityId: created.id,
    });

    return { id: created.id };
  });

// ---------- Accept (owner) ----------
export const acceptParticipation = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { coSubId: string }) => z.object({ coSubId: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    const { userId } = context;
    const actor = await loadActor(userId);
    requireActiveVerified(actor);

    // Pre-check ownership and load context for auditing/notifications
    const { data: cs } = await supabaseAdmin
      .from("co_subscriptions")
      .select("id,offer_id,owner_user_id,subscriber_user_id,participation_status,accepted_at")
      .eq("id", data.coSubId)
      .maybeSingle();
    if (!cs) throw new Error("not_found");
    if (cs.owner_user_id !== userId) throw new Error("forbidden");
    if (cs.participation_status !== "requested") throw new Error("transition_forbidden");

    const { data: rpc, error: rpcErr } = await supabaseAdmin.rpc("accept_participation", {
      p_co_sub_id: data.coSubId,
      p_owner_user_id: userId,
    });
    if (rpcErr) {
      const msg = rpcErr.message || "generic_error";
      // Postgres RAISE messages are surfaced; map known ones, otherwise pass through.
      const known = [
        "no_slots_available",
        "offer_unavailable",
        "transition_forbidden",
        "forbidden",
        "not_found",
      ];
      const found = known.find((k) => msg.includes(k));
      throw new Error(found ?? "generic_error");
    }
    const result = (rpc as {
      payment_id: string;
      available_slots: number;
      gross_amount: number;
    }) ?? null;
    if (!result) throw new Error("generic_error");

    const acceptedAt = new Date().toISOString();
    await writeAudit({
      actorUserId: userId,
      actorType: "user",
      actionType: "participation_accepted",
      entityType: "co_subscriptions",
      entityId: cs.id,
      before: { participation_status: "requested" },
      after: { participation_status: "accepted_pending_payment", accepted_at: acceptedAt },
    });
    await writeAudit({
      actorUserId: userId,
      actorType: "user",
      actionType: "payment_record_created",
      entityType: "payment_records",
      entityId: result.payment_id,
      before: null,
      after: {
        co_subscription_id: cs.id,
        payer_user_id: cs.subscriber_user_id,
        payee_user_id: cs.owner_user_id,
        gross_amount: result.gross_amount,
        currency: "EUR",
        payment_status: "pending",
      },
    });
    await notifyUser({
      recipientUserId: cs.subscriber_user_id,
      notificationType: "participation_status_changed",
      title: "Demande acceptée",
      body: "Votre demande de participation a été acceptée.",
      relatedEntityId: cs.id,
    });

    return { ok: true, paymentId: result.payment_id, availableSlots: result.available_slots };
  });

// ---------- Reject (owner) ----------
export const rejectParticipation = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { coSubId: string }) => z.object({ coSubId: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    const { userId } = context;
    const actor = await loadActor(userId);
    requireActiveVerified(actor);

    const { data: cs } = await supabaseAdmin
      .from("co_subscriptions")
      .select("id,offer_id,owner_user_id,subscriber_user_id,participation_status")
      .eq("id", data.coSubId)
      .maybeSingle();
    if (!cs) throw new Error("not_found");
    if (cs.owner_user_id !== userId) throw new Error("forbidden");
    if (cs.participation_status !== "requested") throw new Error("transition_forbidden");

    const { error } = await supabaseAdmin
      .from("co_subscriptions")
      .update({ participation_status: "rejected", updated_at: new Date().toISOString() })
      .eq("id", cs.id);
    if (error) throw new Error("generic_error");

    await recalcSlots(cs.offer_id);
    await writeAudit({
      actorUserId: userId,
      actorType: "user",
      actionType: "participation_rejected",
      entityType: "co_subscriptions",
      entityId: cs.id,
      before: { participation_status: "requested" },
      after: { participation_status: "rejected" },
    });
    await notifyUser({
      recipientUserId: cs.subscriber_user_id,
      notificationType: "participation_status_changed",
      title: "Demande refusée",
      body: "Votre demande de participation n'a pas été retenue.",
      relatedEntityId: cs.id,
    });
    return { ok: true };
  });

// ---------- Cancel (subscriber, owner-active, super_admin) ----------
export const cancelParticipation = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { coSubId: string }) => z.object({ coSubId: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    const { userId } = context;
    const actor = await loadActor(userId);

    const { data: cs } = await supabaseAdmin
      .from("co_subscriptions")
      .select(
        "id,offer_id,owner_user_id,subscriber_user_id,participation_status,accepted_at,cancelled_at,ended_at"
      )
      .eq("id", data.coSubId)
      .maybeSingle();
    if (!cs) throw new Error("not_found");

    const isSubscriber = cs.subscriber_user_id === userId;
    const isOwner = cs.owner_user_id === userId;
    const status = cs.participation_status;

    let allowed = false;
    if (status === "requested" || status === "accepted_pending_payment") {
      allowed = isSubscriber;
    } else if (status === "active") {
      allowed = isSubscriber || isOwner || actor.isSuper;
    }
    if (!allowed) {
      if (status === "active" || status === "requested" || status === "accepted_pending_payment") {
        throw new Error("forbidden");
      }
      throw new Error("transition_forbidden");
    }
    // Subscriber & owner must be active+verified; super_admin bypass not required since action is not their own.
    if (isSubscriber || isOwner) requireActiveVerified(actor);

    const nowIso = new Date().toISOString();
    const updatePayload: Record<string, unknown> = {
      participation_status: "cancelled",
      cancelled_at: nowIso,
      updated_at: nowIso,
    };
    if (status === "active") updatePayload.ended_at = nowIso;

    const { error } = await supabaseAdmin
      .from("co_subscriptions")
      .update(updatePayload as never)
      .eq("id", cs.id);
    if (error) throw new Error("generic_error");

    // Cancel any pending payment record
    const { data: pending } = await supabaseAdmin
      .from("payment_records")
      .select("id")
      .eq("co_subscription_id", cs.id)
      .eq("payment_status", "pending");
    if (pending && pending.length > 0) {
      const ids = pending.map((p) => p.id);
      await supabaseAdmin
        .from("payment_records")
        .update({ payment_status: "cancelled", updated_at: nowIso })
        .in("id", ids);
      for (const pid of ids) {
        await writeAudit({
          actorUserId: userId,
          actorType: actor.isSuper && !isOwner && !isSubscriber ? "admin" : "user",
          actionType: "payment_record_cancelled",
          entityType: "payment_records",
          entityId: pid,
          before: { payment_status: "pending" },
          after: { payment_status: "cancelled" },
        });
      }
    }

    await recalcSlots(cs.offer_id);
    await writeAudit({
      actorUserId: userId,
      actorType: actor.isSuper && !isOwner && !isSubscriber ? "admin" : "user",
      actionType: "participation_cancelled",
      entityType: "co_subscriptions",
      entityId: cs.id,
      before: { participation_status: status },
      after: updatePayload,
    });

    const otherParty = isSubscriber ? cs.owner_user_id : cs.subscriber_user_id;
    await notifyUser({
      recipientUserId: otherParty,
      notificationType: "participation_status_changed",
      title: "Participation annulée",
      body: "Une participation associée à une offre a été annulée.",
      relatedEntityId: cs.id,
    });
    if (actor.isSuper && !isSubscriber && !isOwner) {
      await notifyUser({
        recipientUserId: cs.subscriber_user_id,
        notificationType: "participation_status_changed",
        title: "Participation annulée",
        body: "Une participation a été annulée.",
        relatedEntityId: cs.id,
      });
    }

    return { ok: true };
  });

// ---------- Reads ----------
export const listMyParticipations = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { userId } = context;
    const { data: subs } = await supabaseAdmin
      .from("co_subscriptions")
      .select(
        `id,participation_status,requested_at,accepted_at,cancelled_at,ended_at,offer_id,
         offer:subscription_offers!co_subscriptions_offer_id_fkey(
           id,title,currency,monthly_price_amount,
           service:subscription_services!subscription_offers_service_id_fkey(slug,name),
           plan:subscription_service_plans!subscription_offers_service_plan_id_fkey(slug,name,is_active)
         )`
      )
      .eq("subscriber_user_id", userId)
      .order("requested_at", { ascending: false });
    const list = subs ?? [];
    if (list.length === 0) return { items: [] };

    const ids = list.map((s) => s.id);
    const { data: payments } = await supabaseAdmin
      .from("payment_records")
      .select("co_subscription_id,payment_status,gross_amount,currency")
      .in("co_subscription_id", ids);
    const byCs = new Map<string, { payment_status: string; gross_amount: number; currency: string }>();
    for (const p of payments ?? []) {
      byCs.set(p.co_subscription_id, {
        payment_status: p.payment_status as string,
        gross_amount: Number(p.gross_amount),
        currency: p.currency as string,
      });
    }
    return {
      items: list.map((s) => {
        const offer = s.offer as
          | {
              id: string;
              title: string;
              currency: string;
              monthly_price_amount: number;
              service?: { slug?: string; name?: string } | null;
              plan?: { slug?: string; name?: string; is_active?: boolean } | null;
            }
          | null;
        const planActive = offer?.plan?.is_active ?? false;
        return {
          id: s.id,
          participation_status: s.participation_status,
          requested_at: s.requested_at,
          accepted_at: s.accepted_at,
          cancelled_at: s.cancelled_at,
          ended_at: s.ended_at,
          offer: offer
            ? {
                id: offer.id,
                title: offer.title,
                currency: offer.currency,
                monthly_price_amount: offer.monthly_price_amount,
                service_slug: offer.service?.slug ?? null,
                service_name: offer.service?.name ?? null,
                plan_slug: planActive ? offer.plan?.slug ?? null : null,
                plan_name: planActive ? offer.plan?.name ?? null : null,
              }
            : null,
          payment: byCs.get(s.id) ?? null,
        };
      }),
    };
  });

export const getMyParticipation = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { coSubId: string }) => z.object({ coSubId: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    const { userId } = context;
    const { data: cs } = await supabaseAdmin
      .from("co_subscriptions")
      .select(
        `id,participation_status,requested_at,accepted_at,cancelled_at,ended_at,
         offer_id,owner_user_id,subscriber_user_id,
         offer:subscription_offers!co_subscriptions_offer_id_fkey(
           id,title,description,currency,monthly_price_amount,total_slots,available_slots,
           service:subscription_services!subscription_offers_service_id_fkey(slug,name),
           plan:subscription_service_plans!subscription_offers_service_plan_id_fkey(slug,name,is_active)
         )`
      )
      .eq("id", data.coSubId)
      .maybeSingle();
    if (!cs) throw new Error("not_found");
    if (cs.subscriber_user_id !== userId && cs.owner_user_id !== userId) {
      const actor = await loadActor(userId);
      if (!actor.isSuper && !actor.isSupport && !actor.isModerator) throw new Error("forbidden");
    }
    const { data: payment } = await supabaseAdmin
      .from("payment_records")
      .select("id,gross_amount,currency,payment_status,created_at")
      .eq("co_subscription_id", cs.id)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();
    const offerRaw = (cs as { offer?: {
      id: string; title: string; description: string | null;
      currency: string; monthly_price_amount: number;
      total_slots: number; available_slots: number;
      service?: { slug?: string; name?: string } | null;
      plan?: { slug?: string; name?: string; is_active?: boolean } | null;
    } | null }).offer ?? null;
    const planActive = offerRaw?.plan?.is_active ?? false;
    const enrichedOffer = offerRaw ? {
      id: offerRaw.id,
      title: offerRaw.title,
      description: offerRaw.description,
      currency: offerRaw.currency,
      monthly_price_amount: offerRaw.monthly_price_amount,
      total_slots: offerRaw.total_slots,
      available_slots: offerRaw.available_slots,
      service_slug: offerRaw.service?.slug ?? null,
      service_name: offerRaw.service?.name ?? null,
      plan_slug: planActive ? offerRaw.plan?.slug ?? null : null,
      plan_name: planActive ? offerRaw.plan?.name ?? null : null,
    } : null;
    return {
      participation: {
        id: cs.id,
        participation_status: cs.participation_status,
        requested_at: cs.requested_at,
        accepted_at: cs.accepted_at,
        cancelled_at: cs.cancelled_at,
        ended_at: cs.ended_at,
        offer_id: cs.offer_id,
        owner_user_id: cs.owner_user_id,
        subscriber_user_id: cs.subscriber_user_id,
        offer: enrichedOffer,
      },
      payment: payment ?? null,
    };
  });

export const listOfferRequests = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { offerId: string }) => z.object({ offerId: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    const { userId } = context;
    const { data: o } = await supabaseAdmin
      .from("subscription_offers")
      .select("id,owner_user_id")
      .eq("id", data.offerId)
      .maybeSingle();
    if (!o) throw new Error("not_found");
    if (o.owner_user_id !== userId) throw new Error("forbidden");

    const { data: rows } = await supabaseAdmin
      .from("co_subscriptions")
      .select(
        "id,participation_status,requested_at,accepted_at,cancelled_at,ended_at,subscriber_user_id"
      )
      .eq("offer_id", o.id)
      .order("requested_at", { ascending: false });
    const list = rows ?? [];
    const subIds = Array.from(new Set(list.map((r) => r.subscriber_user_id)));
    const { data: profiles } = subIds.length
      ? await supabaseAdmin
          .from("user_profiles")
          .select("user_id,display_name")
          .in("user_id", subIds)
      : { data: [] };
    const byId = new Map((profiles ?? []).map((p) => [p.user_id, p.display_name]));
    return {
      requests: list.map((r) => ({
        ...r,
        subscriber_display_name: byId.get(r.subscriber_user_id) ?? null,
      })),
    };
  });

export const listAdminParticipations = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { userId } = context;
    const actor = await loadActor(userId);
    if (!actor.isSuper && !actor.isModerator && !actor.isSupport) throw new Error("forbidden");

    const { data } = await supabaseAdmin
      .from("co_subscriptions")
      .select(
        `id,participation_status,requested_at,accepted_at,activated_at,cancelled_at,ended_at,
         owner_user_id,subscriber_user_id,
         offer:subscription_offers!co_subscriptions_offer_id_fkey(id,title)`
      )
      .order("requested_at", { ascending: false })
      .limit(200);
    const list = data ?? [];
    const userIds = Array.from(
      new Set(list.flatMap((r) => [r.owner_user_id, r.subscriber_user_id]))
    );
    const { data: profiles } = userIds.length
      ? await supabaseAdmin
          .from("user_profiles")
          .select("user_id,display_name")
          .in("user_id", userIds)
      : { data: [] };
    const byId = new Map((profiles ?? []).map((p) => [p.user_id, p.display_name]));
    return {
      items: list.map((r) => ({
        ...r,
        owner_display_name: byId.get(r.owner_user_id) ?? null,
        subscriber_display_name: byId.get(r.subscriber_user_id) ?? null,
      })),
    };
  });
