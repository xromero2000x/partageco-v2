
-- Reviews table: one review per co-subscription per reviewer
CREATE TABLE public.reviews (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  co_subscription_id uuid NOT NULL,
  reviewer_user_id uuid NOT NULL,
  reviewee_user_id uuid NOT NULL,
  rating smallint NOT NULL,
  comment text,
  is_published boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (co_subscription_id, reviewer_user_id)
);

-- Validation via trigger (cannot use subqueries in CHECK)
CREATE OR REPLACE FUNCTION public.validate_review()
RETURNS trigger LANGUAGE plpgsql SET search_path = public AS $$
BEGIN
  IF NEW.rating < 1 OR NEW.rating > 5 THEN
    RAISE EXCEPTION 'rating_out_of_range';
  END IF;
  IF NEW.reviewer_user_id = NEW.reviewee_user_id THEN
    RAISE EXCEPTION 'self_review_forbidden';
  END IF;
  IF NEW.comment IS NOT NULL AND length(NEW.comment) > 1000 THEN
    RAISE EXCEPTION 'comment_too_long';
  END IF;
  RETURN NEW;
END $$;

CREATE TRIGGER trg_validate_review
BEFORE INSERT OR UPDATE ON public.reviews
FOR EACH ROW EXECUTE FUNCTION public.validate_review();

CREATE TRIGGER trg_reviews_touch
BEFORE UPDATE ON public.reviews
FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

CREATE INDEX idx_reviews_reviewee ON public.reviews(reviewee_user_id) WHERE is_published = true;
CREATE INDEX idx_reviews_cosub ON public.reviews(co_subscription_id);

ALTER TABLE public.reviews ENABLE ROW LEVEL SECURITY;

-- Public can read published reviews
CREATE POLICY reviews_public_read ON public.reviews
FOR SELECT TO anon, authenticated
USING (is_published = true);

-- Reviewer can see own reviews regardless of state
CREATE POLICY reviews_self_read ON public.reviews
FOR SELECT TO authenticated
USING (reviewer_user_id = auth.uid() OR reviewee_user_id = auth.uid());

-- Add bio + avatar_url to user_profiles for public profile pages
ALTER TABLE public.user_profiles
  ADD COLUMN IF NOT EXISTS bio text,
  ADD COLUMN IF NOT EXISTS avatar_url text;

-- Public read of profiles (display_name, bio, avatar, member info) for marketplace trust
CREATE POLICY profiles_public_read ON public.user_profiles
FOR SELECT TO anon, authenticated
USING (true);
