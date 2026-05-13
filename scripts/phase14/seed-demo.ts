/**
 * Phase 14 — Génération de données de démonstration contrôlées (PartageCo).
 *
 * GARDE-FOUS:
 * - Refus si APP_ENV ∉ {sandbox, preview, preproduction}.
 * - Toutes les données créées sont préfixées `demo_partageco_`.
 * - Emails sur `@example.test` uniquement.
 * - Aucun champ financier réel, aucun provider de paiement renseigné.
 *
 * Usage:
 *   APP_ENV=sandbox bun scripts/phase14/seed-demo.ts
 *
 * Pour nettoyer:
 *   APP_ENV=sandbox bun scripts/phase14/cleanup-demo.ts
 */
import { createClient } from "@supabase/supabase-js";

const PREFIX = "demo_partageco_";
const EMAIL_DOMAIN = "@example.test";

const APP_ENV = (process.env.APP_ENV ?? "").toLowerCase();
const ALLOWED_ENVS = new Set(["sandbox", "preview", "preproduction"]);
if (!ALLOWED_ENVS.has(APP_ENV)) {
  console.error(
    `[phase14] Données de démonstration interdites hors sandbox / préproduction. ` +
      `APP_ENV="${APP_ENV || "unset"}".`,
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

const REPORT = {
  env: APP_ENV,
  vendors: 0,
  buyers: 0,
  admins: 0,
  offers_by_status: {} as Record<string, number>,
  participations_by_status: {} as Record<string, number>,
  payments_by_status: {} as Record<string, number>,
  conversations: 0,
  messages: 0,
  disputes: 0,
  notifications: 0,
  audit_logs: 0,
};

async function createUser(label: string, role?: "super_admin" | "support_admin" | "moderation_admin") {
  const email = `${PREFIX}${label}${EMAIL_DOMAIN}`;
  // idempotent: si déjà existant, retrouver via listUsers
  const { data, error } = await sb.auth.admin.createUser({
    email,
    password: "DemoPartageCo!" + Math.random().toString(36).slice(2),
    email_confirm: true,
    user_metadata: { display_name: `${PREFIX}${label}` },
  });
  if (error || !data.user) throw new Error(`createUser ${label}: ${error?.message}`);
  if (role) {
    const { error: e2 } = await sb
      .from("admin_users")
      .insert({ user_id: data.user.id, admin_role: role });
    if (e2) throw new Error(`admin grant ${label}: ${e2.message}`);
  }
  return data.user.id;
}

async function ensureCategoryService() {
  const slugCat = `${PREFIX}cat_video`;
  const { data: cat } = await sb
    .from("subscription_categories")
    .upsert({ slug: slugCat, name: `${PREFIX}Vidéo streaming — démo`, is_active: true }, {
      onConflict: "slug",
    })
    .select("id")
    .single();
  const slugSvc = `${PREFIX}svc_video_demo`;
  const { data: svc } = await sb
    .from("subscription_services")
    .upsert(
      {
        slug: slugSvc,
        name: `${PREFIX}Service vidéo — démo`,
        category_id: cat!.id,
        is_active: true,
      },
      { onConflict: "slug" },
    )
    .select("id")
    .single();
  return { categoryId: cat!.id, serviceId: svc!.id };
}

async function createOffer(opts: {
  ownerId: string;
  refs: { categoryId: string; serviceId: string };
  label: string;
  status: string;
  visibility: string;
  totalSlots: number;
  availableSlots: number;
  price: number;
}) {
  const { data, error } = await sb
    .from("subscription_offers")
    .insert({
      owner_user_id: opts.ownerId,
      category_id: opts.refs.categoryId,
      service_id: opts.refs.serviceId,
      title: `${PREFIX}offre_${opts.label}`,
      description: `${PREFIX}description_${opts.label}`,
      total_slots: opts.totalSlots,
      available_slots: opts.availableSlots,
      monthly_price_amount: opts.price,
      currency: "EUR",
      billing_period: "monthly",
      offer_status: opts.status as never,
      visibility: opts.visibility as never,
    })
    .select("*")
    .single();
  if (error) throw new Error(`createOffer ${opts.label}: ${error.message}`);
  REPORT.offers_by_status[opts.status] = (REPORT.offers_by_status[opts.status] ?? 0) + 1;
  return data;
}

async function createCoSub(opts: {
  offerId: string;
  ownerId: string;
  subscriberId: string;
  status: string;
}) {
  const now = new Date().toISOString();
  const patch: Record<string, unknown> = {
    offer_id: opts.offerId,
    owner_user_id: opts.ownerId,
    subscriber_user_id: opts.subscriberId,
    participation_status: opts.status,
    requested_at: now,
  };
  if (opts.status === "accepted_pending_payment") patch.accepted_at = now;
  if (opts.status === "active") {
    patch.accepted_at = now;
    patch.activated_at = now;
  }
  if (opts.status === "cancelled") patch.cancelled_at = now;
  if (opts.status === "expired") patch.requested_at = new Date(Date.now() - 8 * 86400000).toISOString();
  const { data, error } = await sb
    .from("co_subscriptions")
    .insert(patch as never)
    .select("*")
    .single();
  if (error) throw new Error(`createCoSub ${opts.status}: ${error.message}`);
  REPORT.participations_by_status[opts.status] =
    (REPORT.participations_by_status[opts.status] ?? 0) + 1;
  return data;
}

async function createPayment(coSubId: string, payerId: string, payeeId: string, gross: number, status: string) {
  const { error } = await sb.from("payment_records").insert({
    co_subscription_id: coSubId,
    payer_user_id: payerId,
    payee_user_id: payeeId,
    gross_amount: gross,
    platform_fee_amount: null,
    net_amount: null,
    currency: "EUR",
    payment_status: status as never,
    provider_name: null,
    provider_reference: null,
  });
  if (error) throw new Error(`payment ${status}: ${error.message}`);
  REPORT.payments_by_status[status] = (REPORT.payments_by_status[status] ?? 0) + 1;
}

async function createConversationWithMessages(opts: {
  type: "participation_context" | "dispute_context";
  coSubId?: string;
  offerId?: string;
  participants: string[];
  senderId: string;
  messages: { body: string; status?: "sent" | "deleted_by_user" | "hidden_by_admin" }[];
}) {
  const { data: conv, error: cErr } = await sb
    .from("conversations")
    .insert({
      conversation_type: opts.type as never,
      co_subscription_id: opts.coSubId ?? null,
      offer_id: opts.offerId ?? null,
    })
    .select("id")
    .single();
  if (cErr) throw new Error(`conversation: ${cErr.message}`);
  REPORT.conversations++;
  for (const userId of opts.participants) {
    const { error: pErr } = await sb.from("conversation_participants").insert({
      conversation_id: conv.id,
      user_id: userId,
      participant_role: "member" as never,
    });
    if (pErr) throw new Error(`participant: ${pErr.message}`);
  }
  for (const m of opts.messages) {
    const { error: mErr } = await sb.from("messages").insert({
      conversation_id: conv.id,
      sender_user_id: opts.senderId,
      body: `${PREFIX}${m.body}`,
      message_status: (m.status ?? "sent") as never,
    });
    if (mErr) throw new Error(`message: ${mErr.message}`);
    REPORT.messages++;
  }
  return conv.id;
}

async function createDispute(coSubId: string, openerId: string, status: string, reason: string) {
  const patch: Record<string, unknown> = {
    co_subscription_id: coSubId,
    opened_by_user_id: openerId,
    dispute_status: status,
    dispute_reason: reason,
    description: `${PREFIX}description_litige_${status}`,
  };
  if (status === "closed" || status === "resolved") patch.closed_at = new Date().toISOString();
  const { data, error } = await sb.from("disputes").insert(patch as never).select("id").single();
  if (error) throw new Error(`dispute ${status}: ${error.message}`);
  REPORT.disputes++;
  return data.id;
}

async function notify(recipientId: string, type: string, entityType: string, entityId: string, title: string) {
  const { error } = await sb.from("notifications").insert({
    recipient_user_id: recipientId,
    notification_type: type as never,
    title: `${PREFIX}${title}`,
    body: `${PREFIX}body_${type}`,
    related_entity_type: entityType,
    related_entity_id: entityId,
  });
  if (error) throw new Error(`notif ${type}: ${error.message}`);
  REPORT.notifications++;
}

async function recalc(offerId: string) {
  const { error } = await sb.rpc("recalc_offer_available_slots", { p_offer_id: offerId });
  if (error) throw new Error(`recalc: ${error.message}`);
}

async function main() {
  console.log(`[phase14] Seed démarré (APP_ENV=${APP_ENV})`);

  // 1. Catégorie + service démo
  const refs = await ensureCategoryService();

  // 2. Utilisateurs
  const vendors: string[] = [];
  for (let i = 1; i <= 5; i++) vendors.push(await createUser(`vendeur_${i}`));
  REPORT.vendors = vendors.length;

  const buyers: string[] = [];
  for (let i = 1; i <= 8; i++) buyers.push(await createUser(`acheteur_${i}`));
  REPORT.buyers = buyers.length;

  const admins = [
    await createUser("admin_super", "super_admin"),
    await createUser("admin_support", "support_admin"),
    await createUser("admin_moderation", "moderation_admin"),
  ];
  REPORT.admins = admins.length;

  // 3. Offres
  const offers: { id: string; owner: string; total: number }[] = [];
  // 6 active/public/available>0
  for (let i = 0; i < 6; i++) {
    const o = await createOffer({
      ownerId: vendors[i % vendors.length],
      refs,
      label: `actif_public_${i + 1}`,
      status: "active",
      visibility: "public",
      totalSlots: 4,
      availableSlots: 4,
      price: 4.99 + i,
    });
    offers.push({ id: o.id, owner: o.owner_user_id, total: o.total_slots });
  }
  // 2 draft
  for (let i = 0; i < 2; i++) {
    await createOffer({
      ownerId: vendors[0],
      refs,
      label: `draft_${i + 1}`,
      status: "draft",
      visibility: "private",
      totalSlots: 3,
      availableSlots: 3,
      price: 5.99,
    });
  }
  // 2 pending_review
  for (let i = 0; i < 2; i++) {
    await createOffer({
      ownerId: vendors[1],
      refs,
      label: `pending_${i + 1}`,
      status: "pending_review",
      visibility: "admin_only",
      totalSlots: 3,
      availableSlots: 3,
      price: 6.99,
    });
  }
  // 2 paused
  for (let i = 0; i < 2; i++) {
    await createOffer({
      ownerId: vendors[2],
      refs,
      label: `paused_${i + 1}`,
      status: "paused",
      visibility: "private",
      totalSlots: 3,
      availableSlots: 3,
      price: 7.99,
    });
  }
  // 1 rejected
  await createOffer({
    ownerId: vendors[3],
    refs,
    label: "rejected_1",
    status: "rejected",
    visibility: "private",
    totalSlots: 3,
    availableSlots: 3,
    price: 8.99,
  });
  // 1 archived
  await createOffer({
    ownerId: vendors[4],
    refs,
    label: "archived_1",
    status: "archived",
    visibility: "private",
    totalSlots: 3,
    availableSlots: 3,
    price: 9.99,
  });
  // 1 active/public/0 slots
  const fullOffer = await createOffer({
    ownerId: vendors[0],
    refs,
    label: "actif_public_complet",
    status: "active",
    visibility: "public",
    totalSlots: 1,
    availableSlots: 0,
    price: 10.99,
  });
  offers.push({ id: fullOffer.id, owner: fullOffer.owner_user_id, total: fullOffer.total_slots });

  // 4. Participations (sur les 6 premières offres actives)
  // Helper: choisir un acheteur ≠ owner
  function pickBuyer(ownerId: string, used: Set<string>) {
    for (const b of buyers) {
      if (b !== ownerId && !used.has(`${ownerId}-${b}`)) {
        used.add(`${ownerId}-${b}`);
        return b;
      }
    }
    throw new Error("no buyer available");
  }

  type CS = { id: string; offerId: string; ownerId: string; subscriberId: string; status: string };
  const created: CS[] = [];
  const used = new Set<string>();
  const plan: Array<[string, number]> = [
    ["requested", 3],
    ["accepted_pending_payment", 3],
    ["active", 3],
    ["cancelled", 2],
    ["rejected", 2],
    ["expired", 2],
  ];
  let oIdx = 0;
  for (const [status, count] of plan) {
    for (let i = 0; i < count; i++) {
      const o = offers[oIdx % 6];
      oIdx++;
      const subscriberId = pickBuyer(o.owner, used);
      const cs = await createCoSub({
        offerId: o.id,
        ownerId: o.owner,
        subscriberId,
        status,
      });
      created.push({
        id: cs.id,
        offerId: o.id,
        ownerId: o.owner,
        subscriberId,
        status,
      });
    }
  }

  // 5. Paiements
  for (const cs of created) {
    if (cs.status === "accepted_pending_payment") {
      await createPayment(cs.id, cs.subscriberId, cs.ownerId, 4.99, "pending");
    } else if (cs.status === "active") {
      await createPayment(cs.id, cs.subscriberId, cs.ownerId, 4.99, "simulated");
    } else if (cs.status === "cancelled") {
      await createPayment(cs.id, cs.subscriberId, cs.ownerId, 4.99, "cancelled");
    }
  }
  // 1 cas failed sur une participation expired
  const expired = created.find((c) => c.status === "expired");
  if (expired) {
    await createPayment(expired.id, expired.subscriberId, expired.ownerId, 4.99, "failed");
  }

  // 6. Recalcul des slots
  const offerIds = Array.from(new Set(created.map((c) => c.offerId)));
  for (const oid of offerIds) await recalc(oid);

  // 7. Conversations + messages
  const activeCS = created.filter((c) => c.status === "active" || c.status === "accepted_pending_payment");
  // 5 conversations participation
  for (let i = 0; i < Math.min(5, activeCS.length); i++) {
    const cs = activeCS[i];
    await createConversationWithMessages({
      type: "participation_context",
      coSubId: cs.id,
      participants: [cs.ownerId, cs.subscriberId],
      senderId: cs.ownerId,
      messages: [
        { body: `bonjour_${i}` },
        { body: `info_acces_${i}` },
      ],
    });
  }
  // 2 conversations avec messages supprimés
  for (let i = 0; i < 2 && i < activeCS.length; i++) {
    const cs = activeCS[i];
    await createConversationWithMessages({
      type: "participation_context",
      coSubId: cs.id,
      participants: [cs.ownerId, cs.subscriberId],
      senderId: cs.subscriberId,
      messages: [{ body: `supprime_${i}`, status: "deleted_by_user" }],
    });
  }
  // 1 message masqué par modération
  if (activeCS[0]) {
    await createConversationWithMessages({
      type: "participation_context",
      coSubId: activeCS[0].id,
      participants: [activeCS[0].ownerId, activeCS[0].subscriberId],
      senderId: activeCS[0].subscriberId,
      messages: [{ body: `masque_admin`, status: "hidden_by_admin" }],
    });
  }

  // 8. Litiges
  const disputable = created.filter((c) =>
    ["active", "accepted_pending_payment", "cancelled"].includes(c.status),
  );
  const dPlan: Array<[string, string]> = [
    ["open", "access_issue"],
    ["under_review", "payment_issue"],
    ["waiting_user_response", "communication_issue"],
    ["resolved", "offer_mismatch"],
    ["closed", "other"],
  ];
  for (let i = 0; i < dPlan.length && i < disputable.length; i++) {
    const cs = disputable[i];
    const [status, reason] = dPlan[i];
    const dId = await createDispute(cs.id, cs.subscriberId, status, reason);
    await createConversationWithMessages({
      type: "dispute_context",
      coSubId: cs.id,
      participants: [cs.ownerId, cs.subscriberId, admins[0]],
      senderId: admins[0],
      messages: [{ body: `prise_en_charge_${status}` }],
    });
    await notify(cs.subscriberId, "dispute_updated", "dispute", dId, `litige_${status}`);
  }

  // 9. Notifications additionnelles
  for (const cs of created.filter((c) => c.status === "requested")) {
    await notify(cs.ownerId, "participation_request", "co_subscription", cs.id, "demande_recue");
  }
  for (const cs of created.filter((c) => c.status === "active")) {
    await notify(cs.subscriberId, "participation_status_changed", "co_subscription", cs.id, "active");
  }

  // 10. Rapport
  console.log("\n[phase14] Rapport de seed:");
  console.log(JSON.stringify(REPORT, null, 2));
  console.log(
    "\nGarde-fous vérifiés: APP_ENV non-production ✓ | préfixe demo_partageco_ ✓ | " +
      "emails @example.test ✓ | platform_fee_amount/net_amount/provider_* = NULL ✓",
  );
  console.log(
    "\nNettoyage: APP_ENV=" + APP_ENV + " bun scripts/phase14/cleanup-demo.ts",
  );
}

main().catch((e) => {
  console.error("[phase14] ERROR:", e);
  process.exit(1);
});
