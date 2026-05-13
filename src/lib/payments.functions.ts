import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { createNotification } from "@/lib/notifications.server";
import { createCheckoutSession } from "@/lib/payments/provider";

// ---------- Whitelisted audit actions (Phase 4) ----------
const ALLOWED_PAYMENT_AUDIT = new Set([
  "payment_record_simulated",
  "payment_record_failed",
  "payment_record_cancelled",
  "participation_activated",
  "participation_cancelled",
]);

function diff<T extends Record<string, unknown>>(before: T, after: T) {
  const changed: string[] = [];
  const keys = new Set([...Object.keys(before), ...Object.keys(after)]);
  for (const k of keys) {
    if (JSON.stringify(before[k]) !== JSON.stringify(after[k])) changed.push(k);
  }
  return changed;
}

async function writeAudit(p: {
  actorUserId: string;
  actionType: string;
  entityType: string;
  entityId: string;
  before: Record<string, unknown> | null;
  after: Record<string, unknown> | null;
}) {
  if (!ALLOWED_PAYMENT_AUDIT.has(p.actionType)) {
    throw new Error(`audit_action_not_allowed:${p.actionType}`);
  }
  const before = p.before ?? {};
  const after = p.after ?? {};
  const envelope = {
    entity_type: p.entityType,
    entity_id: p.entityId,
    changed_fields: diff(before, after),
    before,
    after,
  };
  await supabaseAdmin.from("audit_logs").insert({
    actor_user_id: p.actorUserId,
    actor_type: "admin",
    action_type: p.actionType,
    entity_type: p.entityType,
    entity_id: p.entityId,
    previous_value: envelope as unknown as never,
    new_value: envelope as unknown as never,
  });
}

async function notifyStatusChanged(recipientUserId: string, coSubId: string, title: string, body: string) {
  await createNotification({
    recipient_user_id: recipientUserId,
    notification_type: "participation_status_changed",
    title,
    body,
    related_entity_type: "co_subscription",
    related_entity_id: coSubId,
  });
}

async function requireSuperAdmin(userId: string) {
  const { data } = await supabaseAdmin
    .from("admin_users")
    .select("admin_role")
    .eq("user_id", userId);
  const roles = (data ?? []).map((r) => r.admin_role as string);
  if (!roles.includes("super_admin")) throw new Error("forbidden");
}

async function requireAnyAdmin(userId: string): Promise<string[]> {
  const { data } = await supabaseAdmin
    .from("admin_users")
    .select("admin_role")
    .eq("user_id", userId);
  const roles = (data ?? []).map((r) => r.admin_role as string);
  if (roles.length === 0) throw new Error("forbidden");
  return roles;
}

async function loadPaymentWithCoSub(paymentId: string) {
  const { data: payment } = await supabaseAdmin
    .from("payment_records")
    .select(
      "id,co_subscription_id,payer_user_id,payee_user_id,gross_amount,platform_fee_amount,net_amount,currency,payment_status,provider_name,provider_reference,created_at,updated_at"
    )
    .eq("id", paymentId)
    .maybeSingle();
  if (!payment) throw new Error("not_found");
  const { data: cs } = await supabaseAdmin
    .from("co_subscriptions")
    .select(
      "id,offer_id,owner_user_id,subscriber_user_id,participation_status,accepted_at,activated_at,cancelled_at,ended_at"
    )
    .eq("id", payment.co_subscription_id)
    .maybeSingle();
  if (!cs) throw new Error("not_found");
  return { payment, cs };
}

