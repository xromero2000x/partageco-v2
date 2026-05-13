import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { createNotifications } from "@/lib/notifications.server";

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

const ALLOWED_AUDIT = new Set([
  "dispute_created",
  "dispute_status_changed",
  "admin_conversation_viewed",
]);

async function audit(input: {
  actor_user_id: string;
  actor_type: "user" | "admin" | "system";
  action_type: string;
  entity_type: string;
  entity_id: string;
  changed_fields?: string[];
  before?: Record<string, unknown>;
  after?: Record<string, unknown>;
}) {
  if (!ALLOWED_AUDIT.has(input.action_type)) return;
  await supabaseAdmin.from("audit_logs").insert({
    actor_user_id: input.actor_user_id,
    actor_type: input.actor_type,
    action_type: input.action_type,
    entity_type: input.entity_type,
    entity_id: input.entity_id,
    previous_value: input.before
      ? ({ changed_fields: input.changed_fields ?? [], before: input.before } as never)
      : null,
    new_value: input.after
      ? ({ changed_fields: input.changed_fields ?? [], after: input.after } as never)
      : null,
  });
}

async function notifyDisputeUpdated(opts: {
  dispute_id: string;
  recipient_user_ids: string[];
  title: string;
  body: string;
}) {
  const uniq = Array.from(new Set(opts.recipient_user_ids));
  if (!uniq.length) return;
  await createNotifications(
    uniq.map((uid) => ({
      recipient_user_id: uid,
      notification_type: "dispute_updated" as const,
      title: opts.title,
      body: opts.body,
      related_entity_type: "dispute" as const,
      related_entity_id: opts.dispute_id,
    })),
  );
}

async function listAdminUserIds(roles: ("support_admin" | "super_admin")[]) {
  const { data } = await supabaseAdmin
    .from("admin_users")
    .select("user_id,admin_role")
    .in("admin_role", roles);
  return Array.from(new Set((data ?? []).map((a) => a.user_id)));
}

const DISPUTE_REASONS = [
  "access_issue",
  "payment_issue",
  "communication_issue",
  "offer_mismatch",
  "other",
] as const;

const ELIGIBLE_PARTICIPATION_STATUSES = [
  "accepted_pending_payment",
  "active",
  "cancelled",
] as const;

// ---------- Eligible participations for opening a dispute ----------
export const listEligibleParticipations = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const userId = context.userId;
    const { data: cs } = await supabaseAdmin
      .from("co_subscriptions")
      .select("id,offer_id,owner_user_id,subscriber_user_id,participation_status,created_at")
      .or(`owner_user_id.eq.${userId},subscriber_user_id.eq.${userId}`)
      .in("participation_status", ELIGIBLE_PARTICIPATION_STATUSES)
      .order("created_at", { ascending: false });

    const offerIds = Array.from(new Set((cs ?? []).map((c) => c.offer_id)));
    const { data: offers } = offerIds.length
      ? await supabaseAdmin.from("subscription_offers").select("id,title").in("id", offerIds)
      : { data: [] as Array<{ id: string; title: string }> };
    const offerMap = new Map((offers ?? []).map((o) => [o.id, o.title]));

    return {
      participations: (cs ?? []).map((c) => ({
        id: c.id,
        offer_id: c.offer_id,
        offer_title: offerMap.get(c.offer_id) ?? "Offre",
        participation_status: c.participation_status,
        role: c.owner_user_id === userId ? "owner" : "subscriber",
      })),
    };
  });

