-- Phase 10 — Database conformity checks
\pset format aligned
\echo === C1: 16 entity tables ===
SELECT count(*) AS table_count FROM pg_tables WHERE schemaname='public';

\echo === C2: Enum values match contract ===
SELECT t.typname, array_agg(e.enumlabel ORDER BY e.enumsortorder) AS values
FROM pg_type t JOIN pg_enum e ON e.enumtypid=t.oid
JOIN pg_namespace n ON n.oid=t.typnamespace
WHERE n.nspname='public'
  AND t.typname IN ('account_status','offer_status','offer_visibility',
    'participation_status','payment_status','message_status','dispute_status',
    'deletion_request_status','notification_type','admin_role','actor_type',
    'conversation_type','consent_type','currency_code','billing_period','participant_role')
GROUP BY t.typname ORDER BY t.typname;

\echo === C3: RLS enabled on all public tables ===
SELECT relname, relrowsecurity FROM pg_class
WHERE relnamespace='public'::regnamespace AND relkind='r' AND NOT relrowsecurity;

\echo === C4: payment_records contractual fields are always NULL ===
SELECT
  count(*) FILTER (WHERE platform_fee_amount IS NOT NULL) AS bad_platform_fee,
  count(*) FILTER (WHERE net_amount IS NOT NULL)         AS bad_net_amount,
  count(*) FILTER (WHERE provider_name IS NOT NULL)      AS bad_provider_name,
  count(*) FILTER (WHERE provider_reference IS NOT NULL) AS bad_provider_ref,
  count(*) AS total_payment_records
FROM public.payment_records;

\echo === C5: payment_status only authorized values ===
SELECT payment_status, count(*) FROM public.payment_records GROUP BY 1;

\echo === C6: subscription_offers — marketplace filter sanity ===
SELECT count(*) AS public_marketplace_offers FROM public.subscription_offers o
JOIN public.users u ON u.id = o.owner_user_id
WHERE o.offer_status='active' AND o.visibility='public'
  AND o.available_slots>0 AND u.account_status='active' AND u.deleted_at IS NULL;

\echo === C7: available_slots within bounds ===
SELECT count(*) AS out_of_bounds FROM public.subscription_offers
WHERE available_slots < 0 OR available_slots > total_slots;

\echo === C8: notifications types within mapping ===
SELECT notification_type, count(*) FROM public.notifications GROUP BY 1;

\echo === C9: pg_cron — only scheduler job for participations expiration ===
SELECT jobname, schedule FROM cron.job WHERE jobname LIKE '%expire%';

\echo === C10: pg_net is removed ===
SELECT count(*) AS pg_net_present FROM pg_extension WHERE extname='pg_net';

\echo === C11: scheduler function exists and is SECURITY DEFINER ===
SELECT proname, prosecdef FROM pg_proc
WHERE pronamespace='public'::regnamespace AND proname='run_expire_participations';

\echo === C12: audit_logs envelope shape sample (last 50) ===
SELECT count(*) FILTER (WHERE previous_value ? 'entity_type' AND previous_value ? 'entity_id' AND previous_value ? 'changed_fields') AS well_formed,
       count(*) AS total
FROM (SELECT previous_value FROM public.audit_logs ORDER BY created_at DESC LIMIT 50) s;
