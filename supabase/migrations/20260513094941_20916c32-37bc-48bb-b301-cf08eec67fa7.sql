CREATE OR REPLACE FUNCTION public.run_expire_participations()
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_cutoff timestamptz := now() - interval '7 days';
  v_row record;
  v_expired int := 0;
  v_offers uuid[] := ARRAY[]::uuid[];
  v_offer_id uuid;
  v_envelope jsonb;
BEGIN
  FOR v_row IN
    SELECT id, offer_id, subscriber_user_id
      FROM public.co_subscriptions
     WHERE participation_status = 'requested'
       AND requested_at < v_cutoff
     FOR UPDATE SKIP LOCKED
  LOOP
    UPDATE public.co_subscriptions
       SET participation_status = 'expired',
           updated_at = now()
     WHERE id = v_row.id
       AND participation_status = 'requested';

    IF NOT FOUND THEN
      CONTINUE;
    END IF;

    v_envelope := jsonb_build_object(
      'entity_type', 'co_subscriptions',
      'entity_id', v_row.id,
      'changed_fields', jsonb_build_array('participation_status'),
      'before', jsonb_build_object('participation_status', 'requested'),
      'after',  jsonb_build_object('participation_status', 'expired')
    );

    INSERT INTO public.audit_logs (
      actor_user_id, actor_type, action_type, entity_type, entity_id,
      previous_value, new_value
    ) VALUES (
      NULL, 'system', 'participation_expired', 'co_subscriptions', v_row.id,
      v_envelope, v_envelope
    );

    INSERT INTO public.notifications (
      recipient_user_id, notification_type, title, body,
      related_entity_type, related_entity_id
    ) VALUES (
      v_row.subscriber_user_id,
      'participation_status_changed',
      'Demande de participation expirée',
      'Votre demande de participation a expiré faute de réponse sous 7 jours.',
      'co_subscription',
      v_row.id
    );

    IF NOT (v_row.offer_id = ANY(v_offers)) THEN
      v_offers := array_append(v_offers, v_row.offer_id);
    END IF;
    v_expired := v_expired + 1;
  END LOOP;

  FOREACH v_offer_id IN ARRAY v_offers LOOP
    PERFORM public.recalc_offer_available_slots(v_offer_id);
  END LOOP;

  RETURN jsonb_build_object(
    'expired', v_expired,
    'offers_recalculated', COALESCE(array_length(v_offers, 1), 0)
  );
END;
$$;

REVOKE ALL ON FUNCTION public.run_expire_participations() FROM PUBLIC;
REVOKE ALL ON FUNCTION public.run_expire_participations() FROM anon;
REVOKE ALL ON FUNCTION public.run_expire_participations() FROM authenticated;