// ---------- List my disputes ----------
export const listMyDisputes = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const userId = context.userId;
    const { data: cs } = await supabaseAdmin
      .from("co_subscriptions")
      .select("id,offer_id,owner_user_id,subscriber_user_id")
      .or(`owner_user_id.eq.${userId},subscriber_user_id.eq.${userId}`);
    const csIds = (cs ?? []).map((c) => c.id);
    if (!csIds.length) return { disputes: [] };
    const { data: disputes } = await supabaseAdmin
      .from("disputes")
      .select("id,co_subscription_id,dispute_reason,dispute_status,created_at,closed_at")
      .in("co_subscription_id", csIds)
      .order("created_at", { ascending: false });
    const offerIds = Array.from(new Set((cs ?? []).map((c) => c.offer_id)));
    const { data: offers } = offerIds.length
      ? await supabaseAdmin.from("subscription_offers").select("id,title").in("id", offerIds)
      : { data: [] as Array<{ id: string; title: string }> };
    const csMap = new Map((cs ?? []).map((c) => [c.id, c]));
    const offerMap = new Map((offers ?? []).map((o) => [o.id, o.title]));
    return {
      disputes: (disputes ?? []).map((d) => {
        const c = csMap.get(d.co_subscription_id);
        return {
          id: d.id,
          co_subscription_id: d.co_subscription_id,
          offer_title: c ? offerMap.get(c.offer_id) ?? "Offre" : "Offre",
          dispute_reason: d.dispute_reason,
          dispute_status: d.dispute_status,
          created_at: d.created_at,
          closed_at: d.closed_at,
        };
      }),
    };
  });

// ---------- Create dispute ----------
export const createDispute = createServerFn({ method: "POST" })
  .inputValidator((d) =>
    z
      .object({
        co_subscription_id: z.string().uuid(),
        dispute_reason: z.enum(DISPUTE_REASONS),
        description: z.string().trim().max(4000).optional().nullable(),
      })
      .parse(d),
  )
  .middleware([requireSupabaseAuth])
  .handler(async ({ data, context }) => {
    const actor = await loadActor(context.userId);
    requireActiveVerified(actor);

    const { data: cs } = await supabaseAdmin
      .from("co_subscriptions")
      .select("id,owner_user_id,subscriber_user_id,participation_status")
      .eq("id", data.co_subscription_id)
      .maybeSingle();
    if (!cs) throw new Error("not_found");
    if (cs.owner_user_id !== actor.user.id && cs.subscriber_user_id !== actor.user.id) {
      throw new Error("forbidden");
    }
    if (!(ELIGIBLE_PARTICIPATION_STATUSES as readonly string[]).includes(cs.participation_status)) {
      throw new Error("participation_not_eligible");
    }

    const { data: dispute, error: dErr } = await supabaseAdmin
      .from("disputes")
      .insert({
        co_subscription_id: cs.id,
        opened_by_user_id: actor.user.id,
        assigned_admin_user_id: null,
        dispute_reason: data.dispute_reason,
        description: data.description ?? null,
        dispute_status: "open",
      })
      .select("id,dispute_status,dispute_reason,created_at")
      .single();
    if (dErr || !dispute) throw new Error("dispute_create_failed");

    // Ensure conversation dispute_context (no duplicate)
    const { data: existingConv } = await supabaseAdmin
      .from("conversations")
      .select("id")
      .eq("conversation_type", "dispute_context")
      .eq("co_subscription_id", cs.id)
      .maybeSingle();
    let conversationId = existingConv?.id ?? null;
    if (!conversationId) {
      const { data: conv, error: cErr } = await supabaseAdmin
        .from("conversations")
        .insert({
          conversation_type: "dispute_context",
          co_subscription_id: cs.id,
          offer_id: null,
        })
        .select("id")
        .single();
      if (cErr || !conv) throw new Error("conversation_create_failed");
      conversationId = conv.id;
      await supabaseAdmin.from("conversation_participants").insert([
        { conversation_id: conversationId, user_id: cs.owner_user_id, participant_role: "owner" },
        {
          conversation_id: conversationId,
          user_id: cs.subscriber_user_id,
          participant_role: "subscriber",
        },
      ]);
    }

    // Notifications: parties + support_admin + super_admin
    const adminIds = await listAdminUserIds(["support_admin", "super_admin"]);
    await notifyDisputeUpdated({
      dispute_id: dispute.id,
      recipient_user_ids: [cs.owner_user_id, cs.subscriber_user_id, ...adminIds],
      title: "Litige ouvert",
      body: "Un litige a été ouvert sur une participation.",
    });

    await audit({
      actor_user_id: actor.user.id,
      actor_type: "user",
      action_type: "dispute_created",
      entity_type: "disputes",
      entity_id: dispute.id,
      changed_fields: ["dispute_status", "dispute_reason"],
      before: {},
      after: {
        dispute_status: "open",
        dispute_reason: data.dispute_reason,
        co_subscription_id: cs.id,
      },
    });

    return { id: dispute.id };
  });

