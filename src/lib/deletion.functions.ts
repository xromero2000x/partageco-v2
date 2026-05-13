// Phase 8 — RGPD: account deletion request lifecycle.
// No physical purge of protected registries. Anonymisation + password
// invalidation + offers paused on completion only.

import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { createNotifications } from "@/lib/notifications.server";

// ---------------- Helpers ----------------
type Actor = {
  user: {
    id: string;
    email: string;
    account_status: string;
    email_verified_at: string | null;
    deleted_at: string | null;
  };
  isSuper: boolean;
};

async function loadActor(userId: string): Promise<Actor> {
  const { data: u } = await supabaseAdmin
    .from("users")
    .select("id,email,account_status,email_verified_at,deleted_at")
    .eq("id", userId)
    .maybeSingle();
  if (!u || u.deleted_at) throw new Error("forbidden");
  const { data: admins } = await supabaseAdmin
    .from("admin_users")
    .select("admin_role")
    .eq("user_id", userId);
  const roles = (admins ?? []).map((a) => a.admin_role as string);
  return { user: u, isSuper: roles.includes("super_admin") };
}

const ALLOWED_AUDIT = new Set([
  "deletion_requested",
  "deletion_request_under_review",
  "deletion_request_rejected",
  "deletion_request_completed",
  "offer_paused",
]);

async function audit(input: {
  actor_user_id: string | null;
  actor_type: "user" | "admin" | "system";
  action_type: string;
  entity_type: string;
  entity_id: string;
  changed_fields?: string[];
  before?: Record<string, unknown>;
  after?: Record<string, unknown>;
}) {
  if (!ALLOWED_AUDIT.has(input.action_type)) {
    throw new Error(`audit_action_not_allowed:${input.action_type}`);
  }
  const envelope = {
    entity_type: input.entity_type,
    entity_id: input.entity_id,
    changed_fields: input.changed_fields ?? [],
    before: input.before ?? {},
    after: input.after ?? {},
  };
  await supabaseAdmin.from("audit_logs").insert({
    actor_user_id: input.actor_user_id,
    actor_type: input.actor_type,
    action_type: input.action_type,
    entity_type: input.entity_type,
    entity_id: input.entity_id,
    previous_value: envelope as never,
    new_value: envelope as never,
  });
}

function maskEmail(email: string): string {
  const [local, domain] = email.split("@");
  if (!local || !domain) return "u***@***";
  const head = local[0] ?? "u";
  return `${head}***@${domain}`;
}

function anonymizedEmail(userId: string): string {
  return `deleted_user_${userId}@deleted.local`;
}

async function listSuperAdminUserIds(): Promise<string[]> {
  const { data } = await supabaseAdmin
    .from("admin_users")
    .select("user_id")
    .eq("admin_role", "super_admin");
  return Array.from(new Set((data ?? []).map((a) => a.user_id)));
}

// ---------------- User: request deletion ----------------
const ELIGIBLE_REQUEST_STATUSES = new Set([
  "pending_verification",
  "active",
  "suspended",
]);

