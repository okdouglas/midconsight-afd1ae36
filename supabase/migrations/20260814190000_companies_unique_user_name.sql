-- Supports promoteCompanyPreview()'s upsert (onConflict: 'user_id,name'),
-- which turns a client-side preview company (built from the shared permit
-- feed) into a real row the first time a user acts on it.
ALTER TABLE public.companies
ADD CONSTRAINT companies_user_id_name_key UNIQUE (user_id, name);
