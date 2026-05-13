
-- =====================================================
-- ENUMS
-- =====================================================

CREATE TYPE public.account_status AS ENUM (
  'pending_verification', 'active', 'suspended', 'deletion_requested'
);

CREATE TYPE public.admin_role AS ENUM (
  'support_admin', 'moderation_admin', 'super_admin'
);

CREATE TYPE public.offer_status AS ENUM (
  'draft', 'pending_review', 'active', 'paused', 'rejected', 'archived'
);

CREATE TYPE public.offer_visibility AS ENUM (
  'private', 'public', 'admin_only'
);

CREATE TYPE public.billing_period AS ENUM ('monthly');

CREATE TYPE public.currency_code AS ENUM ('EUR');

CREATE TYPE public.participation_status AS ENUM (
  'requested', 'accepted_pending_payment', 'active',
  'cancelled', 'rejected', 'expired'
);

CREATE TYPE public.payment_status AS ENUM (
  'pending', 'simulated', 'cancelled', 'failed'
);

CREATE TYPE public.message_status AS ENUM (
  'sent', 'deleted_by_user', 'hidden_by_admin'
);

CREATE TYPE public.dispute_status AS ENUM (
  'open', 'under_review', 'waiting_user_response', 'resolved', 'closed'
);

CREATE TYPE public.deletion_request_status AS ENUM (
  'requested', 'under_review', 'rejected', 'completed'
);

CREATE TYPE public.conversation_context AS ENUM (
  'offer_context', 'participation_context', 'dispute_context'
);

CREATE TYPE public.notification_type AS ENUM (
  'email_verification', 'admin_action', 'participation_request',
  'participation_status_changed', 'message_received', 'dispute_updated'
);

CREATE TYPE public.actor_type AS ENUM ('user', 'admin', 'system');

CREATE TYPE public.consent_type AS ENUM (
  'terms_of_service', 'privacy_policy', 'cookies_essential'
);

-- =====================================================
-- USERS (mirrors auth.users)
-- =====================================================

CREATE TABLE public.users (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email TEXT NOT NULL,
  account_status public.account_status NOT NULL DEFAULT 'pending_verification',
  email_verified_at TIMESTAMPTZ,
  deleted_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_users_email ON public.users(email);
CREATE INDEX idx_users_account_status ON public.users(account_status);

-- =====================================================
-- USER_PROFILES
-- =====================================================

CREATE TABLE public.user_profiles (
  user_id UUID PRIMARY KEY REFERENCES public.users(id) ON DELETE CASCADE,
  display_name TEXT NOT NULL,
  locale TEXT NOT NULL DEFAULT 'fr',
  timezone TEXT NOT NULL DEFAULT 'Europe/Paris',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- =====================================================
-- ADMIN_USERS
-- =====================================================

CREATE TABLE public.admin_users (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  admin_role public.admin_role NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (user_id, admin_role)
);

CREATE INDEX idx_admin_users_user_id ON public.admin_users(user_id);

-- =====================================================
-- SECURITY DEFINER FUNCTIONS
-- =====================================================

CREATE OR REPLACE FUNCTION public.has_admin_role(_user_id UUID, _role public.admin_role)
RETURNS BOOLEAN
LANGUAGE SQL
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.admin_users
    WHERE user_id = _user_id AND admin_role = _role
  );
$$;

CREATE OR REPLACE FUNCTION public.is_any_admin(_user_id UUID)
RETURNS BOOLEAN
LANGUAGE SQL
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.admin_users WHERE user_id = _user_id
  );
$$;

CREATE OR REPLACE FUNCTION public.current_account_status(_user_id UUID)
RETURNS public.account_status
LANGUAGE SQL
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT account_status FROM public.users WHERE id = _user_id;
$$;

-- =====================================================
-- SUBSCRIPTION_CATEGORIES
-- =====================================================

