import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { supabaseAdmin } from "@/integrations/supabase/client.server";

const ALLOWED_AUDIT_ACTIONS = new Set(["user_profile_updated"]);

async function writeProfileAudit(p: {
  actorUserId: string;
  actionType: string;
  entityId: string;
  changedFields: string[];
  before: Record<string, unknown>;
  after: Record<string, unknown>;
}) {
  if (!ALLOWED_AUDIT_ACTIONS.has(p.actionType)) return;
  const envelope = {
    entity_type: "user_profiles",
    entity_id: p.entityId,
    changed_fields: p.changedFields,
    before: p.before,
    after: p.after,
  };
  await supabaseAdmin.from("audit_logs").insert({
    actor_user_id: p.actorUserId,
    actor_type: "user" as const,
    action_type: p.actionType,
    entity_type: "user_profiles",
    entity_id: p.entityId,
    previous_value: envelope as unknown as never,
    new_value: envelope as unknown as never,
  });
}

export const updateMyProfile = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z
      .object({
        display_name: z
          .string()
          .trim()
          .min(2, "display_name_too_short")
          .max(80, "display_name_too_long"),
      })
      .parse(d)
  )
  .handler(async ({ data, context }) => {
    const { userId } = context;
    const trimmed = data.display_name.trim();

    const { data: current } = await supabaseAdmin
      .from("user_profiles")
      .select("display_name")
      .eq("user_id", userId)
      .maybeSingle();

    if (current?.display_name === trimmed) {
      return { ok: true };
    }

    const { error } = await supabaseAdmin
      .from("user_profiles")
      .update({ display_name: trimmed, updated_at: new Date().toISOString() })
      .eq("user_id", userId);
    if (error) throw new Error("update_failed");

    await writeProfileAudit({
      actorUserId: userId,
      actionType: "user_profile_updated",
      entityId: userId,
      changedFields: ["display_name"],
      before: { display_name: current?.display_name ?? null },
      after: { display_name: trimmed },
    });

    return { ok: true };
  });
