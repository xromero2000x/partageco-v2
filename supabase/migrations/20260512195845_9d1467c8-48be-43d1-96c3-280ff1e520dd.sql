
CREATE OR REPLACE FUNCTION public.recalc_offer_available_slots(p_offer_id uuid)
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_total int;
  v_used  int;
  v_avail int;
BEGIN
  SELECT total_slots INTO v_total
    FROM public.subscription_offers
   WHERE id = p_offer_id
   FOR UPDATE;
  IF v_total IS NULL THEN
    RAISE EXCEPTION 'offer_not_found';
  END IF;

  SELECT COUNT(*) INTO v_used
    FROM public.co_subscriptions
   WHERE offer_id = p_offer_id
     AND participation_status IN ('active','accepted_pending_payment');

  v_avail := GREATEST(0, LEAST(v_total, v_total - v_used));

  UPDATE public.subscription_offers
     SET available_slots = v_avail,
         updated_at = now()
   WHERE id = p_offer_id;

  RETURN v_avail;
END;
$$;

CREATE OR REPLACE FUNCTION public.accept_participation(
  p_co_sub_id uuid,
  p_owner_user_id uuid
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_cs    public.co_subscriptions%ROWTYPE;
  v_offer public.subscription_offers%ROWTYPE;
  v_owner public.users%ROWTYPE;
  v_used  int;
  v_avail int;
  v_payment_id uuid;
BEGIN
  SELECT * INTO v_cs
    FROM public.co_subscriptions
   WHERE id = p_co_sub_id
   FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'not_found'; END IF;
  IF v_cs.owner_user_id <> p_owner_user_id THEN RAISE EXCEPTION 'forbidden'; END IF;
  IF v_cs.participation_status <> 'requested' THEN RAISE EXCEPTION 'transition_forbidden'; END IF;

  SELECT * INTO v_offer
    FROM public.subscription_offers
   WHERE id = v_cs.offer_id
   FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'offer_unavailable'; END IF;
  IF v_offer.offer_status <> 'active' OR v_offer.visibility <> 'public' THEN
    RAISE EXCEPTION 'offer_unavailable';
  END IF;

  SELECT * INTO v_owner FROM public.users WHERE id = p_owner_user_id;
  IF v_owner.account_status <> 'active'
     OR v_owner.email_verified_at IS NULL
     OR v_owner.deleted_at IS NOT NULL THEN
    RAISE EXCEPTION 'forbidden';
  END IF;

  SELECT COUNT(*) INTO v_used
    FROM public.co_subscriptions
   WHERE offer_id = v_offer.id
     AND participation_status IN ('active','accepted_pending_payment');

  IF v_used >= v_offer.total_slots THEN
    RAISE EXCEPTION 'no_slots_available';
  END IF;

  UPDATE public.co_subscriptions
     SET participation_status = 'accepted_pending_payment',
         accepted_at = now(),
         updated_at = now()
   WHERE id = v_cs.id;

  INSERT INTO public.payment_records (
    co_subscription_id, payer_user_id, payee_user_id,
    gross_amount, platform_fee_amount, net_amount,
    currency, payment_status, provider_name, provider_reference
  ) VALUES (
    v_cs.id, v_cs.subscriber_user_id, v_cs.owner_user_id,
    v_offer.monthly_price_amount, NULL, NULL,
    'EUR', 'pending', NULL, NULL
  ) RETURNING id INTO v_payment_id;

  v_avail := v_offer.total_slots - (v_used + 1);
  UPDATE public.subscription_offers
     SET available_slots = v_avail,
         updated_at = now()
   WHERE id = v_offer.id;

  RETURN jsonb_build_object(
    'payment_id', v_payment_id,
    'available_slots', v_avail,
    'subscriber_user_id', v_cs.subscriber_user_id,
    'offer_id', v_offer.id,
    'gross_amount', v_offer.monthly_price_amount
  );
END;
$$;

REVOKE ALL ON FUNCTION public.recalc_offer_available_slots(uuid) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.accept_participation(uuid, uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.recalc_offer_available_slots(uuid) TO service_role;
GRANT EXECUTE ON FUNCTION public.accept_participation(uuid, uuid) TO service_role;
