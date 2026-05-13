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

const ALLOWED_AUDIT = new Set(["message_hidden_by_admin", "admin_conversation_viewed"]);

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

async function notify(rows: Array<{
  recipient_user_id: string;
  notification_type: "message_received";
  title: string;
  body: string;
  related_entity_type: "message";
  related_entity_id: string;
}>) {
  if (!rows.length) return;
  await createNotifications(rows);
}

// ---------- List my conversations ----------
export const listMyConversations = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const userId = context.userId;
    const { data: parts } = await supabaseAdmin
      .from("conversation_participants")
      .select("conversation_id")
      .eq("user_id", userId)
      .is("left_at", null);
    const ids = (parts ?? []).map((p) => p.conversation_id);
    if (!ids.length) return { conversations: [] };

    const { data: convs } = await supabaseAdmin
      .from("conversations")
      .select("id,conversation_type,offer_id,co_subscription_id,updated_at,created_at")
      .in("id", ids)
      .order("updated_at", { ascending: false });

    const offerIds = Array.from(new Set((convs ?? []).map((c) => c.offer_id).filter(Boolean) as string[]));
    const coSubIds = Array.from(new Set((convs ?? []).map((c) => c.co_subscription_id).filter(Boolean) as string[]));
    const coSubOfferIds: string[] = [];
    const { data: coSubs } = coSubIds.length
      ? await supabaseAdmin
          .from("co_subscriptions")
          .select("id,offer_id,participation_status")
          .in("id", coSubIds)
      : { data: [] as Array<{ id: string; offer_id: string; participation_status: string }> };
    for (const c of coSubs ?? []) coSubOfferIds.push(c.offer_id);
    const allOfferIds = Array.from(new Set([...offerIds, ...coSubOfferIds]));
    const { data: allOffers } = allOfferIds.length
      ? await supabaseAdmin
          .from("subscription_offers")
          .select("id,title")
          .in("id", allOfferIds)
      : { data: [] as Array<{ id: string; title: string }> };
    const offerMap = new Map((allOffers ?? []).map((o) => [o.id, o.title]));
    const coSubMap = new Map((coSubs ?? []).map((c) => [c.id, c]));

    // Last visible message per conversation
    const { data: lastMsgs } = await supabaseAdmin
      .from("messages")
      .select("conversation_id,body,message_status,created_at,sender_user_id")
      .in("conversation_id", ids)
      .order("created_at", { ascending: false })
      .limit(500);
    const lastByConv = new Map<string, { body: string; message_status: string; created_at: string; sender_user_id: string }>();
    for (const m of lastMsgs ?? []) {
      if (!lastByConv.has(m.conversation_id)) lastByConv.set(m.conversation_id, m);
    }

    return {
      conversations: (convs ?? []).map((c) => {
        const cs = c.co_subscription_id ? coSubMap.get(c.co_subscription_id) : undefined;
        const offerTitle = c.offer_id
          ? offerMap.get(c.offer_id)
          : cs
            ? offerMap.get(cs.offer_id)
            : null;
        const last = lastByConv.get(c.id) ?? null;
        let preview: string;
        if (!last) preview = "Aucun message.";
        else if (last.message_status === "deleted_by_user") preview = "Message supprimé par son auteur.";
        else if (last.message_status === "hidden_by_admin") preview = "Message masqué par modération.";
        else preview = last.body.length > 120 ? last.body.slice(0, 120) + "…" : last.body;
        return {
          id: c.id,
          conversation_type: c.conversation_type,
          offer_id: c.offer_id,
          co_subscription_id: c.co_subscription_id,
          offer_title: offerTitle ?? "Offre",
          last_message_at: last?.created_at ?? c.updated_at,
          last_preview: preview,
        };
      }),
    };
  });

// ---------- Ensure participation conversation ----------
export const ensureParticipationConversation = createServerFn({ method: "POST" })
  .inputValidator((d) => z.object({ co_subscription_id: z.string().uuid() }).parse(d))
  .middleware([requireSupabaseAuth])
  .handler(async ({ data, context }) => {
    const actor = await loadActor(context.userId);
    requireActiveVerified(actor);
    const { data: cs } = await supabaseAdmin
      .from("co_subscriptions")
      .select("id,owner_user_id,subscriber_user_id,offer_id")
      .eq("id", data.co_subscription_id)
      .maybeSingle();
    if (!cs) throw new Error("not_found");
    if (cs.owner_user_id !== actor.user.id && cs.subscriber_user_id !== actor.user.id) {
      throw new Error("forbidden");
    }
    const { data: existing } = await supabaseAdmin
      .from("conversations")
      .select("id")
      .eq("conversation_type", "participation_context")
      .eq("co_subscription_id", cs.id)
      .maybeSingle();
    if (existing) return { conversation_id: existing.id };

    const { data: conv, error: convErr } = await supabaseAdmin
      .from("conversations")
      .insert({
        conversation_type: "participation_context",
        co_subscription_id: cs.id,
        offer_id: null,
      })
      .select("id")
      .single();
    if (convErr || !conv) throw new Error("conversation_create_failed");

    await supabaseAdmin.from("conversation_participants").insert([
      { conversation_id: conv.id, user_id: cs.owner_user_id, participant_role: "owner" },
      { conversation_id: conv.id, user_id: cs.subscriber_user_id, participant_role: "subscriber" },
    ]);
    return { conversation_id: conv.id };
  });