// ---------- Get my dispute ----------
export const getMyDispute = createServerFn({ method: "GET" })
  .inputValidator((d) => z.object({ dispute_id: z.string().uuid() }).parse(d))
  .middleware([requireSupabaseAuth])
  .handler(async ({ data, context }) => {
    const userId = context.userId;
    const { data: dispute } = await supabaseAdmin
      .from("disputes")
      .select(
        "id,co_subscription_id,opened_by_user_id,assigned_admin_user_id,dispute_reason,description,dispute_status,created_at,updated_at,closed_at",
      )
      .eq("id", data.dispute_id)
      .maybeSingle();
    if (!dispute) throw new Error("not_found");
    const { data: cs } = await supabaseAdmin
      .from("co_subscriptions")
      .select("id,offer_id,owner_user_id,subscriber_user_id,participation_status")
      .eq("id", dispute.co_subscription_id)
      .maybeSingle();
    if (!cs) throw new Error("not_found");
    if (cs.owner_user_id !== userId && cs.subscriber_user_id !== userId) {
      throw new Error("forbidden");
    }
    const { data: offer } = await supabaseAdmin
      .from("subscription_offers")
      .select("id,title")
      .eq("id", cs.offer_id)
      .maybeSingle();
    const { data: conv } = await supabaseAdmin
      .from("conversations")
      .select("id")
      .eq("conversation_type", "dispute_context")
      .eq("co_subscription_id", cs.id)
      .maybeSingle();
    return {
      dispute,
      offer_title: offer?.title ?? "Offre",
      conversation_id: conv?.id ?? null,
    };
  });

// ---------- Admin: list disputes ----------
export const listAdminDisputes = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const actor = await loadActor(context.userId);
    if (!actor.isSuper && !actor.isSupport && !actor.isModerator) throw new Error("forbidden");
    const { data: disputes } = await supabaseAdmin
      .from("disputes")
      .select(
        "id,co_subscription_id,assigned_admin_user_id,dispute_reason,dispute_status,created_at,closed_at,opened_by_user_id",
      )
      .order("created_at", { ascending: false })
      .limit(200);
    return { disputes: disputes ?? [], can_act: actor.isSuper || actor.isSupport };
  });

// ---------- Admin: get dispute detail ----------
export const getAdminDispute = createServerFn({ method: "GET" })
  .inputValidator((d) => z.object({ dispute_id: z.string().uuid() }).parse(d))
  .middleware([requireSupabaseAuth])
  .handler(async ({ data, context }) => {
    const actor = await loadActor(context.userId);
    if (!actor.isSuper && !actor.isSupport && !actor.isModerator) throw new Error("forbidden");
    const { data: dispute } = await supabaseAdmin
      .from("disputes")
      .select(
        "id,co_subscription_id,opened_by_user_id,assigned_admin_user_id,dispute_reason,description,dispute_status,created_at,updated_at,closed_at",
      )
      .eq("id", data.dispute_id)
      .maybeSingle();
    if (!dispute) throw new Error("not_found");
    const { data: cs } = await supabaseAdmin
      .from("co_subscriptions")
      .select("id,offer_id,owner_user_id,subscriber_user_id,participation_status")
      .eq("id", dispute.co_subscription_id)
      .maybeSingle();
    const { data: offer } = cs
      ? await supabaseAdmin
          .from("subscription_offers")
          .select("id,title")
          .eq("id", cs.offer_id)
          .maybeSingle()
      : { data: null };
    const { data: conv } = await supabaseAdmin
      .from("conversations")
      .select("id")
      .eq("conversation_type", "dispute_context")
      .eq("co_subscription_id", dispute.co_subscription_id)
      .maybeSingle();

    const isAssigned = dispute.assigned_admin_user_id === actor.user.id;
    const can_take_charge =
      dispute.dispute_status === "open" && (actor.isSuper || actor.isSupport);
    const can_act_assigned = isAssigned || actor.isSuper;
    const can_view_conversation = actor.isSuper || (actor.isSupport && isAssigned);
    const can_reassign =
      actor.isSuper &&
      (dispute.dispute_status === "under_review" ||
        dispute.dispute_status === "waiting_user_response");

    return {
      dispute,
      offer_title: offer?.title ?? "Offre",
      co_subscription: cs,
      conversation_id: conv?.id ?? null,
      perms: {
        can_take_charge,
        can_act_assigned,
        can_view_conversation,
        can_reassign,
      },
    };
  });