CREATE TABLE public.subscription_categories (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  slug TEXT NOT NULL UNIQUE,
  name TEXT NOT NULL,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- =====================================================
-- SUBSCRIPTION_SERVICES
-- =====================================================

CREATE TABLE public.subscription_services (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  category_id UUID NOT NULL REFERENCES public.subscription_categories(id) ON DELETE RESTRICT,
  slug TEXT NOT NULL UNIQUE,
  name TEXT NOT NULL,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_subscription_services_category ON public.subscription_services(category_id);

-- =====================================================
-- SUBSCRIPTION_OFFERS
-- =====================================================

CREATE TABLE public.subscription_offers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE RESTRICT,
  service_id UUID NOT NULL REFERENCES public.subscription_services(id) ON DELETE RESTRICT,
  category_id UUID NOT NULL REFERENCES public.subscription_categories(id) ON DELETE RESTRICT,
  title TEXT NOT NULL,
  description TEXT,
  total_slots INTEGER NOT NULL CHECK (total_slots >= 1),
  available_slots INTEGER NOT NULL CHECK (available_slots >= 0),
  monthly_price_amount NUMERIC(10,2) NOT NULL CHECK (monthly_price_amount > 0),
  currency public.currency_code NOT NULL DEFAULT 'EUR',
  billing_period public.billing_period NOT NULL DEFAULT 'monthly',
  offer_status public.offer_status NOT NULL DEFAULT 'draft',
  visibility public.offer_visibility NOT NULL DEFAULT 'private',
  submitted_at TIMESTAMPTZ,
  reviewed_at TIMESTAMPTZ,
  reviewed_by_admin_user_id UUID REFERENCES public.users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CHECK (available_slots <= total_slots)
);

CREATE INDEX idx_offers_owner ON public.subscription_offers(owner_user_id);
CREATE INDEX idx_offers_status_visibility ON public.subscription_offers(offer_status, visibility);
CREATE INDEX idx_offers_service ON public.subscription_offers(service_id);

-- =====================================================
-- CO_SUBSCRIPTIONS (participations)
-- =====================================================

CREATE TABLE public.co_subscriptions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  offer_id UUID NOT NULL REFERENCES public.subscription_offers(id) ON DELETE RESTRICT,
  owner_user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE RESTRICT,
  subscriber_user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE RESTRICT,
  participation_status public.participation_status NOT NULL DEFAULT 'requested',
  requested_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  accepted_at TIMESTAMPTZ,
  activated_at TIMESTAMPTZ,
  cancelled_at TIMESTAMPTZ,
  rejected_at TIMESTAMPTZ,
  expired_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CHECK (subscriber_user_id <> owner_user_id)
);

CREATE INDEX idx_cosub_offer ON public.co_subscriptions(offer_id);
CREATE INDEX idx_cosub_subscriber ON public.co_subscriptions(subscriber_user_id);
CREATE INDEX idx_cosub_owner ON public.co_subscriptions(owner_user_id);
CREATE INDEX idx_cosub_status ON public.co_subscriptions(participation_status);

-- Index partiel pour empêcher les doublons actifs
CREATE UNIQUE INDEX idx_cosub_unique_active_per_subscriber
  ON public.co_subscriptions (offer_id, subscriber_user_id)
  WHERE participation_status IN ('requested', 'accepted_pending_payment', 'active');

-- =====================================================
-- PAYMENT_RECORDS (Simulation MVP - aucun paiement réel)
-- =====================================================

CREATE TABLE public.payment_records (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  co_subscription_id UUID NOT NULL UNIQUE REFERENCES public.co_subscriptions(id) ON DELETE RESTRICT,
  gross_amount NUMERIC(10,2) NOT NULL CHECK (gross_amount > 0),
  platform_fee_amount NUMERIC(10,2),
  net_amount NUMERIC(10,2),
  currency public.currency_code NOT NULL DEFAULT 'EUR',
  payment_status public.payment_status NOT NULL DEFAULT 'pending',
  provider_name TEXT,
  provider_reference TEXT,
  simulated_at TIMESTAMPTZ,
  simulated_by_admin_user_id UUID REFERENCES public.users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  -- Règles MVP : ces champs DOIVENT rester null
  CHECK (platform_fee_amount IS NULL),
  CHECK (net_amount IS NULL),
  CHECK (provider_name IS NULL),
  CHECK (provider_reference IS NULL)
);

CREATE INDEX idx_payments_status ON public.payment_records(payment_status);