// ---------- Get conversation detail ----------
export const getConversation = createServerFn({ method: "GET" })
  .inputValidator((d) => z.object({ conversation_id: z.string().uuid() }).parse(d))
  .middleware([requireSupabaseAuth])
  .handler(async ({ data, context }) => {
    const userId = context.userId;
    const { data: conv } = await supabaseAdmin
      .from("conversations")
      .select("id,conversation_type,offer_id,co_subscription_id,created_at,updated_at")
      .eq("id", data.conversation_id)
      .maybeSingle();
    if (!conv) throw new Error("not_found");

    const { data: parts } = await supabaseAdmin
      .from("conversation_participants")
      .select("user_id,participant_role,joined_at,left_at")
      .eq("conversation_id", conv.id);

    const me = (parts ?? []).find((p) => p.user_id === userId);
    const isActiveParticipant = !!me && me.left_at === null;
    if (!isActiveParticipant) throw new Error("forbidden");

    const userIds = Array.from(new Set((parts ?? []).map((p) => p.user_id)));
    const { data: profiles } = await supabaseAdmin
      .from("user_profiles")
      .select("user_id,display_name")
      .in("user_id", userIds);
    const nameMap = new Map((profiles ?? []).map((p) => [p.user_id, p.display_name]));

    const { data: messages } = await supabaseAdmin
      .from("messages")
      .select("id,sender_user_id,body,message_status,created_at,updated_at")
      .eq("conversation_id", conv.id)
      .order("created_at", { ascending: true });

    let context_label: string | null = null;
    let offer_id: string | null = conv.offer_id;
    if (conv.co_subscription_id) {
      const { data: cs } = await supabaseAdmin
        .from("co_subscriptions")
        .select("id,offer_id,participation_status")
        .eq("id", conv.co_subscription_id)
        .maybeSingle();
      if (cs) offer_id = cs.offer_id;
    }
    if (offer_id) {
      const { data: o } = await supabaseAdmin
        .from("subscription_offers")
        .select("title")
        .eq("id", offer_id)
        .maybeSingle();
      context_label = o?.title ?? null;
    }

    return {
      conversation: {
        id: conv.id,
        conversation_type: conv.conversation_type,
        offer_id,
        co_subscription_id: conv.co_subscription_id,
        context_label,
      },
      participants: (parts ?? []).map((p) => ({
        user_id: p.user_id,
        participant_role: p.participant_role,
        left_at: p.left_at,
        display_name: nameMap.get(p.user_id) ?? "Utilisateur",
      })),
      messages: (messages ?? []).map((m) => ({
        id: m.id,
        sender_user_id: m.sender_user_id,
        sender_name: nameMap.get(m.sender_user_id) ?? "Utilisateur",
        body: m.message_status === "sent" ? m.body : null,
        message_status: m.message_status,
        created_at: m.created_at,
        is_mine: m.sender_user_id === userId,
      })),
    };
  });

// ---------- Send message ----------
export const sendMessage = createServerFn({ method: "POST" })
  .inputValidator((d) =>
    z
      .object({
        conversation_id: z.string().uuid(),
        body: z.string().trim().min(1, "empty_body").max(4000, "too_long"),
      })
      .parse(d),
  )
  .middleware([requireSupabaseAuth])
  .handler(async ({ data, context }) => {
    const actor = await loadActor(context.userId);
    requireActiveVerified(actor);

    const { data: conv } = await supabaseAdmin
      .from("conversations")
      .select("id,conversation_type")
      .eq("id", data.conversation_id)
      .maybeSingle();
    if (!conv) throw new Error("not_found");

    const { data: parts } = await supabaseAdmin
      .from("conversation_participants")
      .select("user_id,left_at")
      .eq("conversation_id", conv.id);
    const me = (parts ?? []).find((p) => p.user_id === actor.user.id);
    if (!me || me.left_at !== null) throw new Error("forbidden");

    const { data: msg, error } = await supabaseAdmin
      .from("messages")
      .insert({
        conversation_id: conv.id,
        sender_user_id: actor.user.id,
        body: data.body.trim(),
        message_status: "sent",
      })
      .select("id,created_at")
      .single();
    if (error || !msg) throw new Error("send_failed");

    await supabaseAdmin
      .from("conversations")
      .update({ updated_at: new Date().toISOString() })
      .eq("id", conv.id);

    const recipients = (parts ?? [])
      .filter((p) => p.left_at === null && p.user_id !== actor.user.id)
      .map((p) => p.user_id);

    await notify(
      recipients.map((uid) => ({
        recipient_user_id: uid,
        notification_type: "message_received" as const,
        title: "Nouveau message",
        body: "Vous avez reçu un nouveau message.",
        related_entity_type: "message",
        related_entity_id: msg.id,
      })),
    );

    return { id: msg.id };
  });

