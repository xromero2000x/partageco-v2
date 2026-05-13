CREATE OR REPLACE FUNCTION public.touch_subscription_service_plans_updated_at()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION public.check_offer_service_plan_consistency()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public
AS $$
DECLARE
  v_plan_service UUID;
BEGIN
  IF NEW.service_plan_id IS NULL THEN
    RETURN NEW;
  END IF;
  SELECT service_id INTO v_plan_service
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

REVOKE EXECUTE ON FUNCTION public.touch_subscription_service_plans_updated_at() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.check_offer_service_plan_consistency() FROM PUBLIC, anon, authenticated;
