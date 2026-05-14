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

const UpdateProfileInput = z.object({
  display_name: z
    .string()
    .trim()
    .min(2, "display_name_too_short")
    .max(80, "display_name_too_long")
    .optional(),
  bio: z.string().trim().max(500, "bio_too_long").nullable().optional(),
  avatar_url: z
    .string()
    .url("avatar_url_invalid")
    .max(500, "avatar_url_too_long")
    .nullable()
    .optional(),
});

export const updateMyProfile = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => UpdateProfileInput.parse(d))
  .handler(async ({ data, context }) => {
    const { userId } = context;

    const { data: current } = await supabaseAdmin
      .from("user_profiles")
      .select("display_name,bio,avatar_url")
      .eq("user_id", userId)
      .maybeSingle();

    const patch: { display_name?: string; bio?: string | null; avatar_url?: string | null; updated_at?: string } = {};
    const changed: string[] = [];
    const before: Record<string, unknown> = {};
    const after: Record<string, unknown> = {};

    if (data.display_name !== undefined) {
      const v = data.display_name.trim();
      if (v !== (current?.display_name ?? "")) {
        patch.display_name = v;
        changed.push("display_name");
        before.display_name = current?.display_name ?? null;
        after.display_name = v;
      }
    }
    if (data.bio !== undefined) {
      const v = data.bio === null ? null : data.bio.trim() || null;
      if (v !== (current?.bio ?? null)) {
        patch.bio = v;
        changed.push("bio");
        before.bio = current?.bio ?? null;
        after.bio = v;
      }
    }
    if (data.avatar_url !== undefined) {
      const v = data.avatar_url ?? null;
      if (v !== (current?.avatar_url ?? null)) {
        patch.avatar_url = v;
        changed.push("avatar_url");
        before.avatar_url = current?.avatar_url ?? null;
        after.avatar_url = v;
      }
    }

    if (changed.length === 0) return { ok: true };

    patch.updated_at = new Date().toISOString();

    const { error } = await supabaseAdmin
      .from("user_profiles")
      .update(patch)
      .eq("user_id", userId);
    if (error) throw new Error("update_failed");

    await writeProfileAudit({
      actorUserId: userId,
      actionType: "user_profile_updated",
      entityId: userId,
      changedFields: changed,
      before,
      after,
    });

    return { ok: true };
  });