// ---------- Delete by author ----------
export const deleteMyMessage = createServerFn({ method: "POST" })
  .inputValidator((d) => z.object({ message_id: z.string().uuid() }).parse(d))
  .middleware([requireSupabaseAuth])
  .handler(async ({ data, context }) => {
    const userId = context.userId;
    const { data: msg } = await supabaseAdmin
      .from("messages")
      .select("id,sender_user_id,message_status")
      .eq("id", data.message_id)
      .maybeSingle();
    if (!msg) throw new Error("not_found");
    if (msg.sender_user_id !== userId) throw new Error("forbidden");
    if (msg.message_status !== "sent") throw new Error("transition_forbidden");
    const { error } = await supabaseAdmin
      .from("messages")
      .update({ message_status: "deleted_by_user", updated_at: new Date().toISOString() })
      .eq("id", msg.id);
    if (error) throw new Error("update_failed");
    return { ok: true };
  });

// ---------- Hide by admin ----------
export const hideMessageByAdmin = createServerFn({ method: "POST" })
  .inputValidator((d) => z.object({ message_id: z.string().uuid() }).parse(d))
  .middleware([requireSupabaseAuth])
  .handler(async ({ data, context }) => {
    const actor = await loadActor(context.userId);
    if (!actor.isModerator && !actor.isSuper) throw new Error("forbidden");
    const { data: msg } = await supabaseAdmin
      .from("messages")
      .select("id,sender_user_id,message_status,conversation_id")
      .eq("id", data.message_id)
      .maybeSingle();
    if (!msg) throw new Error("not_found");
    if (msg.message_status !== "sent") throw new Error("transition_forbidden");
    const { error } = await supabaseAdmin
      .from("messages")
      .update({ message_status: "hidden_by_admin", updated_at: new Date().toISOString() })
      .eq("id", msg.id);
    if (error) throw new Error("update_failed");
    await audit({
      actor_user_id: actor.user.id,
      actor_type: "admin",
      action_type: "message_hidden_by_admin",
      entity_type: "messages",
      entity_id: msg.id,
      changed_fields: ["message_status"],
      before: { message_status: "sent", sender_user_id: msg.sender_user_id },
      after: { message_status: "hidden_by_admin", sender_user_id: msg.sender_user_id },
    });
    return { ok: true };
  });

// ---------- Admin: list conversations ----------
export const listAdminConversations = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const actor = await loadActor(context.userId);
    // Phase 5: seul super_admin peut consulter la liste admin des conversations.
    // support_admin et moderation_admin n'ont aucun accès libre aux conversations.
    if (!actor.isSuper) throw new Error("forbidden");
    const { data: convs } = await supabaseAdmin
      .from("conversations")
      .select("id,conversation_type,offer_id,co_subscription_id,updated_at,created_at")
      .order("updated_at", { ascending: false })
      .limit(200);
    return { conversations: convs ?? [] };
  });

// ---------- Admin: view conversation (logs) ----------
export const adminViewConversation = createServerFn({ method: "POST" })
  .inputValidator((d) => z.object({ conversation_id: z.string().uuid() }).parse(d))
  .middleware([requireSupabaseAuth])
  .handler(async ({ data, context }) => {
    const actor = await loadActor(context.userId);
    // Phase 5: seul super_admin peut consulter une conversation depuis le back-office.
    // L'accès est explicite (action utilisateur) et systématiquement journalisé.
    if (!actor.isSuper) throw new Error("forbidden");
    const { data: conv } = await supabaseAdmin
      .from("conversations")
      .select("id,conversation_type,offer_id,co_subscription_id,created_at")
      .eq("id", data.conversation_id)
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
      after: { view_context: "super_admin_control" },
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
      can_moderate: actor.isModerator || actor.isSuper,
    };
  });
