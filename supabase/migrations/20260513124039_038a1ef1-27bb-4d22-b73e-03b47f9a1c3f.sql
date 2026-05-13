-- Phase 14D — Référentiel administrable des gammes d'abonnement par service

CREATE TABLE public.subscription_service_plans (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  service_id UUID NOT NULL REFERENCES public.subscription_services(id) ON DELETE RESTRICT,
  slug TEXT NOT NULL,
  name TEXT NOT NULL,
  description TEXT NULL,
  sort_order INTEGER NOT NULL DEFAULT 0,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT subscription_service_plans_slug_format
    CHECK (slug ~ '^[a-z0-9_-]+$' AND length(slug) BETWEEN 1 AND 64),
  CONSTRAINT subscription_service_plans_name_length
    CHECK (length(btrim(name)) BETWEEN 1 AND 120),
  CONSTRAINT subscription_service_plans_unique_per_service UNIQUE (service_id, slug)
);

CREATE INDEX idx_subscription_service_plans_service
  ON public.subscription_service_plans(service_id);
CREATE INDEX idx_subscription_service_plans_active
  ON public.subscription_service_plans(service_id, is_active);

ALTER TABLE public.subscription_service_plans ENABLE ROW LEVEL SECURITY;

-- Lecture publique : seulement plans actifs sur services actifs (super_admin voit tout)
CREATE POLICY service_plans_select_public
  ON public.subscription_service_plans
  FOR SELECT
  TO anon, authenticated
  USING (
    (
      is_active = true
      AND EXISTS (
        SELECT 1 FROM public.subscription_services s
        WHERE s.id = subscription_service_plans.service_id AND s.is_active = true
      )
    )
    OR public.is_any_admin(auth.uid())
  );

-- Aucune policy d'écriture client : les écritures passent par des server functions
-- exécutées avec le client admin (service role) qui bypass RLS, gardé par contrôle super_admin.

-- Trigger updated_at
CREATE OR REPLACE FUNCTION public.touch_subscription_service_plans_updated_at()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_subscription_service_plans_updated_at
  BEFORE UPDATE ON public.subscription_service_plans
  FOR EACH ROW
  EXECUTE FUNCTION public.touch_subscription_service_plans_updated_at();

-- Lien offre <-> gamme
ALTER TABLE public.subscription_offers
  ADD COLUMN service_plan_id UUID NULL REFERENCES public.subscription_service_plans(id) ON DELETE RESTRICT;

CREATE INDEX idx_subscription_offers_service_plan
  ON public.subscription_offers(service_plan_id);

-- Contrainte d'intégrité : la gamme doit appartenir au service de l'offre
CREATE OR REPLACE FUNCTION public.check_offer_service_plan_consistency()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = public
AS $$
DECLARE
  v_plan_service UUID;
  v_plan_active BOOLEAN;
BEGIN
  IF NEW.service_plan_id IS NULL THEN
    RETURN NEW;
  END IF;

  SELECT service_id, is_active
    INTO v_plan_service, v_plan_active
    FROM public.subscription_service_plans
   WHERE id = NEW.service_plan_id;

  IF v_plan_service IS NULL THEN
    RAISE EXCEPTION 'service_plan_not_found';
  END IF;

  IF v_plan_service <> NEW.service_id THEN
    RAISE EXCEPTION 'service_plan_service_mismatch';
  END IF;

  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_subscription_offers_check_plan
  BEFORE INSERT OR UPDATE OF service_plan_id, service_id
  ON public.subscription_offers
  FOR EACH ROW
  EXECUTE FUNCTION public.check_offer_service_plan_consistency();