// ---------- Admin: take charge (open -> under_review) ----------
export const takeChargeDispute = createServerFn({ method: "POST" })
  .inputValidator((d) => z.object({ dispute_id: z.string().uuid() }).parse(d))
  .middleware([requireSupabaseAuth])
  .handler(async ({ data, context }) => {
    const actor = await loadActor(context.userId);
    if (!actor.isSuper && !actor.isSupport) throw new Error("forbidden");
    const { data: dispute } = await supabaseAdmin
      .from("disputes")
      .select("id,co_subscription_id,assigned_admin_user_id,dispute_status")
      .eq("id", data.dispute_id)
      .maybeSingle();
    if (!dispute) throw new Error("not_found");
    if (dispute.dispute_status !== "open") throw new Error("transition_forbidden");

    const { error } = await supabaseAdmin
      .from("disputes")
      .update({
        dispute_status: "under_review",
        assigned_admin_user_id: actor.user.id,
        updated_at: new Date().toISOString(),
      })
      .eq("id", dispute.id);
    if (error) throw new Error("update_failed");

    // Add admin to dispute conversation
    const { data: conv } = await supabaseAdmin
      .from("conversations")
      .select("id")
      .eq("conversation_type", "dispute_context")
      .eq("co_subscription_id", dispute.co_subscription_id)
      .maybeSingle();
    if (conv) {
      const { data: existing } = await supabaseAdmin
        .from("conversation_participants")
        .select("id,left_at")
        .eq("conversation_id", conv.id)
        .eq("user_id", actor.user.id)
        .maybeSingle();
      if (!existing) {
        await supabaseAdmin.from("conversation_participants").insert({
          conversation_id: conv.id,
          user_id: actor.user.id,
          participant_role: "admin",
        });
      } else if (existing.left_at) {
        await supabaseAdmin
          .from("conversation_participants")
          .update({ left_at: null, joined_at: new Date().toISOString() })
          .eq("id", existing.id);
      }
    }

    const { data: cs } = await supabaseAdmin
      .from("co_subscriptions")
      .select("owner_user_id,subscriber_user_id")
      .eq("id", dispute.co_subscription_id)
      .maybeSingle();

    await notifyDisputeUpdated({
      dispute_id: dispute.id,
      recipient_user_ids: cs ? [cs.owner_user_id, cs.subscriber_user_id] : [],
      title: "Litige pris en charge",
      body: "Votre litige est désormais en cours d'examen.",
    });

    await audit({
      actor_user_id: actor.user.id,
      actor_type: "admin",
      action_type: "dispute_status_changed",
      entity_type: "disputes",
      entity_id: dispute.id,
      changed_fields: ["dispute_status", "assigned_admin_user_id"],
      before: {
        dispute_status: "open",
        assigned_admin_user_id: dispute.assigned_admin_user_id,
      },
      after: { dispute_status: "under_review", assigned_admin_user_id: actor.user.id },
    });
    return { ok: true };
  });

// ---------- Admin: transition dispute ----------
const TRANSITIONS: Record<string, string[]> = {
  under_review: ["waiting_user_response", "resolved", "closed"],
  waiting_user_response: ["under_review"],
  resolved: ["closed"],
};