// ---------- Confirm without real payment: pending -> simulated + activate participation ----------
export const simulatePaymentRecord = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { paymentId: string }) =>
    z.object({ paymentId: z.string().uuid() }).parse(d)
  )
  .handler(async ({ data, context }) => {
    const { userId } = context;
    await requireSuperAdmin(userId);
    const { payment, cs } = await loadPaymentWithCoSub(data.paymentId);

    if (payment.payment_status !== "pending") throw new Error("transition_forbidden");
    if (cs.participation_status !== "accepted_pending_payment")
      throw new Error("transition_forbidden");
    // Anti-real-payment guards (must remain null in MVP)
    if (
      payment.provider_name !== null ||
      payment.provider_reference !== null ||
      payment.platform_fee_amount !== null ||
      payment.net_amount !== null
    ) {
      throw new Error("payment_not_simulation_compatible");
    }

    const nowIso = new Date().toISOString();

    const { error: pErr } = await supabaseAdmin
      .from("payment_records")
      .update({ payment_status: "simulated", updated_at: nowIso })
      .eq("id", payment.id)
      .eq("payment_status", "pending");
    if (pErr) throw new Error("generic_error");

    const { error: csErr } = await supabaseAdmin
      .from("co_subscriptions")
      .update({
        participation_status: "active",
        activated_at: nowIso,
        updated_at: nowIso,
      })
      .eq("id", cs.id)
      .eq("participation_status", "accepted_pending_payment");
    if (csErr) throw new Error("generic_error");

    await supabaseAdmin.rpc("recalc_offer_available_slots", { p_offer_id: cs.offer_id });

    await writeAudit({
      actorUserId: userId,
      actionType: "payment_record_simulated",
      entityType: "payment_records",
      entityId: payment.id,
      before: { payment_status: "pending" },
      after: { payment_status: "simulated" },
    });
    await writeAudit({
      actorUserId: userId,
      actionType: "participation_activated",
      entityType: "co_subscriptions",
      entityId: cs.id,
      before: { participation_status: "accepted_pending_payment" },
      after: { participation_status: "active", activated_at: nowIso },
    });

    await notifyStatusChanged(
      cs.owner_user_id,
      cs.id,
      "Participation activée",
      "Une participation à votre offre est désormais active (simulation MVP)."
    );
    await notifyStatusChanged(
      cs.subscriber_user_id,
      cs.id,
      "Participation activée",
      "Votre participation est désormais active (simulation MVP)."
    );

    // Create the participation conversation now that participation is active (idempotent).
    const { data: existingConv } = await supabaseAdmin
      .from("conversations")
      .select("id")
      .eq("conversation_type", "participation_context")
      .eq("co_subscription_id", cs.id)
      .maybeSingle();
    if (!existingConv) {
      const { data: conv } = await supabaseAdmin
        .from("conversations")
        .insert({ conversation_type: "participation_context", co_subscription_id: cs.id, offer_id: null })
        .select("id")
        .single();
      if (conv) {
        await supabaseAdmin.from("conversation_participants").insert([
          { conversation_id: conv.id, user_id: cs.owner_user_id, participant_role: "owner" },
          { conversation_id: conv.id, user_id: cs.subscriber_user_id, participant_role: "subscriber" },
        ]);
      }
    }

    return { ok: true };
  });

// ---------- Mark as simulated failure: pending -> failed ----------
export const failPaymentRecord = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { paymentId: string }) =>
    z.object({ paymentId: z.string().uuid() }).parse(d)
  )
  .handler(async ({ data, context }) => {
    const { userId } = context;
    await requireSuperAdmin(userId);
    const { payment, cs } = await loadPaymentWithCoSub(data.paymentId);

    if (payment.payment_status !== "pending") throw new Error("transition_forbidden");
    if (cs.participation_status !== "accepted_pending_payment")
      throw new Error("transition_forbidden");

    const nowIso = new Date().toISOString();
    const { error } = await supabaseAdmin
      .from("payment_records")
      .update({ payment_status: "failed", updated_at: nowIso })
      .eq("id", payment.id)
      .eq("payment_status", "pending");
    if (error) throw new Error("generic_error");

    await writeAudit({
      actorUserId: userId,
      actionType: "payment_record_failed",
      entityType: "payment_records",
      entityId: payment.id,
      before: { payment_status: "pending" },
      after: { payment_status: "failed" },
    });
    await notifyStatusChanged(
      cs.subscriber_user_id,
      cs.id,
      "Échec simulé",
      "L'élément préparatoire lié à votre participation a été marqué en échec simulé."
    );

    return { ok: true };
  });

