-- Add probability percentage to deals for weighted revenue calculations
ALTER TABLE public.deals ADD COLUMN probability integer DEFAULT 10 CHECK (probability IN (10, 30, 60, 90, 100));

-- Note: 100 will be used for both won (100-won) and lost (100-lost), the stage determines which