-- =====================================================
-- CONVERSATIONS
-- =====================================================

CREATE TABLE public.conversations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  context_type public.conversation_context NOT NULL,
  offer_id UUID REFERENCES public.subscription_offers(id) ON DELETE RESTRICT,
  co_subscription_id UUID REFERENCES public.co_subscriptions(id) ON DELETE RESTRICT,
  dispute_id UUID,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CHECK (
    (context_type = 'offer_context' AND offer_id IS NOT NULL AND co_subscription_id IS NULL AND dispute_id IS NULL) OR
    (context_type = 'participation_context' AND co_subscription_id IS NOT NULL AND dispute_id IS NULL) OR
    (context_type = 'dispute_context' AND dispute_id IS NOT NULL)
  )
);

CREATE INDEX idx_conversations_offer ON public.conversations(offer_id);
CREATE INDEX idx_conversations_cosub ON public.conversations(co_subscription_id);
CREATE INDEX idx_conversations_dispute ON public.conversations(dispute_id);

-- =====================================================
-- CONVERSATION_PARTICIPANTS
-- =====================================================

CREATE TABLE public.conversation_participants (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  conversation_id UUID NOT NULL REFERENCES public.conversations(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE RESTRICT,
  joined_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  left_at TIMESTAMPTZ,
  UNIQUE (conversation_id, user_id)
);

CREATE INDEX idx_conv_participants_user ON public.conversation_participants(user_id);

-- =====================================================
-- MESSAGES
-- =====================================================

CREATE TABLE public.messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  conversation_id UUID NOT NULL REFERENCES public.conversations(id) ON DELETE CASCADE,
  sender_user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE RESTRICT,
  body TEXT NOT NULL,
  message_status public.message_status NOT NULL DEFAULT 'sent',
  hidden_by_admin_user_id UUID REFERENCES public.users(id),
  hidden_at TIMESTAMPTZ,
  deleted_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_messages_conversation ON public.messages(conversation_id);
CREATE INDEX idx_messages_sender ON public.messages(sender_user_id);

-- =====================================================
-- DISPUTES
-- =====================================================

CREATE TABLE public.disputes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  co_subscription_id UUID NOT NULL REFERENCES public.co_subscriptions(id) ON DELETE RESTRICT,
  opened_by_user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE RESTRICT,
  dispute_status public.dispute_status NOT NULL DEFAULT 'open',
  reason TEXT NOT NULL,
  resolution_note TEXT,
  resolved_by_admin_user_id UUID REFERENCES public.users(id),
  resolved_at TIMESTAMPTZ,
  closed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_disputes_cosub ON public.disputes(co_subscription_id);
CREATE INDEX idx_disputes_status ON public.disputes(dispute_status);

ALTER TABLE public.conversations
  ADD CONSTRAINT conversations_dispute_fk
  FOREIGN KEY (dispute_id) REFERENCES public.disputes(id) ON DELETE RESTRICT;

-- =====================================================
-- NOTIFICATIONS
-- =====================================================

CREATE TABLE public.notifications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  notification_type public.notification_type NOT NULL,
  payload JSONB NOT NULL DEFAULT '{}'::jsonb,
  read_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_notifications_user ON public.notifications(user_id);
CREATE INDEX idx_notifications_unread ON public.notifications(user_id, created_at DESC) WHERE read_at IS NULL;

-- =====================================================
-- AUDIT_LOGS
-- =====================================================

CREATE TABLE public.audit_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  actor_user_id UUID REFERENCES public.users(id) ON DELETE SET NULL,
  actor_type public.actor_type NOT NULL,
  action_type TEXT NOT NULL,
  entity_type TEXT NOT NULL,
  entity_id UUID,
  previous_value JSONB,
  new_value JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_audit_entity ON public.audit_logs(entity_type, entity_id);
CREATE INDEX idx_audit_actor ON public.audit_logs(actor_user_id);
CREATE INDEX idx_audit_created ON public.audit_logs(created_at DESC);

-- =====================================================
-- CONSENT_RECORDS
-- =====================================================

CREATE TABLE public.consent_records (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  consent_type public.consent_type NOT NULL,
  granted_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  revoked_at TIMESTAMPTZ,
  version TEXT NOT NULL DEFAULT '1.0'
);

CREATE INDEX idx_consents_user ON public.consent_records(user_id);

-- =====================================================
-- DELETION_REQUESTS
-- =====================================================

CREATE TABLE public.deletion_requests (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  request_status public.deletion_request_status NOT NULL DEFAULT 'requested',
  reason TEXT,
  rejection_reason TEXT,
  requested_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  processed_at TIMESTAMPTZ,
  processed_by_admin_user_id UUID REFERENCES public.users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_deletion_user ON public.deletion_requests(user_id);
CREATE INDEX idx_deletion_status ON public.deletion_requests(request_status);

-- =====================================================
-- AUTH TRIGGER : création automatique users + profile + consent
-- =====================================================

CREATE OR REPLACE FUNCTION public.handle_new_auth_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
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

  INSERT INTO public.user_profiles (user_id, display_name)
  VALUES (NEW.id, v_display_name);

  INSERT INTO public.consent_records (user_id, consent_type)
  VALUES
    (NEW.id, 'terms_of_service'),
    (NEW.id, 'privacy_policy'),
    (NEW.id, 'cookies_essential');

  INSERT INTO public.audit_logs (actor_user_id, actor_type, action_type, entity_type, entity_id, new_value)
  VALUES (
    NEW.id, 'user', 'user_created', 'users', NEW.id,
    jsonb_build_object('account_status', 'pending_verification')
  );

  RETURN NEW;
END;
$$;

CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_auth_user();

-- Trigger : mise à jour du statut quand l'email est vérifié
CREATE OR REPLACE FUNCTION public.handle_auth_email_confirmed()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
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

    INSERT INTO public.audit_logs (actor_user_id, actor_type, action_type, entity_type, entity_id, new_value)
    VALUES (
      NEW.id, 'user', 'email_verified', 'users', NEW.id,
      jsonb_build_object('email_verified_at', NEW.email_confirmed_at)
    );
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER on_auth_user_email_confirmed
  AFTER UPDATE ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_auth_email_confirmed();

-- =====================================================
-- ROW LEVEL SECURITY
-- =====================================================

ALTER TABLE public.users ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.admin_users ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.subscription_categories ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.subscription_services ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.subscription_offers ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.co_subscriptions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.payment_records ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.conversations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.conversation_participants ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.disputes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.audit_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.consent_records ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.deletion_requests ENABLE ROW LEVEL SECURITY;

-- USERS : chacun voit son propre enregistrement ; super_admin voit tout
CREATE POLICY "users_select_own" ON public.users
  FOR SELECT TO authenticated
  USING (id = auth.uid() OR public.is_any_admin(auth.uid()));

-- USER_PROFILES : profils visibles par leur propriétaire ; lecture publique du display_name limitée via vues applicatives plus tard
CREATE POLICY "profiles_select_own" ON public.user_profiles
  FOR SELECT TO authenticated
  USING (user_id = auth.uid() OR public.is_any_admin(auth.uid()));

CREATE POLICY "profiles_update_own" ON public.user_profiles
  FOR UPDATE TO authenticated
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

-- ADMIN_USERS : seuls super_admin peuvent voir et gérer
CREATE POLICY "admin_users_select_super" ON public.admin_users
  FOR SELECT TO authenticated
  USING (public.has_admin_role(auth.uid(), 'super_admin'));

-- CATEGORIES / SERVICES : lecture publique (referentiel)
CREATE POLICY "categories_select_public" ON public.subscription_categories
  FOR SELECT TO anon, authenticated
  USING (is_active = true OR public.is_any_admin(auth.uid()));

CREATE POLICY "services_select_public" ON public.subscription_services
  FOR SELECT TO anon, authenticated
  USING (is_active = true OR public.is_any_admin(auth.uid()));

-- OFFERS : marketplace publique uniquement active+public+slots>0+owner active
CREATE POLICY "offers_select_marketplace" ON public.subscription_offers
  FOR SELECT TO anon, authenticated
  USING (
    (offer_status = 'active'
      AND visibility = 'public'
      AND available_slots > 0
      AND EXISTS (
        SELECT 1 FROM public.users u
        WHERE u.id = subscription_offers.owner_user_id
          AND u.account_status = 'active'
          AND u.deleted_at IS NULL
      ))
    OR owner_user_id = auth.uid()
    OR public.is_any_admin(auth.uid())
  );

-- CO_SUBSCRIPTIONS : visibles au propriétaire et au co-abonné, et admins selon rôle
CREATE POLICY "cosub_select_parties" ON public.co_subscriptions
  FOR SELECT TO authenticated
  USING (
    owner_user_id = auth.uid()
    OR subscriber_user_id = auth.uid()
    OR public.is_any_admin(auth.uid())
  );

-- PAYMENT_RECORDS : visibles aux deux parties de la participation associée + admins
CREATE POLICY "payments_select_parties" ON public.payment_records
  FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.co_subscriptions cs
      WHERE cs.id = payment_records.co_subscription_id
        AND (cs.owner_user_id = auth.uid() OR cs.subscriber_user_id = auth.uid())
    )
    OR public.is_any_admin(auth.uid())
  );