export const requestAccountDeletion = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) =>
    z
      .object({
        reason: z
          .string()
          .trim()
          .max(1000)
          .optional()
          .transform((v) => (v && v.length ? v : null)),
      })
      .parse(input ?? {}),
  )
  .handler(async ({ data, context }) => {
    const userId = context.userId;
    const actor = await loadActor(userId);

    if (!ELIGIBLE_REQUEST_STATUSES.has(actor.user.account_status)) {
      throw new Error("transition_forbidden");
    }
    if (actor.user.account_status === "deletion_requested") {
      throw new Error("transition_forbidden");
    }

    // Block duplicate open request
    const { data: existing } = await supabaseAdmin
      .from("deletion_requests")
      .select("id,request_status")
      .eq("user_id", userId)
      .in("request_status", ["requested", "under_review"])
      .limit(1);
    if (existing && existing.length > 0) {
      throw new Error("deletion_request_duplicate");
    }

    const { data: created, error: insErr } = await supabaseAdmin
      .from("deletion_requests")
      .insert({
        user_id: userId,
        request_status: "requested",
        reason: data.reason,
      })
      .select("id,user_id,request_status,reason,requested_at")
      .single();
    if (insErr || !created) throw insErr ?? new Error("internal_error");

    const beforeStatus = actor.user.account_status;
    const { error: updErr } = await supabaseAdmin
      .from("users")
      .update({ account_status: "deletion_requested", updated_at: new Date().toISOString() })
      .eq("id", userId);
    if (updErr) throw updErr;

    await audit({
      actor_user_id: userId,
      actor_type: "user",
      action_type: "deletion_requested",
      entity_type: "deletion_requests",
      entity_id: created.id,
      changed_fields: ["request_status", "users.account_status"],
      before: { account_status: beforeStatus },
      after: {
        request_status: "requested",
        account_status: "deletion_requested",
        deletion_request_id: created.id,
      },
    });

    // Notify super admins
    const supers = await listSuperAdminUserIds();
    if (supers.length) {
      await createNotifications(
        supers.map((sid) => ({
          recipient_user_id: sid,
          notification_type: "admin_action" as const,
          title: "Nouvelle demande de suppression",
          body: "Un utilisateur a demandé la suppression de son compte. Cette action sera journalisée.",
          related_entity_type: "user" as const,
          related_entity_id: userId,
        })),
      );
    }

    return { deletion_request_id: created.id };
  });

// ---------------- User: view own deletion state ----------------
export const getMyDeletionState = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const userId = context.userId;
    const { data: u } = await supabaseAdmin
      .from("users")
      .select("account_status,email_verified_at")
      .eq("id", userId)
      .maybeSingle();
    const { data: latest } = await supabaseAdmin
      .from("deletion_requests")
      .select("id,request_status,requested_at,processed_at")
      .eq("user_id", userId)
      .order("created_at", { ascending: false })
      .limit(1);
    return {
      account_status: u?.account_status ?? null,
      email_verified: !!u?.email_verified_at,
      latest_request: latest && latest.length ? latest[0] : null,
    };
  });

// ---------------- Admin: list deletion requests ----------------
export const listAdminDeletionRequests = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const actor = await loadActor(context.userId);
    if (!actor.isSuper) throw new Error("forbidden");

    const { data: rows } = await supabaseAdmin
      .from("deletion_requests")
      .select("id,user_id,request_status,requested_at,processed_at")
      .order("requested_at", { ascending: false })
      .limit(200);

    const userIds = Array.from(new Set((rows ?? []).map((r) => r.user_id)));
    const { data: profiles } = userIds.length
      ? await supabaseAdmin
          .from("user_profiles")
          .select("user_id,display_name")
          .in("user_id", userIds)
      : { data: [] as Array<{ user_id: string; display_name: string }> };
    const nameMap = new Map((profiles ?? []).map((p) => [p.user_id, p.display_name]));

    return {
      requests: (rows ?? []).map((r) => ({
        id: r.id,
        user_id: r.user_id,
        display_name: nameMap.get(r.user_id) ?? r.user_id,
        request_status: r.request_status,
        requested_at: r.requested_at,
        processed_at: r.processed_at,
      })),
    };
  });

