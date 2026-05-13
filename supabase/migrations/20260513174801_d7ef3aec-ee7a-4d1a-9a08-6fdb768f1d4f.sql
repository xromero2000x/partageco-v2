
-- ============================================================
-- PHASE A — PartageCo full foundation
-- ============================================================

-- ---------- Enums ----------
CREATE TYPE public.account_status AS ENUM ('pending_verification','active','suspended','deletion_requested');
CREATE TYPE public.admin_role AS ENUM ('super_admin','support_admin','moderation_admin');
CREATE TYPE public.offer_status AS ENUM ('draft','pending_review','active','paused','rejected','archived');
CREATE TYPE public.offer_visibility AS ENUM ('private','public','admin_only');
CREATE TYPE public.participation_status AS ENUM ('requested','accepted_pending_payment','active','rejected','cancelled','expired');
CREATE TYPE public.payment_status AS ENUM ('pending','simulated','failed','cancelled');
CREATE TYPE public.conversation_type AS ENUM ('participation_context','dispute_context');
CREATE TYPE public.participant_role AS ENUM ('owner','subscriber','admin');
CREATE TYPE public.message_status AS ENUM ('sent','deleted_by_user','hidden_by_admin');
CREATE TYPE public.dispute_reason AS ENUM ('access_issue','payment_issue','communication_issue','offer_mismatch','other');
CREATE TYPE public.dispute_status AS ENUM ('open','under_review','waiting_user_response','resolved','closed');
CREATE TYPE public.notification_type AS ENUM ('email_verification','participation_request','participation_status_changed','message_received','dispute_updated','admin_action');
CREATE TYPE public.deletion_request_status AS ENUM ('requested','under_review','rejected','completed');

-- ---------- updated_at trigger helper ----------
CREATE OR REPLACE FUNCTION public.touch_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END $$;