-- CONVERSATIONS : visibles aux participants
CREATE POLICY "conversations_select_participant" ON public.conversations
  FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.conversation_participants cp
      WHERE cp.conversation_id = conversations.id
        AND cp.user_id = auth.uid()
    )
    OR public.is_any_admin(auth.uid())
  );

-- CONVERSATION_PARTICIPANTS
CREATE POLICY "conv_participants_select" ON public.conversation_participants
  FOR SELECT TO authenticated
  USING (
    user_id = auth.uid()
    OR EXISTS (
      SELECT 1 FROM public.conversation_participants cp2
      WHERE cp2.conversation_id = conversation_participants.conversation_id
        AND cp2.user_id = auth.uid()
    )
    OR public.is_any_admin(auth.uid())
  );

-- MESSAGES : visibles aux participants de la conversation
CREATE POLICY "messages_select_participants" ON public.messages
  FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.conversation_participants cp
      WHERE cp.conversation_id = messages.conversation_id
        AND cp.user_id = auth.uid()
    )
    OR public.is_any_admin(auth.uid())
  );

-- DISPUTES : visibles aux deux parties de la participation et aux admins support/super
CREATE POLICY "disputes_select_parties" ON public.disputes
  FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.co_subscriptions cs
      WHERE cs.id = disputes.co_subscription_id
        AND (cs.owner_user_id = auth.uid() OR cs.subscriber_user_id = auth.uid())
    )
    OR public.is_any_admin(auth.uid())
  );

