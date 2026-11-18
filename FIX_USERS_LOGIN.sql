
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS last_login TIMESTAMPTZ;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS role TEXT;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS status TEXT DEFAULT 'active';
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS full_name TEXT;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS email TEXT;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS auth_id UUID;

DROP POLICY IF EXISTS profiles_all ON public.profiles;
CREATE POLICY profiles_all ON public.profiles FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- Unique auth_id for upsert
CREATE UNIQUE INDEX IF NOT EXISTS profiles_auth_id_uidx ON public.profiles(auth_id);