// ---------------- Admin: get one ----------------
export const getAdminDeletionRequest = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) =>
    z.object({ deletion_request_id: z.string().uuid() }).parse(input),
  )
  .handler(async ({ data, context }) => {
    const actor = await loadActor(context.userId);
    if (!actor.isSuper) throw new Error("forbidden");

    const { data: dr } = await supabaseAdmin
      .from("deletion_requests")
      .select(
        "id,user_id,request_status,reason,requested_at,processed_at,processed_by_admin_user_id",
      )
      .eq("id", data.deletion_request_id)
      .maybeSingle();
    if (!dr) throw new Error("not_found");

    const { data: u } = await supabaseAdmin
      .from("users")
      .select("id,account_status,email_verified_at,deleted_at")
      .eq("id", dr.user_id)
      .maybeSingle();

    const { data: prof } = await supabaseAdmin
      .from("user_profiles")
      .select("display_name")
      .eq("user_id", dr.user_id)
      .maybeSingle();

    return {
      request: dr,
      user: u
        ? {
            id: u.id,
            account_status: u.account_status,
            email_verified: !!u.email_verified_at,
            deleted_at: u.deleted_at,
          }
        : null,
      display_name: prof?.display_name ?? dr.user_id,
    };
  });

// ---------------- Admin: transition ----------------
export const transitionDeletionRequest = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) =>
    z
      .object({
        deletion_request_id: z.string().uuid(),
        action: z.enum(["take_under_review", "reject", "complete"]),
        justification: z.string().trim().min(20).max(1000).optional(),
      })
      .parse(input),
  )
  .handler(async ({ data, context }) => {
    const actor = await loadActor(context.userId);
    if (!actor.isSuper) throw new Error("forbidden");

    const { data: dr } = await supabaseAdmin
      .from("deletion_requests")
      .select("id,user_id,request_status")
      .eq("id", data.deletion_request_id)
      .maybeSingle();
    if (!dr) throw new Error("not_found");

    const adminId = context.userId;
    const nowIso = new Date().toISOString();

    if (data.action === "take_under_review") {
      if (dr.request_status !== "requested") throw new Error("transition_forbidden");
      const { error } = await supabaseAdmin
        .from("deletion_requests")
        .update({ request_status: "under_review", updated_at: nowIso })
        .eq("id", dr.id);
      if (error) throw error;
      await audit({
        actor_user_id: adminId,
        actor_type: "admin",
        action_type: "deletion_request_under_review",
        entity_type: "deletion_requests",
        entity_id: dr.id,
        changed_fields: ["request_status"],
        before: { request_status: "requested" },
        after: { request_status: "under_review" },
      });
      return { ok: true };
    }

    if (data.action === "reject") {
      if (dr.request_status !== "under_review") throw new Error("transition_forbidden");
      if (!data.justification || data.justification.length < 20) {
        throw new Error("justification_required");
      }
      // Determine new account status
      const { data: u } = await supabaseAdmin
        .from("users")
        .select("email_verified_at,account_status")
        .eq("id", dr.user_id)
        .maybeSingle();
      const newAccountStatus = u?.email_verified_at ? "active" : "pending_verification";

      const { error: drErr } = await supabaseAdmin
        .from("deletion_requests")
        .update({
          request_status: "rejected",
          processed_at: nowIso,
          processed_by_admin_user_id: adminId,
          updated_at: nowIso,
        })
        .eq("id", dr.id);
      if (drErr) throw drErr;

      const { error: uErr } = await supabaseAdmin
        .from("users")
        .update({ account_status: newAccountStatus, updated_at: nowIso })
        .eq("id", dr.user_id);
      if (uErr) throw uErr;

      await audit({
        actor_user_id: adminId,
        actor_type: "admin",
        action_type: "deletion_request_rejected",
        entity_type: "deletion_requests",
        entity_id: dr.id,
        changed_fields: ["request_status", "users.account_status"],
        before: {
          request_status: "under_review",
          account_status: u?.account_status ?? null,
        },
        after: {
          request_status: "rejected",
          account_status: newAccountStatus,
          justification: data.justification,
        },
      });

      // Neutral notification to user (do NOT expose justification)
      await createNotifications([
        {
          recipient_user_id: dr.user_id,
          notification_type: "admin_action" as const,
          title: "Demande de suppression rejetée",
          body: "Votre demande de suppression a été rejetée. Pour plus d'informations, veuillez contacter le support.",
          related_entity_type: "user" as const,
          related_entity_id: dr.user_id,
        },
      ]);

      return { ok: true };
    }

    if (data.action === "complete") {
      if (dr.request_status !== "under_review") throw new Error("transition_forbidden");

      // 2. Identify active offers (no mutation yet).
      const { data: activeOffers, error: offersErr } = await supabaseAdmin
        .from("subscription_offers")
        .select("id,offer_status,visibility")
        .eq("owner_user_id", dr.user_id)
        .eq("offer_status", "active");
      if (offersErr) throw new Error("complete_aborted_offers_pause_failed");

      // Snapshot previous user state for audit (masked).
      const { data: prevUser } = await supabaseAdmin
        .from("users")
        .select("email,account_status")
        .eq("id", dr.user_id)
        .maybeSingle();
      const newEmail = anonymizedEmail(dr.user_id);
      const oldEmailMasked = prevUser?.email ? maskEmail(prevUser.email) : null;

      // 3. Invalidate Supabase Auth access — NON silencieux.
      // Si l'invalidation échoue, on n'écrit RIEN (ni email anonymisé, ni
      // deleted_at, ni offers paused, ni completed, ni audit completion).
      const random = `inv_${crypto.randomUUID()}_${crypto.randomUUID()}`;
      const { error: authErr } = await supabaseAdmin.auth.admin.updateUserById(
        dr.user_id,
        { email: newEmail, password: random },
      );
      if (authErr) {
        throw new Error("complete_aborted_auth_invalidation_failed");
      }

      // 4-5. Anonymise users.email + set deleted_at.
      const { error: uErr } = await supabaseAdmin
        .from("users")
        .update({
          email: newEmail,
          deleted_at: nowIso,
          updated_at: nowIso,
        })
        .eq("id", dr.user_id);
      if (uErr) throw uErr;

      // 6. users.password_hash : champ inexistant dans le schéma applicatif
      // (auth géré par Supabase Auth, déjà invalidé ci-dessus). Rien à faire.

      // 7. Pause active offers + audit each.
      for (const o of activeOffers ?? []) {
        const { error: pErr } = await supabaseAdmin
          .from("subscription_offers")
          .update({
            offer_status: "paused",
            visibility: "private",
            updated_at: nowIso,
          })
          .eq("id", o.id);
        if (pErr) throw new Error("complete_aborted_offers_pause_failed");
        await audit({
          actor_user_id: adminId,
          actor_type: "admin",
          action_type: "offer_paused",
          entity_type: "subscription_offers",
          entity_id: o.id,
          changed_fields: ["offer_status", "visibility"],
          before: { offer_status: o.offer_status, visibility: o.visibility },
          after: {
            offer_status: "paused",
            visibility: "private",
            reason: "deletion_request_completed",
          },
        });
      }

      // 8. Mark deletion_request completed.
      const { error: drErr } = await supabaseAdmin
        .from("deletion_requests")
        .update({
          request_status: "completed",
          processed_at: nowIso,
          processed_by_admin_user_id: adminId,
          updated_at: nowIso,
        })
        .eq("id", dr.id);
      if (drErr) throw drErr;

      // 9. Final audit (no plain email, no password material).
      await audit({
        actor_user_id: adminId,
        actor_type: "admin",
        action_type: "deletion_request_completed",
        entity_type: "deletion_requests",
        entity_id: dr.id,
        changed_fields: [
          "request_status",
          "users.email",
          "users.deleted_at",
          "auth.access",
        ],
        before: {
          request_status: "under_review",
          account_status: prevUser?.account_status ?? null,
          email_masked: oldEmailMasked,
        },
        after: {
          request_status: "completed",
          email: newEmail,
          deleted_at: nowIso,
          auth_invalidated: true,
          paused_offers_count: (activeOffers ?? []).length,
        },
      });

      // No notification on completion (per spec).
      return { ok: true };
    }

    throw new Error("transition_forbidden");
  });
