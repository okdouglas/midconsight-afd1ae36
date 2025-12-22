-- Create selling_options table for product catalog
CREATE TABLE public.selling_options (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  name TEXT NOT NULL,
  category TEXT NOT NULL DEFAULT 'Standard Packages',
  type TEXT NOT NULL DEFAULT 'Network',
  description TEXT,
  default_price NUMERIC NOT NULL DEFAULT 0,
  annual_rental NUMERIC,
  annual_maintenance NUMERIC,
  trigger_type TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable Row Level Security
ALTER TABLE public.selling_options ENABLE ROW LEVEL SECURITY;

-- Create policies for user access
CREATE POLICY "Users can view their own selling options" 
ON public.selling_options 
FOR SELECT 
USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own selling options" 
ON public.selling_options 
FOR INSERT 
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own selling options" 
ON public.selling_options 
FOR UPDATE 
USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own selling options" 
ON public.selling_options 
FOR DELETE 
USING (auth.uid() = user_id);

-- Create trigger for automatic timestamp updates
CREATE TRIGGER update_selling_options_updated_at
BEFORE UPDATE ON public.selling_options
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

-- Add selling_option_id column to deals table to track which product was sold
ALTER TABLE public.deals
ADD COLUMN selling_option_id UUID REFERENCES public.selling_options(id) ON DELETE SET NULL;