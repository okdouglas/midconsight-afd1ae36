-- Research Desk status was previously stored in browser localStorage only,
-- meaning it never synced across devices/team members and was lost on
-- clearing browser data. This moves it server-side.

CREATE TABLE public.operator_research_status (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  operator TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'new' CHECK (status IN ('new', 'researching', 'verified', 'current_client', 'archived')),
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE (user_id, operator)
);

ALTER TABLE public.operator_research_status ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own research status"
ON public.operator_research_status
FOR SELECT
USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own research status"
ON public.operator_research_status
FOR INSERT
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own research status"
ON public.operator_research_status
FOR UPDATE
USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own research status"
ON public.operator_research_status
FOR DELETE
USING (auth.uid() = user_id);

CREATE TRIGGER update_operator_research_status_updated_at
BEFORE UPDATE ON public.operator_research_status
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

CREATE INDEX idx_operator_research_status_user_operator
ON public.operator_research_status (user_id, operator);
