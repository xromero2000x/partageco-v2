
-- ===== payment_records =====
ALTER TABLE public.payment_records DROP CONSTRAINT IF EXISTS payment_records_simulated_by_admin_user_id_fkey;
ALTER TABLE public.payment_records DROP COLUMN IF EXISTS simulated_at;
ALTER TABLE public.payment_records DROP COLUMN IF EXISTS simulated_by_admin_user_id;
ALTER TABLE public.payment_records ADD COLUMN IF NOT EXISTS payer_user_id uuid REFERENCES public.users(id) ON DELETE RESTRICT;
ALTER TABLE public.payment_records ADD COLUMN IF NOT EXISTS payee_user_id uuid REFERENCES public.users(id) ON DELETE RESTRICT;

-- ===== notifications =====
DROP POLICY IF EXISTS notifications_select_own ON public.notifications;
DROP POLICY IF EXISTS notifications_update_own_read ON public.notifications;
ALTER TABLE public.notifications RENAME COLUMN user_id TO recipient_user_id;
ALTER TABLE public.notifications DROP COLUMN IF EXISTS payload;
ALTER TABLE public.notifications ADD COLUMN IF NOT EXISTS title text NOT NULL DEFAULT '';
ALTER TABLE public.notifications ADD COLUMN IF NOT EXISTS body text NOT NULL DEFAULT '';
ALTER TABLE public.notifications ADD COLUMN IF NOT EXISTS related_entity_type text;
ALTER TABLE public.notifications ADD COLUMN IF NOT EXISTS related_entity_id uuid;
ALTER TABLE public.notifications ALTER COLUMN title DROP DEFAULT;
ALTER TABLE public.notifications ALTER COLUMN body DROP DEFAULT;
CREATE POLICY notifications_select_own ON public.notifications FOR SELECT TO authenticated USING (recipient_user_id = auth.uid());
CREATE POLICY notifications_update_own_read ON public.notifications FOR UPDATE TO authenticated USING (recipient_user_id = auth.uid()) WITH CHECK (recipient_user_id = auth.uid());

-- ===== conversations =====
ALTER TABLE public.conversations DROP COLUMN IF EXISTS dispute_id;
ALTER TYPE public.conversation_context RENAME TO conversation_type;
ALTER TABLE public.conversations RENAME COLUMN context_type TO conversation_type;

-- ===== conversation_participants =====
CREATE TYPE public.participant_role AS ENUM ('owner','subscriber','admin');
ALTER TABLE public.conversation_participants ADD COLUMN participant_role public.participant_role NOT NULL DEFAULT 'subscriber';
ALTER TABLE public.conversation_participants ALTER COLUMN participant_role DROP DEFAULT;

-- ===== messages =====
ALTER TABLE public.messages DROP COLUMN IF EXISTS hidden_by_admin_user_id;
ALTER TABLE public.messages DROP COLUMN IF EXISTS hidden_at;
ALTER TABLE public.messages DROP COLUMN IF EXISTS deleted_at;
ALTER TABLE public.messages ADD COLUMN IF NOT EXISTS updated_at timestamptz NOT NULL DEFAULT now();

-- ===== disputes =====
ALTER TABLE public.disputes RENAME COLUMN reason TO dispute_reason;
ALTER TABLE public.disputes DROP COLUMN IF EXISTS resolution_note;
ALTER TABLE public.disputes DROP COLUMN IF EXISTS resolved_by_admin_user_id;
ALTER TABLE public.disputes DROP COLUMN IF EXISTS resolved_at;
ALTER TABLE public.disputes ADD COLUMN IF NOT EXISTS description text;
ALTER TABLE public.disputes ADD COLUMN IF NOT EXISTS assigned_admin_user_id uuid REFERENCES public.users(id);

-- ===== consent_records =====
DROP POLICY IF EXISTS consents_select_own ON public.consent_records;
ALTER TABLE public.consent_records RENAME COLUMN version TO consent_version;
ALTER TABLE public.consent_records RENAME COLUMN granted_at TO accepted_at;
ALTER TABLE public.consent_records ADD COLUMN IF NOT EXISTS accepted boolean NOT NULL DEFAULT true;
ALTER TABLE public.consent_records ALTER COLUMN accepted DROP DEFAULT;
-- created_at already exists implicitly? Original schema didn't show it; ensure present
ALTER TABLE public.consent_records ADD COLUMN IF NOT EXISTS created_at timestamptz NOT NULL DEFAULT now();

-- Remove cookies_essential from consent_type enum: recreate enum
DELETE FROM public.consent_records WHERE consent_type::text = 'cookies_essential';
ALTER TYPE public.consent_type RENAME TO consent_type_old;
CREATE TYPE public.consent_type AS ENUM ('terms_of_service','privacy_policy','marketing_optional');
ALTER TABLE public.consent_records ALTER COLUMN consent_type TYPE public.consent_type USING consent_type::text::public.consent_type;
DROP TYPE public.consent_type_old;
CREATE POLICY consents_select_own ON public.consent_records FOR SELECT TO authenticated USING (user_id = auth.uid() OR public.is_any_admin(auth.uid()));

-- ===== deletion_requests =====
ALTER TABLE public.deletion_requests DROP COLUMN IF EXISTS rejection_reason;

-- ===== user_profiles =====
ALTER TABLE public.user_profiles DROP COLUMN IF EXISTS locale;
ALTER TABLE public.user_profiles DROP COLUMN IF EXISTS timezone;
ALTER TABLE public.user_profiles ADD COLUMN IF NOT EXISTS first_name text;
ALTER TABLE public.user_profiles ADD COLUMN IF NOT EXISTS last_name text;
ALTER TABLE public.user_profiles ADD COLUMN IF NOT EXISTS country_code text;
ALTER TABLE public.user_profiles ADD COLUMN IF NOT EXISTS preferred_language text NOT NULL DEFAULT 'fr';
ALTER TABLE public.user_profiles ADD COLUMN IF NOT EXISTS avatar_url text;

-- ===== co_subscriptions =====
ALTER TABLE public.co_subscriptions DROP COLUMN IF EXISTS rejected_at;
ALTER TABLE public.co_subscriptions DROP COLUMN IF EXISTS expired_at;
ALTER TABLE public.co_subscriptions ADD COLUMN IF NOT EXISTS ended_at timestamptz;

-- ===== subscription_offers =====
ALTER TABLE public.subscription_offers DROP COLUMN IF EXISTS submitted_at;
ALTER TABLE public.subscription_offers DROP COLUMN IF EXISTS reviewed_at;
ALTER TABLE public.subscription_offers DROP COLUMN IF EXISTS reviewed_by_admin_user_id;
ALTER TABLE public.subscription_offers ADD COLUMN IF NOT EXISTS archived_at timestamptz;

-- ===== Update signup trigger to align with new schema =====
CREATE OR REPLACE FUNCTION public.handle_new_auth_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_display_name TEXT;
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

  INSERT INTO public.audit_logs (actor_user_id, actor_type, action_type, entity_type, entity_id, new_value)
  VALUES (
    NEW.id, 'user', 'user_created', 'users', NEW.id,
    jsonb_build_object('account_status', 'pending_verification')
  );

  RETURN NEW;
END;
$function$;
