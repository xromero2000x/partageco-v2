
-- 1) Triggers on auth.users
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
AFTER INSERT ON auth.users
FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

DROP TRIGGER IF EXISTS on_auth_user_email_confirmed ON auth.users;
CREATE TRIGGER on_auth_user_email_confirmed
AFTER UPDATE OF email_confirmed_at ON auth.users
FOR EACH ROW EXECUTE FUNCTION public.handle_email_confirmed();

-- 2) RLS read policies

-- Catalogue public
ALTER TABLE public.subscription_categories ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS categories_public_read ON public.subscription_categories;
CREATE POLICY categories_public_read ON public.subscription_categories
  FOR SELECT TO anon, authenticated USING (is_active = true);

ALTER TABLE public.subscription_services ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS services_public_read ON public.subscription_services;
CREATE POLICY services_public_read ON public.subscription_services
  FOR SELECT TO anon, authenticated USING (is_active = true);

ALTER TABLE public.subscription_service_plans ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS plans_public_read ON public.subscription_service_plans;
CREATE POLICY plans_public_read ON public.subscription_service_plans
  FOR SELECT TO anon, authenticated USING (is_active = true);

-- Offres
ALTER TABLE public.subscription_offers ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS offers_public_read ON public.subscription_offers;
CREATE POLICY offers_public_read ON public.subscription_offers
  FOR SELECT TO anon, authenticated
  USING (offer_status = 'active' AND visibility = 'public' AND available_slots > 0);

DROP POLICY IF EXISTS offers_owner_read ON public.subscription_offers;
CREATE POLICY offers_owner_read ON public.subscription_offers
  FOR SELECT TO authenticated USING (owner_user_id = auth.uid());

DROP POLICY IF EXISTS offers_admin_read ON public.subscription_offers;
CREATE POLICY offers_admin_read ON public.subscription_offers
  FOR SELECT TO authenticated
  USING (
    public.has_admin_role(auth.uid(), 'moderation_admin') OR
    public.has_admin_role(auth.uid(), 'super_admin') OR
    public.has_admin_role(auth.uid(), 'support_admin')
  );

-- Co-subscriptions
ALTER TABLE public.co_subscriptions ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS cosub_party_read ON public.co_subscriptions;
CREATE POLICY cosub_party_read ON public.co_subscriptions
  FOR SELECT TO authenticated
  USING (
    subscriber_user_id = auth.uid() OR
    owner_user_id = auth.uid() OR
    public.has_admin_role(auth.uid(), 'moderation_admin') OR
    public.has_admin_role(auth.uid(), 'super_admin') OR
    public.has_admin_role(auth.uid(), 'support_admin')
  );

-- Conversations & participants
ALTER TABLE public.conversation_participants ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS convparts_self_read ON public.conversation_participants;
CREATE POLICY convparts_self_read ON public.conversation_participants
  FOR SELECT TO authenticated
  USING (
    user_id = auth.uid() OR
    public.has_admin_role(auth.uid(), 'moderation_admin') OR
    public.has_admin_role(auth.uid(), 'super_admin')
  );

ALTER TABLE public.conversations ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS conv_member_read ON public.conversations;
CREATE POLICY conv_member_read ON public.conversations
  FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.conversation_participants p
      WHERE p.conversation_id = conversations.id AND p.user_id = auth.uid()
    ) OR
    public.has_admin_role(auth.uid(), 'moderation_admin') OR
    public.has_admin_role(auth.uid(), 'super_admin')
  );

ALTER TABLE public.messages ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS messages_member_read ON public.messages;
CREATE POLICY messages_member_read ON public.messages
  FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.conversation_participants p
      WHERE p.conversation_id = messages.conversation_id AND p.user_id = auth.uid()
    ) OR
    public.has_admin_role(auth.uid(), 'moderation_admin') OR
    public.has_admin_role(auth.uid(), 'super_admin')
  );

-- Payments
ALTER TABLE public.payment_records ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS payments_party_read ON public.payment_records;
CREATE POLICY payments_party_read ON public.payment_records
  FOR SELECT TO authenticated
  USING (
    payer_user_id = auth.uid() OR
    payee_user_id = auth.uid() OR
    public.has_admin_role(auth.uid(), 'super_admin') OR
    public.has_admin_role(auth.uid(), 'support_admin')
  );

-- Disputes
ALTER TABLE public.disputes ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS disputes_party_read ON public.disputes;
CREATE POLICY disputes_party_read ON public.disputes
  FOR SELECT TO authenticated
  USING (
    opened_by_user_id = auth.uid() OR
    EXISTS (
      SELECT 1 FROM public.co_subscriptions c
      WHERE c.id = disputes.co_subscription_id
        AND (c.subscriber_user_id = auth.uid() OR c.owner_user_id = auth.uid())
    ) OR
    public.has_admin_role(auth.uid(), 'moderation_admin') OR
    public.has_admin_role(auth.uid(), 'super_admin')
  );

-- Deletion requests
ALTER TABLE public.deletion_requests ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS deletion_self_read ON public.deletion_requests;
CREATE POLICY deletion_self_read ON public.deletion_requests
  FOR SELECT TO authenticated
  USING (
    user_id = auth.uid() OR
    public.has_admin_role(auth.uid(), 'super_admin')
  );

-- Audit logs & admin users (super admin only)
ALTER TABLE public.audit_logs ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS audit_super_read ON public.audit_logs;
CREATE POLICY audit_super_read ON public.audit_logs
  FOR SELECT TO authenticated
  USING (public.has_admin_role(auth.uid(), 'super_admin'));

ALTER TABLE public.admin_users ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS admins_super_read ON public.admin_users;
CREATE POLICY admins_super_read ON public.admin_users
  FOR SELECT TO authenticated
  USING (public.has_admin_role(auth.uid(), 'super_admin'));
