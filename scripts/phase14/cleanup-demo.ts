/**
 * Phase 14 — Nettoyage des données de démonstration PartageCo.
 *
 * Supprime UNIQUEMENT les lignes préfixées `demo_partageco_`.
 * Refuse de s'exécuter si APP_ENV n'est pas explicitement non-production.
 *
 * Usage:
 *   APP_ENV=sandbox bun scripts/phase14/cleanup-demo.ts
 */
import { createClient } from "@supabase/supabase-js";

const PREFIX = "demo_partageco_";
const EMAIL_DOMAIN = "@example.test";

const APP_ENV = (process.env.APP_ENV ?? "").toLowerCase();
const ALLOWED_ENVS = new Set(["sandbox", "preview", "preproduction"]);
if (!ALLOWED_ENVS.has(APP_ENV)) {
  console.error(
    `[phase14] Refus d'exécution. APP_ENV="${APP_ENV || "unset"}" — ` +
      `autorisé uniquement: ${[...ALLOWED_ENVS].join(", ")}.`,
  );
  process.exit(2);
}

const SUPABASE_URL = process.env.SUPABASE_URL!;
const SRK = process.env.SUPABASE_SERVICE_ROLE_KEY!;
if (!SUPABASE_URL || !SRK) {
  console.error("Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY");
  process.exit(2);
}
const sb = createClient(SUPABASE_URL, SRK, {
  auth: { autoRefreshToken: false, persistSession: false },
});

type Counts = Record<string, number>;
const counts: Counts = {};

async function listDemoUsers(): Promise<string[]> {
  const ids: string[] = [];
  let page = 1;
  while (true) {
    const { data, error } = await sb.auth.admin.listUsers({ page, perPage: 1000 });
    if (error) throw error;
    for (const u of data.users) {
      if (u.email && u.email.endsWith(EMAIL_DOMAIN) && u.email.startsWith(PREFIX)) {
        ids.push(u.id);
      }
    }
    if (data.users.length < 1000) break;
    page++;
  }
  return ids;
}

async function main() {
  const userIds = await listDemoUsers();
  console.log(`[phase14] ${userIds.length} utilisateurs demo détectés`);

  // Offres demo (par titre préfixé), capture les ids pour cascade manuelle
  const { data: offers } = await sb
    .from("subscription_offers")
    .select("id")
    .like("title", `${PREFIX}%`);
  const offerIds = (offers ?? []).map((o) => o.id);

  // Co-subscriptions liées aux users demo OU aux offres demo
  const orParts: string[] = [];
  if (userIds.length) {
    orParts.push(`owner_user_id.in.(${userIds.join(",")})`);
    orParts.push(`subscriber_user_id.in.(${userIds.join(",")})`);
  }
  if (offerIds.length) orParts.push(`offer_id.in.(${offerIds.join(",")})`);
  let coSubIds: string[] = [];
  if (orParts.length) {
    const { data: subs } = await sb
      .from("co_subscriptions")
      .select("id")
      .or(orParts.join(","));
    coSubIds = (subs ?? []).map((s) => s.id);
  }

  // Conversations (par co_sub OU par offer demo)
  let convIds: string[] = [];
  if (coSubIds.length || offerIds.length) {
    const orC: string[] = [];
    if (coSubIds.length) orC.push(`co_subscription_id.in.(${coSubIds.join(",")})`);
    if (offerIds.length) orC.push(`offer_id.in.(${offerIds.join(",")})`);
    const { data: convs } = await sb.from("conversations").select("id").or(orC.join(","));
    convIds = (convs ?? []).map((c) => c.id);
  }

  async function del(table: string, q: () => Promise<{ error: unknown; count?: number | null }>) {
    const { error, count } = await q();
    if (error) console.warn(`[phase14] ${table}: ${(error as Error).message ?? error}`);
    counts[table] = (counts[table] ?? 0) + (count ?? 0);
  }

  // Ordre: enfants -> parents
  if (convIds.length) {
    await del("messages", () =>
      sb.from("messages").delete({ count: "exact" }).in("conversation_id", convIds),
    );
    await del("conversation_participants", () =>
      sb
        .from("conversation_participants")
        .delete({ count: "exact" })
        .in("conversation_id", convIds),
    );
  }
  if (coSubIds.length) {
    await del("disputes", () =>
      sb.from("disputes").delete({ count: "exact" }).in("co_subscription_id", coSubIds),
    );
    await del("payment_records", () =>
      sb
        .from("payment_records")
        .delete({ count: "exact" })
        .in("co_subscription_id", coSubIds),
    );
  }
  if (convIds.length) {
    await del("conversations", () =>
      sb.from("conversations").delete({ count: "exact" }).in("id", convIds),
    );
  }
  if (coSubIds.length) {
    await del("co_subscriptions", () =>
      sb.from("co_subscriptions").delete({ count: "exact" }).in("id", coSubIds),
    );
  }
  if (offerIds.length) {
    await del("subscription_offers", () =>
      sb.from("subscription_offers").delete({ count: "exact" }).in("id", offerIds),
    );
  }

  if (userIds.length) {
    await del("notifications", () =>
      sb.from("notifications").delete({ count: "exact" }).in("recipient_user_id", userIds),
    );
    await del("audit_logs", () =>
      sb.from("audit_logs").delete({ count: "exact" }).in("actor_user_id", userIds),
    );
    await del("deletion_requests", () =>
      sb.from("deletion_requests").delete({ count: "exact" }).in("user_id", userIds),
    );
    await del("consent_records", () =>
      sb.from("consent_records").delete({ count: "exact" }).in("user_id", userIds),
    );
    await del("admin_users", () =>
      sb.from("admin_users").delete({ count: "exact" }).in("user_id", userIds),
    );
    // public.users a un FK CASCADE sur auth.users -> deleteUser nettoie users + user_profiles
    let removed = 0;
    for (const id of userIds) {
      const { error } = await sb.auth.admin.deleteUser(id);
      if (error) console.warn(`auth.deleteUser ${id}: ${error.message}`);
      else removed++;
    }
    counts["auth_users"] = removed;
  }

  await del("subscription_services", () =>
    sb.from("subscription_services").delete({ count: "exact" }).like("slug", `${PREFIX}%`),
  );
  await del("subscription_categories", () =>
    sb.from("subscription_categories").delete({ count: "exact" }).like("slug", `${PREFIX}%`),
  );

  // Vérification
  const { count: leftOffers } = await sb
    .from("subscription_offers")
    .select("*", { count: "exact", head: true })
    .like("title", `${PREFIX}%`);

  console.log("\n[phase14] Rapport de nettoyage:");
  console.table(counts);
  console.log(`Offres résiduelles préfixées: ${leftOffers ?? 0}`);
  if ((leftOffers ?? 0) > 0) process.exit(1);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
