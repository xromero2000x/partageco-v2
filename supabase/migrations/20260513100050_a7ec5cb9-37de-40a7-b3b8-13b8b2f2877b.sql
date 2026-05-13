
-- Phase 10: align trigger-emitted audit logs with the Phase 8 envelope format
CREATE OR REPLACE FUNCTION public.handle_auth_email_confirmed()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_envelope jsonb;
BEGIN
  IF NEW.email_confirmed_at IS NOT NULL
     AND (OLD.email_confirmed_at IS NULL OR OLD.email_confirmed_at IS DISTINCT FROM NEW.email_confirmed_at) THEN
    UPDATE public.users
    SET email_verified_at = NEW.email_confirmed_at,
        account_status = CASE
          WHEN account_status = 'pending_verification' THEN 'active'::public.account_status
          ELSE account_status
        END,
        updated_at = now()
    WHERE id = NEW.id AND deleted_at IS NULL;

    v_envelope := jsonb_build_object(
      'entity_type', 'users',
      'entity_id', NEW.id,
      'changed_fields', jsonb_build_array('email_verified_at','account_status'),
      'before', jsonb_build_object('email_verified_at', OLD.email_confirmed_at),
      'after',  jsonb_build_object('email_verified_at', NEW.email_confirmed_at)
    );

    INSERT INTO public.audit_logs (actor_user_id, actor_type, action_type, entity_type, entity_id, previous_value, new_value)
    VALUES (NEW.id, 'user', 'email_verified', 'users', NEW.id, v_envelope, v_envelope);
  END IF;
  RETURN NEW;
END;
$function$;

CREATE OR REPLACE FUNCTION public.handle_new_auth_user()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_display_name TEXT;
  v_envelope jsonb;
BEGIN
  v_display_name := COALESCE(
    NEW.raw_user_meta_data->>'display_name',
    split_part(NEW.email, '@', 1)
  );

  INSERT INTO public.users (id, email, account_status, email_verified_at)
  VALUES (
    NEW.id,
    NEW.email,
    CASE WHEN NEW.email_confirmed_at IS NOT NULL THEN 'active'::public.account_status
         ELSE 'pending_verification'::public.account_status END,
    NEW.email_confirmed_at
  );

  INSERT INTO public.user_profiles (user_id, display_name, preferred_language)
  VALUES (NEW.id, v_display_name, 'fr');

  INSERT INTO public.consent_records (user_id, consent_type, consent_version, accepted, accepted_at)
  VALUES
    (NEW.id, 'terms_of_service', '1.0', true, now()),
    (NEW.id, 'privacy_policy', '1.0', true, now());

  v_envelope := jsonb_build_object(
    'entity_type', 'users',
    'entity_id', NEW.id,
    'changed_fields', jsonb_build_array('account_status'),
    'before', '{}'::jsonb,
    'after',  jsonb_build_object('account_status', 'pending_verification')
  );

  INSERT INTO public.audit_logs (actor_user_id, actor_type, action_type, entity_type, entity_id, previous_value, new_value)
  VALUES (NEW.id, 'user', 'user_created', 'users', NEW.id, v_envelope, v_envelope);

  RETURN NEW;
END;
$function$;