-- NOTIFICATIONS : strictement personnelles
CREATE POLICY "notifications_select_own" ON public.notifications
  FOR SELECT TO authenticated
  USING (user_id = auth.uid());

CREATE POLICY "notifications_update_own_read" ON public.notifications
  FOR UPDATE TO authenticated
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

-- AUDIT_LOGS : aucune lecture pour utilisateurs ; super_admin uniquement
CREATE POLICY "audit_select_super_admin" ON public.audit_logs
  FOR SELECT TO authenticated
  USING (public.has_admin_role(auth.uid(), 'super_admin'));

-- CONSENT_RECORDS : strictement personnels
CREATE POLICY "consents_select_own" ON public.consent_records
  FOR SELECT TO authenticated
  USING (user_id = auth.uid() OR public.is_any_admin(auth.uid()));

-- DELETION_REQUESTS : utilisateur voit la sienne ; super_admin voit toutes
CREATE POLICY "deletion_select_own" ON public.deletion_requests
  FOR SELECT TO authenticated
  USING (
    user_id = auth.uid()
    OR public.has_admin_role(auth.uid(), 'super_admin')
  );

-- NOTE : les politiques INSERT/UPDATE/DELETE pour ces tables sont volontairement
-- absentes du MVP côté client. Toutes les écritures passeront par des server functions
-- (createServerFn) avec le client admin (service role) qui gère explicitement les
-- contrôles métier, transitions de statut, audit et notifications.
-- Cela garantit que l'UI ne peut jamais déclencher une transition non autorisée.

-- =====================================================
-- FIN DE LA MIGRATION PHASE 1
-- =====================================================
