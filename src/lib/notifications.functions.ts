import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { supabaseAdmin } from "@/integrations/supabase/client.server";

export type NotificationRow = {
  id: string;
  notification_type:
    | "email_verification"
    | "participation_request"
    | "participation_status_changed"
    | "message_received"
    | "dispute_updated"
    | "admin_action";
  title: string;
  body: string;
  related_entity_type: string | null;
  related_entity_id: string | null;
  read_at: string | null;
  created_at: string;
};

// ---------- List my notifications ----------
export const listMyNotifications = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<{ notifications: NotificationRow[] }> => {
    const { supabase, userId } = context;
    const { data, error } = await supabase
      .from("notifications")
      .select(
        "id, notification_type, title, body, related_entity_type, related_entity_id, read_at, created_at",
      )
      .eq("recipient_user_id", userId)
      .order("created_at", { ascending: false })
      .limit(200);
    if (error) throw error;
    return { notifications: (data ?? []) as NotificationRow[] };
  });

// ---------- Mark one as read ----------
export const markNotificationRead = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) =>
    z.object({ notification_id: z.string().uuid() }).parse(input),
  )
  .handler(async ({ context, data }) => {
    const { supabase, userId } = context;
    const { error } = await supabase
      .from("notifications")
      .update({ read_at: new Date().toISOString() })
      .eq("id", data.notification_id)
      .eq("recipient_user_id", userId)
      .is("read_at", null);
    if (error) throw error;
    return { ok: true };
  });

// ---------- Mark all as read ----------
export const markAllNotificationsRead = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabase, userId } = context;
    const { error } = await supabase
      .from("notifications")
      .update({ read_at: new Date().toISOString() })
      .eq("recipient_user_id", userId)
      .is("read_at", null);
    if (error) throw error;
    return { ok: true };
  });

// ---------- Server-side link resolver ----------
// Returns a per-notification link descriptor only when the related entity
// exists AND is accessible to the current user. Otherwise returns null,
// so the UI must hide any "Ouvrir" affordance.

export type NotificationLink =
  | { kind: "offer_owner"; offerId: string }
  | { kind: "offer_public"; offerId: string }
  | { kind: "co_subscription_subscriber"; coSubId: string }
  | { kind: "co_subscription_owner"; offerId: string }
  | { kind: "dispute_party"; disputeId: string }
  | { kind: "dispute_admin"; disputeId: string }
  | { kind: "message"; conversationId: string };

async function isAdminRole(userId: string, role: "support_admin" | "super_admin") {
  const { data } = await supabaseAdmin
    .from("admin_users")
    .select("admin_role")
    .eq("user_id", userId)
    .eq("admin_role", role)
    .maybeSingle();
  return !!data;
}

async function resolveOfferLink(userId: string, offerId: string): Promise<NotificationLink | null> {
  const { data: offer } = await supabaseAdmin
    .from("subscription_offers")
    .select("id, owner_user_id, offer_status, visibility, available_slots")
    .eq("id", offerId)
    .maybeSingle();
  if (!offer) return null;
  if (offer.owner_user_id === userId) {
    return { kind: "offer_owner", offerId: offer.id };
  }
  if (
    offer.offer_status === "active" &&
    offer.visibility === "public" &&
    Number(offer.available_slots) > 0
  ) {
    const { data: owner } = await supabaseAdmin
      .from("users")
      .select("account_status, deleted_at")
      .eq("id", offer.owner_user_id)
      .maybeSingle();
    if (owner && owner.account_status === "active" && !owner.deleted_at) {
      return { kind: "offer_public", offerId: offer.id };
    }
  }
  return null;
}

async function resolveCoSubLink(userId: string, coSubId: string): Promise<NotificationLink | null> {
  const { data: cs } = await supabaseAdmin
    .from("co_subscriptions")
    .select("id, owner_user_id, subscriber_user_id, offer_id")
    .eq("id", coSubId)
    .maybeSingle();
  if (!cs) return null;
  if (cs.subscriber_user_id === userId) {
    return { kind: "co_subscription_subscriber", coSubId: cs.id };
  }
  if (cs.owner_user_id === userId) {
    return { kind: "co_subscription_owner", offerId: cs.offer_id };
  }
  return null;
}

async function resolveDisputeLink(userId: string, disputeId: string): Promise<NotificationLink | null> {
  const { data: dispute } = await supabaseAdmin
    .from("disputes")
    .select("id, co_subscription_id, assigned_admin_user_id")
    .eq("id", disputeId)
    .maybeSingle();
  if (!dispute) return null;
  const { data: cs } = await supabaseAdmin
    .from("co_subscriptions")
    .select("owner_user_id, subscriber_user_id")
    .eq("id", dispute.co_subscription_id)
    .maybeSingle();
  if (cs && (cs.owner_user_id === userId || cs.subscriber_user_id === userId)) {
    return { kind: "dispute_party", disputeId: dispute.id };
  }
  if (await isAdminRole(userId, "super_admin")) {
    return { kind: "dispute_admin", disputeId: dispute.id };
  }
  if (
    dispute.assigned_admin_user_id === userId &&
    (await isAdminRole(userId, "support_admin"))
  ) {
    return { kind: "dispute_admin", disputeId: dispute.id };
  }
  return null;
}

async function resolveMessageLink(userId: string, messageId: string): Promise<NotificationLink | null> {
  const { data: msg } = await supabaseAdmin
    .from("messages")
    .select("id, conversation_id")
    .eq("id", messageId)
    .maybeSingle();
  if (!msg) return null;
  const { data: part } = await supabaseAdmin
    .from("conversation_participants")
    .select("id")
    .eq("conversation_id", msg.conversation_id)
    .eq("user_id", userId)
    .is("left_at", null)
    .maybeSingle();
  if (!part) return null;
  return { kind: "message", conversationId: msg.conversation_id };
}

export const resolveNotificationLinks = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) =>
    z
      .object({ notification_ids: z.array(z.string().uuid()).max(200) })
      .parse(input),
  )
  .handler(async ({ context, data }): Promise<{ links: Record<string, NotificationLink | null> }> => {
    const userId = context.userId;
    const out: Record<string, NotificationLink | null> = {};
    if (!data.notification_ids.length) return { links: out };

    const { data: rows } = await supabaseAdmin
      .from("notifications")
      .select("id, related_entity_type, related_entity_id")
      .in("id", data.notification_ids)
      .eq("recipient_user_id", userId);

    for (const r of rows ?? []) {
      const t = r.related_entity_type;
      const eid = r.related_entity_id;
      if (!t || !eid) {
        out[r.id] = null;
        continue;
      }
      try {
        if (t === "offer") out[r.id] = await resolveOfferLink(userId, eid);
        else if (t === "co_subscription") out[r.id] = await resolveCoSubLink(userId, eid);
        else if (t === "dispute") out[r.id] = await resolveDisputeLink(userId, eid);
        else if (t === "message") out[r.id] = await resolveMessageLink(userId, eid);
        else out[r.id] = null;
      } catch {
        out[r.id] = null;
      }
    }
    // Ensure every requested id has an entry
    for (const id of data.notification_ids) {
      if (!(id in out)) out[id] = null;
    }
    return { links: out };
  });