// ---------- Cancel: pending -> cancelled (cancels participation if accepted_pending_payment) ----------
export const cancelPaymentRecord = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { paymentId: string }) =>
    z.object({ paymentId: z.string().uuid() }).parse(d)
  )
  .handler(async ({ data, context }) => {
    const { userId } = context;
    await requireSuperAdmin(userId);
    const { payment, cs } = await loadPaymentWithCoSub(data.paymentId);

    if (payment.payment_status !== "pending") throw new Error("transition_forbidden");

    const nowIso = new Date().toISOString();
    const { error } = await supabaseAdmin
      .from("payment_records")
      .update({ payment_status: "cancelled", updated_at: nowIso })
      .eq("id", payment.id)
      .eq("payment_status", "pending");
    if (error) throw new Error("generic_error");

    await writeAudit({
      actorUserId: userId,
      actionType: "payment_record_cancelled",
      entityType: "payment_records",
      entityId: payment.id,
      before: { payment_status: "pending" },
      after: { payment_status: "cancelled" },
    });

    let participationCancelled = false;
    if (cs.participation_status === "accepted_pending_payment") {
      const { error: csErr } = await supabaseAdmin
        .from("co_subscriptions")
        .update({
          participation_status: "cancelled",
          cancelled_at: nowIso,
          updated_at: nowIso,
        })
        .eq("id", cs.id)
        .eq("participation_status", "accepted_pending_payment");
      if (csErr) throw new Error("generic_error");
      participationCancelled = true;

      await supabaseAdmin.rpc("recalc_offer_available_slots", { p_offer_id: cs.offer_id });

      await writeAudit({
        actorUserId: userId,
        actionType: "participation_cancelled",
        entityType: "co_subscriptions",
        entityId: cs.id,
        before: { participation_status: "accepted_pending_payment" },
        after: { participation_status: "cancelled", cancelled_at: nowIso },
      });
      await notifyStatusChanged(
        cs.owner_user_id,
        cs.id,
        "Participation annulée",
        "Une participation associée à votre offre a été annulée."
      );
      await notifyStatusChanged(
        cs.subscriber_user_id,
        cs.id,
        "Participation annulée",
        "Votre participation a été annulée."
      );
    }

    return { ok: true, participationCancelled };
  });

// ---------- Subscriber: initiate checkout ----------
export const startPaymentCheckout = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { paymentRecordId: string }) =>
    z.object({ paymentRecordId: z.string().uuid() }).parse(d)
  )
  .handler(async ({ data, context }) => {
    const { userId } = context;
    const { payment, cs } = await loadPaymentWithCoSub(data.paymentRecordId);

    if (payment.payer_user_id !== userId) throw new Error("forbidden");
    if (payment.payment_status !== "pending") throw new Error("transition_forbidden");
    if (cs.participation_status !== "accepted_pending_payment") throw new Error("transition_forbidden");
    if (Number(payment.gross_amount) <= 0) throw new Error("invalid_amount");
    if (payment.currency !== "EUR") throw new Error("invalid_currency");

    const result = await createCheckoutSession({
      paymentRecordId: payment.id,
      coSubscriptionId: cs.id,
      payerUserId: payment.payer_user_id,
      payeeUserId: payment.payee_user_id,
      amount: Number(payment.gross_amount),
      currency: "EUR",
      successUrl: `/mes-participations/${cs.id}?payment=success`,
      cancelUrl: `/mes-participations/${cs.id}?payment=cancelled`,
    });

    // In simulation mode: no status changes, no conversation, no real payment.
    return {
      mode: result.mode,
      checkoutUrl: result.checkoutUrl,
      paymentRecordId: payment.id,
    };
  });