export const transitionDispute = createServerFn({ method: "POST" })
  .inputValidator((d) =>
    z
      .object({
        dispute_id: z.string().uuid(),
        target_status: z.enum([
          "waiting_user_response",
          "under_review",
          "resolved",
          "closed",
        ]),
      })
      .parse(d),
  )
  .middleware([requireSupabaseAuth])
  .handler(async ({ data, context }) => {
    const actor = await loadActor(context.userId);
    const { data: dispute } = await supabaseAdmin
      .from("disputes")
      .select("id,co_subscription_id,assigned_admin_user_id,dispute_status")
      .eq("id", data.dispute_id)
      .maybeSingle();
    if (!dispute) throw new Error("not_found");

    const allowed = TRANSITIONS[dispute.dispute_status] ?? [];
    if (!allowed.includes(data.target_status)) throw new Error("transition_forbidden");

    const isAssigned = dispute.assigned_admin_user_id === actor.user.id;
    if (!actor.isSuper && !isAssigned) throw new Error("forbidden");

    const update: {
      dispute_status: typeof data.target_status;
      updated_at: string;
      closed_at?: string;
    } = {
      dispute_status: data.target_status,
      updated_at: new Date().toISOString(),
    };
    if (data.target_status === "closed") update.closed_at = new Date().toISOString();

    const { error } = await supabaseAdmin
      .from("disputes")
      .update(update)
      .eq("id", dispute.id);
    if (error) throw new Error("update_failed");

    const { data: cs } = await supabaseAdmin
      .from("co_subscriptions")
      .select("owner_user_id,subscriber_user_id")
      .eq("id", dispute.co_subscription_id)
      .maybeSingle();

    const recipients = cs ? [cs.owner_user_id, cs.subscriber_user_id] : [];
    if (dispute.assigned_admin_user_id) recipients.push(dispute.assigned_admin_user_id);

    await notifyDisputeUpdated({
      dispute_id: dispute.id,
      recipient_user_ids: recipients,
      title: "Litige mis à jour",
      body: `Le statut du litige est désormais : ${data.target_status}.`,
    });

    await audit({
      actor_user_id: actor.user.id,
      actor_type: "admin",
      action_type: "dispute_status_changed",
      entity_type: "disputes",
      entity_id: dispute.id,
      changed_fields: ["dispute_status"],
      before: { dispute_status: dispute.dispute_status },
      after: { dispute_status: data.target_status },
    });
    return { ok: true };
  });

// ---------- Admin: reassign (super_admin only) ----------
export const reassignDispute = createServerFn({ method: "POST" })
  .inputValidator((d) =>
    z
      .object({
        dispute_id: z.string().uuid(),
        new_admin_user_id: z.string().uuid(),
      })
      .parse(d),
  )
  .middleware([requireSupabaseAuth])
  .handler(async ({ data, context }) => {
    const actor = await loadActor(context.userId);
    if (!actor.isSuper) throw new Error("forbidden");
    const { data: dispute } = await supabaseAdmin
      .from("disputes")
      .select("id,co_subscription_id,assigned_admin_user_id,dispute_status")
      .eq("id", data.dispute_id)
      .maybeSingle();
    if (!dispute) throw new Error("not_found");
    if (
      dispute.dispute_status !== "under_review" &&
      dispute.dispute_status !== "waiting_user_response"
    ) {
      throw new Error("transition_forbidden");
    }
    // Validate target admin is support_admin or super_admin
    const { data: targetRoles } = await supabaseAdmin
      .from("admin_users")
      .select("admin_role")
      .eq("user_id", data.new_admin_user_id);
    const roles = (targetRoles ?? []).map((r) => r.admin_role as string);
    if (!roles.includes("support_admin") && !roles.includes("super_admin")) {
      throw new Error("invalid_admin");
    }

    const previousAdmin = dispute.assigned_admin_user_id;

    const { error } = await supabaseAdmin
      .from("disputes")
      .update({
        assigned_admin_user_id: data.new_admin_user_id,
        updated_at: new Date().toISOString(),
      })
      .eq("id", dispute.id);
    if (error) throw new Error("update_failed");

    const { data: conv } = await supabaseAdmin
      .from("conversations")
      .select("id")
      .eq("conversation_type", "dispute_context")
      .eq("co_subscription_id", dispute.co_subscription_id)
      .maybeSingle();
    if (conv) {
      if (previousAdmin) {
        await supabaseAdmin
          .from("conversation_participants")
          .update({ left_at: new Date().toISOString() })
          .eq("conversation_id", conv.id)
          .eq("user_id", previousAdmin)
          .is("left_at", null);
      }
      const { data: existing } = await supabaseAdmin
        .from("conversation_participants")
        .select("id,left_at")
        .eq("conversation_id", conv.id)
        .eq("user_id", data.new_admin_user_id)
        .maybeSingle();
      if (!existing) {
        await supabaseAdmin.from("conversation_participants").insert({
          conversation_id: conv.id,
          user_id: data.new_admin_user_id,
          participant_role: "admin",
        });
      } else if (existing.left_at) {
        await supabaseAdmin
          .from("conversation_participants")
          .update({ left_at: null, joined_at: new Date().toISOString() })
          .eq("id", existing.id);
      }
    }

    await audit({
      actor_user_id: actor.user.id,
      actor_type: "admin",
      action_type: "dispute_status_changed",
      entity_type: "disputes",
      entity_id: dispute.id,
      changed_fields: ["assigned_admin_user_id"],
      before: { assigned_admin_user_id: previousAdmin },
      after: { assigned_admin_user_id: data.new_admin_user_id },
    });
    return { ok: true };
  });