-- ---------- Core: users + profiles ----------
CREATE TABLE public.users (
  id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email text NOT NULL,
  account_status public.account_status NOT NULL DEFAULT 'pending_verification',
  email_verified_at timestamptz,
  deleted_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE TRIGGER trg_users_touch BEFORE UPDATE ON public.users
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

CREATE TABLE public.user_profiles (
  user_id uuid PRIMARY KEY REFERENCES public.users(id) ON DELETE CASCADE,
  display_name text NOT NULL DEFAULT 'Utilisateur',
  preferred_language text NOT NULL DEFAULT 'fr',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE TRIGGER trg_user_profiles_touch BEFORE UPDATE ON public.user_profiles
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

-- Note: explicit FK name to match relationship hint used by client code.
ALTER TABLE public.user_profiles
  DROP CONSTRAINT IF EXISTS user_profiles_user_id_fkey,
  ADD CONSTRAINT user_profiles_user_id_fkey
    FOREIGN KEY (user_id) REFERENCES public.users(id) ON DELETE CASCADE;

-- ---------- Admin roles ----------
CREATE TABLE public.admin_users (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  admin_role public.admin_role NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, admin_role)
);

CREATE OR REPLACE FUNCTION public.has_admin_role(_user_id uuid, _role public.admin_role)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (SELECT 1 FROM public.admin_users WHERE user_id = _user_id AND admin_role = _role)
$$;

-- ---------- Catalog: categories / services / plans ----------
CREATE TABLE public.subscription_categories (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  slug text NOT NULL UNIQUE,
  name text NOT NULL,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE TRIGGER trg_cat_touch BEFORE UPDATE ON public.subscription_categories
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

CREATE TABLE public.subscription_services (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  category_id uuid NOT NULL REFERENCES public.subscription_categories(id) ON DELETE RESTRICT,
  slug text NOT NULL UNIQUE,
  name text NOT NULL,
  description text,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE TRIGGER trg_svc_touch BEFORE UPDATE ON public.subscription_services
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

CREATE TABLE public.subscription_service_plans (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  service_id uuid NOT NULL REFERENCES public.subscription_services(id) ON DELETE CASCADE,
  slug text NOT NULL,
  name text NOT NULL,
  description text,
  sort_order int NOT NULL DEFAULT 0,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (service_id, slug)
);
CREATE TRIGGER trg_plan_touch BEFORE UPDATE ON public.subscription_service_plans
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

-- ---------- Offers ----------
CREATE TABLE public.subscription_offers (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_user_id uuid NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  category_id uuid NOT NULL REFERENCES public.subscription_categories(id),
  service_id uuid NOT NULL REFERENCES public.subscription_services(id),
  service_plan_id uuid REFERENCES public.subscription_service_plans(id),
  title text NOT NULL,
  description text,
  total_slots int NOT NULL CHECK (total_slots BETWEEN 1 AND 50),
  available_slots int NOT NULL,
  monthly_price_amount numeric(10,2) NOT NULL CHECK (monthly_price_amount > 0),
  currency text NOT NULL DEFAULT 'EUR',
  billing_period text NOT NULL DEFAULT 'monthly',
  offer_status public.offer_status NOT NULL DEFAULT 'draft',
  visibility public.offer_visibility NOT NULL DEFAULT 'private',
  archived_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE TRIGGER trg_offers_touch BEFORE UPDATE ON public.subscription_offers
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();
CREATE INDEX idx_offers_status_vis ON public.subscription_offers(offer_status, visibility);
CREATE INDEX idx_offers_owner ON public.subscription_offers(owner_user_id);
CREATE INDEX idx_offers_service ON public.subscription_offers(service_id);

-- Explicit FK names referenced by PostgREST relationship hints in client code.
ALTER TABLE public.subscription_offers
  DROP CONSTRAINT IF EXISTS subscription_offers_owner_user_id_fkey,
  ADD CONSTRAINT subscription_offers_owner_user_id_fkey
    FOREIGN KEY (owner_user_id) REFERENCES public.users(id) ON DELETE CASCADE,
  DROP CONSTRAINT IF EXISTS subscription_offers_category_id_fkey,
  ADD CONSTRAINT subscription_offers_category_id_fkey
    FOREIGN KEY (category_id) REFERENCES public.subscription_categories(id),
  DROP CONSTRAINT IF EXISTS subscription_offers_service_id_fkey,
  ADD CONSTRAINT subscription_offers_service_id_fkey
    FOREIGN KEY (service_id) REFERENCES public.subscription_services(id),
  DROP CONSTRAINT IF EXISTS subscription_offers_service_plan_id_fkey,
  ADD CONSTRAINT subscription_offers_service_plan_id_fkey
    FOREIGN KEY (service_plan_id) REFERENCES public.subscription_service_plans(id);

-- ---------- Co-subscriptions ----------
CREATE TABLE public.co_subscriptions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  offer_id uuid NOT NULL REFERENCES public.subscription_offers(id) ON DELETE CASCADE,
  owner_user_id uuid NOT NULL REFERENCES public.users(id),
  subscriber_user_id uuid NOT NULL REFERENCES public.users(id),
  participation_status public.participation_status NOT NULL DEFAULT 'requested',
  requested_at timestamptz NOT NULL DEFAULT now(),
  accepted_at timestamptz,
  activated_at timestamptz,
  cancelled_at timestamptz,
  ended_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE TRIGGER trg_cosub_touch BEFORE UPDATE ON public.co_subscriptions
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();
CREATE INDEX idx_cosub_offer ON public.co_subscriptions(offer_id);
CREATE INDEX idx_cosub_subscriber ON public.co_subscriptions(subscriber_user_id);
CREATE INDEX idx_cosub_owner ON public.co_subscriptions(owner_user_id);

ALTER TABLE public.co_subscriptions
  DROP CONSTRAINT IF EXISTS co_subscriptions_offer_id_fkey,
  ADD CONSTRAINT co_subscriptions_offer_id_fkey
    FOREIGN KEY (offer_id) REFERENCES public.subscription_offers(id) ON DELETE CASCADE;

-- ---------- Payment records ----------
CREATE TABLE public.payment_records (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  co_subscription_id uuid NOT NULL REFERENCES public.co_subscriptions(id) ON DELETE CASCADE,
  payer_user_id uuid NOT NULL REFERENCES public.users(id),
  payee_user_id uuid NOT NULL REFERENCES public.users(id),
  gross_amount numeric(10,2) NOT NULL,
  platform_fee_amount numeric(10,2),
  net_amount numeric(10,2),
  currency text NOT NULL DEFAULT 'EUR',
  payment_status public.payment_status NOT NULL DEFAULT 'pending',
  provider_name text,
  provider_reference text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE TRIGGER trg_pay_touch BEFORE UPDATE ON public.payment_records
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();
CREATE INDEX idx_pay_cosub ON public.payment_records(co_subscription_id);

ALTER TABLE public.payment_records
  DROP CONSTRAINT IF EXISTS payment_records_co_subscription_id_fkey,
  ADD CONSTRAINT payment_records_co_subscription_id_fkey
    FOREIGN KEY (co_subscription_id) REFERENCES public.co_subscriptions(id) ON DELETE CASCADE;

-- ---------- Conversations / messages ----------
CREATE TABLE public.conversations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  conversation_type public.conversation_type NOT NULL,
  offer_id uuid REFERENCES public.subscription_offers(id) ON DELETE SET NULL,
  co_subscription_id uuid REFERENCES public.co_subscriptions(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE TRIGGER trg_conv_touch BEFORE UPDATE ON public.conversations
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();
CREATE INDEX idx_conv_cosub ON public.conversations(co_subscription_id);

CREATE TABLE public.conversation_participants (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  conversation_id uuid NOT NULL REFERENCES public.conversations(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  participant_role public.participant_role NOT NULL,
  joined_at timestamptz NOT NULL DEFAULT now(),
  left_at timestamptz
);
CREATE INDEX idx_cp_conv ON public.conversation_participants(conversation_id);
CREATE INDEX idx_cp_user ON public.conversation_participants(user_id);

CREATE TABLE public.messages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  conversation_id uuid NOT NULL REFERENCES public.conversations(id) ON DELETE CASCADE,
  sender_user_id uuid NOT NULL REFERENCES public.users(id),
  body text NOT NULL,
  message_status public.message_status NOT NULL DEFAULT 'sent',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE TRIGGER trg_msg_touch BEFORE UPDATE ON public.messages
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();
CREATE INDEX idx_msg_conv ON public.messages(conversation_id);

-- ---------- Disputes ----------
CREATE TABLE public.disputes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  co_subscription_id uuid NOT NULL REFERENCES public.co_subscriptions(id) ON DELETE CASCADE,
  opened_by_user_id uuid NOT NULL REFERENCES public.users(id),
  assigned_admin_user_id uuid REFERENCES public.users(id),
  dispute_reason public.dispute_reason NOT NULL,
  description text,
  dispute_status public.dispute_status NOT NULL DEFAULT 'open',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  closed_at timestamptz
);
CREATE TRIGGER trg_disp_touch BEFORE UPDATE ON public.disputes
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

-- ---------- Notifications ----------
CREATE TABLE public.notifications (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  recipient_user_id uuid NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  notification_type public.notification_type NOT NULL,
  title text NOT NULL,
  body text NOT NULL,
  related_entity_type text,
  related_entity_id uuid,
  read_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_notif_recipient ON public.notifications(recipient_user_id, created_at DESC);

-- ---------- Deletion requests ----------
CREATE TABLE public.deletion_requests (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  request_status public.deletion_request_status NOT NULL DEFAULT 'requested',
  reason text,
  requested_at timestamptz NOT NULL DEFAULT now(),
  processed_at timestamptz,
  processed_by_admin_user_id uuid REFERENCES public.users(id),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE TRIGGER trg_del_touch BEFORE UPDATE ON public.deletion_requests
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

-- ---------- Audit logs ----------
CREATE TABLE public.audit_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  actor_user_id uuid REFERENCES public.users(id) ON DELETE SET NULL,
  actor_type text NOT NULL,
  action_type text NOT NULL,
  entity_type text NOT NULL,
  entity_id uuid NOT NULL,
  previous_value jsonb,
  new_value jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_audit_entity ON public.audit_logs(entity_type, entity_id);

-- ============================================================
-- BUSINESS LOGIC
-- ============================================================

-- recalc available_slots = total_slots - active+pending participations
CREATE OR REPLACE FUNCTION public.recalc_offer_available_slots(p_offer_id uuid)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_total int; v_used int;
BEGIN
  SELECT total_slots INTO v_total FROM public.subscription_offers WHERE id = p_offer_id FOR UPDATE;
  IF NOT FOUND THEN RETURN; END IF;
  SELECT COUNT(*) INTO v_used FROM public.co_subscriptions
   WHERE offer_id = p_offer_id
     AND participation_status IN ('accepted_pending_payment','active');
  UPDATE public.subscription_offers
     SET available_slots = GREATEST(v_total - v_used, 0),
         updated_at = now()
   WHERE id = p_offer_id;
END $$;

-- accept_participation: atomic owner accept + create pending payment
CREATE OR REPLACE FUNCTION public.accept_participation(
  p_co_sub_id uuid,
  p_owner_user_id uuid
) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_cs record; v_offer record; v_payment_id uuid;
BEGIN
  SELECT * INTO v_cs FROM public.co_subscriptions WHERE id = p_co_sub_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'not_found'; END IF;
  IF v_cs.owner_user_id <> p_owner_user_id THEN RAISE EXCEPTION 'forbidden'; END IF;
  IF v_cs.participation_status <> 'requested' THEN RAISE EXCEPTION 'transition_forbidden'; END IF;

  SELECT * INTO v_offer FROM public.subscription_offers WHERE id = v_cs.offer_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'offer_unavailable'; END IF;
  IF v_offer.offer_status <> 'active' OR v_offer.visibility <> 'public' THEN
    RAISE EXCEPTION 'offer_unavailable'; END IF;
  IF v_offer.available_slots <= 0 THEN RAISE EXCEPTION 'no_slots_available'; END IF;

  UPDATE public.co_subscriptions
     SET participation_status = 'accepted_pending_payment',
         accepted_at = now(),
         updated_at = now()
   WHERE id = v_cs.id;

  INSERT INTO public.payment_records (
    co_subscription_id, payer_user_id, payee_user_id,
    gross_amount, currency, payment_status
  ) VALUES (
    v_cs.id, v_cs.subscriber_user_id, v_cs.owner_user_id,
    v_offer.monthly_price_amount, v_offer.currency, 'pending'
  ) RETURNING id INTO v_payment_id;

  PERFORM public.recalc_offer_available_slots(v_offer.id);
  SELECT available_slots INTO v_offer FROM public.subscription_offers WHERE id = v_offer.id;

  RETURN jsonb_build_object(
    'payment_id', v_payment_id,
    'available_slots', v_offer.available_slots,
    'gross_amount', (SELECT monthly_price_amount FROM public.subscription_offers WHERE id = v_cs.offer_id)
  );
END $$;

-- ---------- handle_new_user trigger ----------
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_display text;
BEGIN
  v_display := COALESCE(NULLIF(trim(NEW.raw_user_meta_data->>'display_name'),''), split_part(NEW.email,'@',1));
  INSERT INTO public.users (id, email, account_status, email_verified_at)
  VALUES (
    NEW.id, NEW.email,
    CASE WHEN NEW.email_confirmed_at IS NOT NULL THEN 'active'::public.account_status
         ELSE 'pending_verification'::public.account_status END,
    NEW.email_confirmed_at
  )
  ON CONFLICT (id) DO NOTHING;
  INSERT INTO public.user_profiles (user_id, display_name)
  VALUES (NEW.id, v_display)
  ON CONFLICT (user_id) DO NOTHING;
  RETURN NEW;
END $$;

CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- Sync email verification when auth.users.email_confirmed_at is set
CREATE OR REPLACE FUNCTION public.handle_email_confirmed()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NEW.email_confirmed_at IS NOT NULL AND
     (OLD.email_confirmed_at IS NULL OR OLD.email_confirmed_at <> NEW.email_confirmed_at) THEN
    UPDATE public.users
       SET email_verified_at = NEW.email_confirmed_at,
           account_status = CASE WHEN account_status = 'pending_verification'
                                 THEN 'active'::public.account_status
                                 ELSE account_status END,
           updated_at = now()
     WHERE id = NEW.id;
  END IF;
  RETURN NEW;
END $$;

CREATE TRIGGER on_auth_user_email_confirmed
  AFTER UPDATE OF email_confirmed_at ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_email_confirmed();

-- ============================================================
-- RLS
-- ============================================================
ALTER TABLE public.users ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.admin_users ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.subscription_categories ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.subscription_services ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.subscription_service_plans ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.subscription_offers ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.co_subscriptions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.payment_records ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.conversations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.conversation_participants ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.disputes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.deletion_requests ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.audit_logs ENABLE ROW LEVEL SECURITY;

-- Self-read for users + profile (used by useAuth hook)
CREATE POLICY users_self_select ON public.users FOR SELECT TO authenticated
  USING (id = auth.uid());

CREATE POLICY profiles_self_select ON public.user_profiles FOR SELECT TO authenticated
  USING (user_id = auth.uid());

CREATE POLICY profiles_self_update ON public.user_profiles FOR UPDATE TO authenticated
  USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());

-- Notifications: each user reads/updates own (used by listMyNotifications via authed client)
CREATE POLICY notif_own_select ON public.notifications FOR SELECT TO authenticated
  USING (recipient_user_id = auth.uid());

CREATE POLICY notif_own_update ON public.notifications FOR UPDATE TO authenticated
  USING (recipient_user_id = auth.uid()) WITH CHECK (recipient_user_id = auth.uid());

-- All other access goes through serverFn + supabaseAdmin (service role bypasses RLS).
-- No additional public policies are exposed by design.

-- ============================================================
-- SEED — categories, services, plans
-- ============================================================
WITH cats AS (
  INSERT INTO public.subscription_categories (slug, name) VALUES
    ('film-video','Film & vidéo'),
    ('musique','Musique')
  RETURNING id, slug
)
INSERT INTO public.subscription_services (category_id, slug, name, description)
SELECT c.id, s.slug, s.name, s.description
FROM (VALUES
  ('film-video','netflix','Netflix','Service de streaming vidéo'),
  ('film-video','disney-plus','Disney+','Streaming Disney, Marvel, Star Wars'),
  ('film-video','crunchyroll','Crunchyroll','Streaming d''anime'),
  ('film-video','youtube-premium','YouTube Premium','YouTube sans publicité + Music'),
  ('musique','spotify','Spotify','Streaming musical'),
  ('musique','deezer','Deezer','Streaming musical'),
  ('musique','apple-music','Apple Music','Streaming musical Apple')
) AS s(cat_slug, slug, name, description)
JOIN cats c ON c.slug = s.cat_slug;

-- Plans
INSERT INTO public.subscription_service_plans (service_id, slug, name, sort_order)
SELECT svc.id, p.slug, p.name, p.sort_order
FROM public.subscription_services svc
JOIN (VALUES
  ('netflix','standard','Standard',1),
  ('netflix','standard-pub','Standard avec pub',2),
  ('netflix','premium','Premium',3),
  ('disney-plus','standard','Standard',1),
  ('disney-plus','premium','Premium',2),
  ('crunchyroll','fan','Fan',1),
  ('crunchyroll','mega-fan','Mega Fan',2),
  ('crunchyroll','ultimate-fan','Ultimate Fan',3),
  ('youtube-premium','individuel','Individuel',1),
  ('youtube-premium','famille','Famille',2),
  ('youtube-premium','etudiant','Étudiant',3),
  ('spotify','individuel','Individuel',1),
  ('spotify','duo','Duo',2),
  ('spotify','famille','Famille',3),
  ('spotify','etudiant','Étudiant',4),
  ('deezer','individuel','Individuel',1),
  ('deezer','duo','Duo',2),
  ('deezer','famille','Famille',3),
  ('deezer','etudiant','Étudiant',4),
  ('apple-music','individuel','Individuel',1),
  ('apple-music','famille','Famille',2),
  ('apple-music','etudiant','Étudiant',3)
) AS p(svc_slug, slug, name, sort_order) ON p.svc_slug = svc.slug;

-- Backfill profiles/users for any pre-existing auth users (defensive)
INSERT INTO public.users (id, email, account_status, email_verified_at)
SELECT u.id, u.email,
  CASE WHEN u.email_confirmed_at IS NOT NULL THEN 'active'::public.account_status
       ELSE 'pending_verification'::public.account_status END,
  u.email_confirmed_at
FROM auth.users u
ON CONFLICT (id) DO NOTHING;

INSERT INTO public.user_profiles (user_id, display_name)
SELECT u.id, COALESCE(NULLIF(trim(u.raw_user_meta_data->>'display_name'),''), split_part(u.email,'@',1))
FROM auth.users u
ON CONFLICT (user_id) DO NOTHING;
