import { createClient } from "@supabase/supabase-js";
const sb = createClient(process.env.SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!,
  { auth: { autoRefreshToken: false, persistSession: false } });

async function main() {
  // List all auth users matching test patterns
  const toDelete: string[] = [];
  let page = 1;
  while (true) {
    const { data, error } = await sb.auth.admin.listUsers({ page, perPage: 1000 });
    if (error) throw error;
    for (const u of data.users) {
      if (u.email?.startsWith("qa_phase11") || u.email?.startsWith("deleted+")) {
        toDelete.push(u.id);
      }
    }
    if (data.users.length < 1000) break;
    page++;
  }
  console.log(`Found ${toDelete.length} test auth users to delete`);

  // Delete dependent rows first via service role (bypasses RLS)
  if (toDelete.length) {
    await sb.from("notifications").delete().in("recipient_user_id", toDelete);
    await sb.from("audit_logs").delete().in("actor_user_id", toDelete);
    // co_subscriptions referenced by user
    const { data: subs } = await sb.from("co_subscriptions").select("id,offer_id")
      .or(`owner_user_id.in.(${toDelete.join(",")}),subscriber_user_id.in.(${toDelete.join(",")})`);
    const subIds = (subs ?? []).map((s) => s.id);
    if (subIds.length) {
      await sb.from("payment_records").delete().in("co_subscription_id", subIds);
      await sb.from("disputes").delete().in("co_subscription_id", subIds);
      const { data: convs } = await sb.from("conversations").select("id").in("co_subscription_id", subIds);
      const convIds = (convs ?? []).map((c) => c.id);
      if (convIds.length) {
        await sb.from("messages").delete().in("conversation_id", convIds);
        await sb.from("conversation_participants").delete().in("conversation_id", convIds);
        await sb.from("conversations").delete().in("id", convIds);
      }
      await sb.from("co_subscriptions").delete().in("id", subIds);
    }
    await sb.from("subscription_offers").delete().in("owner_user_id", toDelete);
    await sb.from("deletion_requests").delete().in("user_id", toDelete);
    await sb.from("consent_records").delete().in("user_id", toDelete);
    await sb.from("admin_users").delete().in("user_id", toDelete);
    // public.users is FK to auth.users with CASCADE — deleting auth.users removes public.users + user_profiles
    for (const id of toDelete) {
      const { error } = await sb.auth.admin.deleteUser(id);
      if (error) console.warn(`delete ${id}: ${error.message}`);
    }
  }
  await sb.from("subscription_services").delete().like("slug", "qa_phase11%");
  await sb.from("subscription_categories").delete().like("slug", "qa_phase11%");

  // Verify
  const { count: remaining } = await sb.from("subscription_offers").select("*", { count: "exact", head: true }).like("title", "qa_phase11%");
  console.log(`Remaining qa_phase11 offers: ${remaining ?? 0}`);
}
main().catch((e) => { console.error(e); process.exit(1); });