// ---------- Admin reads ----------
export const listAdminPayments = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { userId } = context;
    await requireAnyAdmin(userId);

    const { data: rows } = await supabaseAdmin
      .from("payment_records")
      .select(
        `id,co_subscription_id,gross_amount,currency,payment_status,created_at,
         co_sub:co_subscriptions!payment_records_co_subscription_id_fkey(
           id,owner_user_id,subscriber_user_id,participation_status,
           offer:subscription_offers!co_subscriptions_offer_id_fkey(
             id,title,
             service:subscription_services!subscription_offers_service_id_fkey(name),
             plan:subscription_service_plans!subscription_offers_service_plan_id_fkey(name)
           )
         )`
      )
      .order("created_at", { ascending: false })
      .limit(200);
    const list = rows ?? [];
    const userIds = Array.from(
      new Set(
        list.flatMap((r) => {
          const cs = r.co_sub as { owner_user_id: string; subscriber_user_id: string } | null;
          return cs ? [cs.owner_user_id, cs.subscriber_user_id] : [];
        })
      )
    );
    const { data: profiles } = userIds.length
      ? await supabaseAdmin
          .from("user_profiles")
          .select("user_id,display_name")
          .in("user_id", userIds)
      : { data: [] };
    const byId = new Map((profiles ?? []).map((p) => [p.user_id, p.display_name]));
    return {
      items: list.map((r) => {
        const cs = r.co_sub as {
          id: string;
          owner_user_id: string;
          subscriber_user_id: string;
          participation_status: string;
          offer: {
            id: string;
            title: string;
            service?: { name?: string } | null;
            plan?: { name?: string } | null;
          } | null;
        } | null;
        return {
          id: r.id,
          co_subscription_id: r.co_subscription_id,
          gross_amount: Number(r.gross_amount),
          currency: r.currency,
          payment_status: r.payment_status,
          created_at: r.created_at,
          participation_status: cs?.participation_status ?? null,
          offer_title: cs?.offer?.title ?? null,
          service_name: cs?.offer?.service?.name ?? null,
          plan_name: cs?.offer?.plan?.name ?? null,
          owner_display_name: cs ? byId.get(cs.owner_user_id) ?? null : null,
          subscriber_display_name: cs ? byId.get(cs.subscriber_user_id) ?? null : null,
        };
      }),
    };
  });

export const getAdminPayment = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { paymentId: string }) =>
    z.object({ paymentId: z.string().uuid() }).parse(d)
  )
  .handler(async ({ data, context }) => {
    const { userId } = context;
    const roles = await requireAnyAdmin(userId);
    const isSuper = roles.includes("super_admin");

    const { payment, cs } = await loadPaymentWithCoSub(data.paymentId);
    const { data: offer } = await supabaseAdmin
      .from("subscription_offers")
      .select("id,title")
      .eq("id", cs.offer_id)
      .maybeSingle();
    const { data: profiles } = await supabaseAdmin
      .from("user_profiles")
      .select("user_id,display_name")
      .in("user_id", [cs.owner_user_id, cs.subscriber_user_id]);
    const byId = new Map((profiles ?? []).map((p) => [p.user_id, p.display_name]));

    return {
      isSuper,
      payment: {
        id: payment.id,
        gross_amount: Number(payment.gross_amount),
        currency: payment.currency,
        payment_status: payment.payment_status,
        created_at: payment.created_at,
        platform_fee_amount: payment.platform_fee_amount,
        net_amount: payment.net_amount,
      },
      participation: {
        id: cs.id,
        participation_status: cs.participation_status,
      },
      offer_title: offer?.title ?? null,
      owner_display_name: byId.get(cs.owner_user_id) ?? null,
      subscriber_display_name: byId.get(cs.subscriber_user_id) ?? null,
    };
  });