// ---------- Admin: view dispute conversation (logged) ----------
export const adminViewDisputeConversation = createServerFn({ method: "POST" })
  .inputValidator((d) => z.object({ dispute_id: z.string().uuid() }).parse(d))
  .middleware([requireSupabaseAuth])
  .handler(async ({ data, context }) => {
    const actor = await loadActor(context.userId);
    const { data: dispute } = await supabaseAdmin
      .from("disputes")
      .select("id,co_subscription_id,assigned_admin_user_id")
      .eq("id", data.dispute_id)
      .maybeSingle();
    if (!dispute) throw new Error("not_found");

    const isAssigned = dispute.assigned_admin_user_id === actor.user.id;
    if (!actor.isSuper && !(actor.isSupport && isAssigned)) {
      throw new Error("forbidden");
    }

    const { data: conv } = await supabaseAdmin
      .from("conversations")
      .select("id,conversation_type,co_subscription_id,created_at")
      .eq("conversation_type", "dispute_context")
      .eq("co_subscription_id", dispute.co_subscription_id)
      .maybeSingle();
    if (!conv) throw new Error("not_found");

    const { data: parts } = await supabaseAdmin
      .from("conversation_participants")
      .select("user_id,participant_role,joined_at,left_at")
      .eq("conversation_id", conv.id);
    const userIds = Array.from(new Set((parts ?? []).map((p) => p.user_id)));
    const { data: profiles } = await supabaseAdmin
      .from("user_profiles")
      .select("user_id,display_name")
      .in("user_id", userIds);
    const nameMap = new Map((profiles ?? []).map((p) => [p.user_id, p.display_name]));

    const { data: messages } = await supabaseAdmin
      .from("messages")
      .select("id,sender_user_id,body,message_status,created_at")
      .eq("conversation_id", conv.id)
      .order("created_at", { ascending: true });

    await audit({
      actor_user_id: actor.user.id,
      actor_type: "admin",
      action_type: "admin_conversation_viewed",
      entity_type: "conversations",
      entity_id: conv.id,
      changed_fields: [],
      before: {},
      after: { view_context: "dispute_admin_review" },
    });

    return {
      conversation: conv,
      participants: (parts ?? []).map((p) => ({
        ...p,
        display_name: nameMap.get(p.user_id) ?? "Utilisateur",
      })),
      messages: (messages ?? []).map((m) => ({
        id: m.id,
        sender_user_id: m.sender_user_id,
        sender_name: nameMap.get(m.sender_user_id) ?? "Utilisateur",
        body: m.message_status === "sent" ? m.body : null,
        message_status: m.message_status,
        created_at: m.created_at,
      })),
    };
  });
