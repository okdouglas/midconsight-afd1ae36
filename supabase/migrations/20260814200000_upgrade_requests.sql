-- Captures upgrade intent while Stripe checkout doesn't exist yet. A dead
-- "Upgrade" button is worse than an honest interest-capture flow — this
-- also gives a real signal (who, how often, from which paywall) to
-- prioritize the actual billing build.

CREATE TABLE public.upgrade_requests (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  source TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.upgrade_requests ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can create their own upgrade requests"
ON public.upgrade_requests FOR INSERT
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can view their own upgrade requests"
ON public.upgrade_requests FOR SELECT
USING (auth.uid() = user_id);
