-- Create permits table
CREATE TABLE public.permits (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  api TEXT NOT NULL,
  operator TEXT NOT NULL,
  operator_number TEXT,
  lat NUMERIC NOT NULL,
  lon NUMERIC NOT NULL,
  county TEXT,
  section TEXT,
  township TEXT,
  range TEXT,
  well_name TEXT,
  well_number TEXT,
  well_type TEXT,
  well_status TEXT,
  well_class TEXT,
  formation_name TEXT,
  formation_code TEXT,
  formation_depth NUMERIC,
  total_depth NUMERIC,
  measured_total_depth NUMERIC,
  true_vertical_depth NUMERIC,
  permit_type TEXT,
  permit_status TEXT,
  application_type TEXT,
  drill_type TEXT,
  approval_date DATE,
  expire_date DATE,
  submit_date DATE,
  assigned_to TEXT,
  sign_name TEXT,
  city TEXT,
  state TEXT,
  zip_code TEXT,
  image_url TEXT,
  remarks TEXT,
  date_imported DATE NOT NULL DEFAULT CURRENT_DATE,
  dataset_id UUID,
  estimated_value NUMERIC DEFAULT 5000,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create companies table
CREATE TABLE public.companies (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  name TEXT NOT NULL,
  operator_number TEXT,
  permit_count INTEGER DEFAULT 0,
  total_value NUMERIC DEFAULT 0,
  score TEXT DEFAULT 'cold' CHECK (score IN ('hot', 'warm', 'cold')),
  last_permit_date DATE,
  city TEXT,
  state TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create contacts table
CREATE TABLE public.contacts (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  company_id UUID REFERENCES public.companies(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  email TEXT,
  phone TEXT,
  role TEXT,
  notes TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create deals table
CREATE TABLE public.deals (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  company_id UUID REFERENCES public.companies(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  stage TEXT DEFAULT 'new_lead' CHECK (stage IN ('new_lead', 'contacted', 'qualified', 'proposal', 'closed_won', 'closed_lost')),
  value NUMERIC DEFAULT 0,
  expected_close_date DATE,
  status TEXT DEFAULT 'open' CHECK (status IN ('open', 'closed')),
  linked_permit_ids UUID[],
  notes TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create activities table
CREATE TABLE public.activities (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  type TEXT NOT NULL,
  description TEXT NOT NULL,
  company_id UUID REFERENCES public.companies(id) ON DELETE SET NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create datasets table
CREATE TABLE public.datasets (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  name TEXT NOT NULL,
  file_name TEXT,
  permit_count INTEGER DEFAULT 0,
  valid_rows INTEGER DEFAULT 0,
  skipped_rows INTEGER DEFAULT 0,
  is_active BOOLEAN DEFAULT false,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create indexes for performance
CREATE INDEX idx_permits_user_id ON public.permits(user_id);
CREATE INDEX idx_permits_api ON public.permits(api);
CREATE INDEX idx_permits_operator ON public.permits(operator);
CREATE INDEX idx_permits_approval_date ON public.permits(approval_date);
CREATE INDEX idx_permits_dataset_id ON public.permits(dataset_id);
CREATE INDEX idx_companies_user_id ON public.companies(user_id);
CREATE INDEX idx_companies_name ON public.companies(name);
CREATE INDEX idx_contacts_company_id ON public.contacts(company_id);
CREATE INDEX idx_deals_company_id ON public.deals(company_id);
CREATE INDEX idx_activities_company_id ON public.activities(company_id);

-- Enable Row Level Security
ALTER TABLE public.permits ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.companies ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.contacts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.deals ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.activities ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.datasets ENABLE ROW LEVEL SECURITY;

-- RLS Policies for permits
CREATE POLICY "Users can view their own permits" ON public.permits FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can insert their own permits" ON public.permits FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update their own permits" ON public.permits FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Users can delete their own permits" ON public.permits FOR DELETE USING (auth.uid() = user_id);

-- RLS Policies for companies
CREATE POLICY "Users can view their own companies" ON public.companies FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can insert their own companies" ON public.companies FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update their own companies" ON public.companies FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Users can delete their own companies" ON public.companies FOR DELETE USING (auth.uid() = user_id);

-- RLS Policies for contacts
CREATE POLICY "Users can view their own contacts" ON public.contacts FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can insert their own contacts" ON public.contacts FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update their own contacts" ON public.contacts FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Users can delete their own contacts" ON public.contacts FOR DELETE USING (auth.uid() = user_id);

-- RLS Policies for deals
CREATE POLICY "Users can view their own deals" ON public.deals FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can insert their own deals" ON public.deals FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update their own deals" ON public.deals FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Users can delete their own deals" ON public.deals FOR DELETE USING (auth.uid() = user_id);

-- RLS Policies for activities
CREATE POLICY "Users can view their own activities" ON public.activities FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can insert their own activities" ON public.activities FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update their own activities" ON public.activities FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Users can delete their own activities" ON public.activities FOR DELETE USING (auth.uid() = user_id);

-- RLS Policies for datasets
CREATE POLICY "Users can view their own datasets" ON public.datasets FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can insert their own datasets" ON public.datasets FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update their own datasets" ON public.datasets FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Users can delete their own datasets" ON public.datasets FOR DELETE USING (auth.uid() = user_id);

-- Create updated_at trigger function
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SET search_path = public;

-- Add trigger for companies updated_at
CREATE TRIGGER update_companies_updated_at
  BEFORE UPDATE ON public.companies
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();