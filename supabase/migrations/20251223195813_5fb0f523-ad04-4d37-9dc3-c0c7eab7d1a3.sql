-- Add new fields to companies table for CRM Intelligence
ALTER TABLE public.companies 
ADD COLUMN IF NOT EXISTS is_current_client boolean DEFAULT false,
ADD COLUMN IF NOT EXISTS hq_address text,
ADD COLUMN IF NOT EXISTS primary_contact_id uuid REFERENCES public.contacts(id) ON DELETE SET NULL;

-- Create license_purchases table for tracking multiple purchase dates
CREATE TABLE public.license_purchases (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id uuid NOT NULL,
  company_id uuid NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  selling_option_id uuid REFERENCES public.selling_options(id) ON DELETE SET NULL,
  purchase_date date NOT NULL,
  notes text,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now()
);

-- Enable RLS on license_purchases
ALTER TABLE public.license_purchases ENABLE ROW LEVEL SECURITY;

-- Create RLS policies for license_purchases
CREATE POLICY "Users can view their own license purchases" 
ON public.license_purchases 
FOR SELECT 
USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own license purchases" 
ON public.license_purchases 
FOR INSERT 
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own license purchases" 
ON public.license_purchases 
FOR UPDATE 
USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own license purchases" 
ON public.license_purchases 
FOR DELETE 
USING (auth.uid() = user_id);

-- Add trigger for updated_at
CREATE TRIGGER update_license_purchases_updated_at
BEFORE UPDATE ON public.license_purchases
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();