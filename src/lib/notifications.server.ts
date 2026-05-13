// Centralized server-only guard for creating internal notifications.
// Enforces the validated mapping (Phase 7). No marketing, push, SMS, or
// out-of-scope notifications can be created through this helper.

import { supabaseAdmin } from "@/integrations/supabase/client.server";

export type NotificationType =
  | "email_verification"
  | "participation_request"
  | "participation_status_changed"
  | "message_received"
  | "dispute_updated"
  | "admin_action";

export type RelatedEntityType =
  | "user"
  | "offer"
  | "co_subscription"
  | "dispute"
  | "message";

export interface NotificationInput {
  recipient_user_id: string;
  notification_type: NotificationType;
  title: string;
  body: string;
  related_entity_type: RelatedEntityType;
  related_entity_id: string;
}

// Allowed mapping: notification_type → allowed related_entity_type values.
const MAPPING: Record<NotificationType, ReadonlyArray<RelatedEntityType>> = {
  email_verification: ["user"],
  participation_request: ["co_subscription"],
  participation_status_changed: ["co_subscription"],
  message_received: ["message"],
  dispute_updated: ["dispute"],
  admin_action: ["offer", "user"],
};

export class NotificationMappingForbiddenError extends Error {
  code = "notification_mapping_forbidden";
  constructor(reason: string) {
    super(`notification_mapping_forbidden: ${reason}`);
  }
}

function validate(n: NotificationInput): void {
  if (!n.recipient_user_id) {
    throw new NotificationMappingForbiddenError("missing_recipient");
  }
  if (!n.title || !n.title.trim()) {
    throw new NotificationMappingForbiddenError("empty_title");
  }
  if (!n.body || !n.body.trim()) {
    throw new NotificationMappingForbiddenError("empty_body");
  }
  const allowed = MAPPING[n.notification_type];
  if (!allowed) {
    throw new NotificationMappingForbiddenError(
      `forbidden_type:${n.notification_type}`,
    );
  }
  if (!allowed.includes(n.related_entity_type)) {
    throw new NotificationMappingForbiddenError(
      `forbidden_pair:${n.notification_type}/${n.related_entity_type}`,
    );
  }
  if (!n.related_entity_id) {
    throw new NotificationMappingForbiddenError("missing_related_entity_id");
  }
}

export async function createNotifications(
  inputs: NotificationInput[],
): Promise<void> {
  if (!inputs.length) return;
  // Deduplicate recipients on identical payloads.
  const seen = new Set<string>();
  const rows: NotificationInput[] = [];
  for (const n of inputs) {
    validate(n);
    const key = `${n.recipient_user_id}|${n.notification_type}|${n.related_entity_type}|${n.related_entity_id}|${n.title}`;
    if (seen.has(key)) continue;
    seen.add(key);
    rows.push(n);
  }
  if (!rows.length) return;
  const { error } = await supabaseAdmin.from("notifications").insert(rows);
  if (error) throw error;
}

export async function createNotification(
  input: NotificationInput,
): Promise<void> {
  await createNotifications([input]);
}
