
ALTER TABLE public.profiles DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS avatar_url TEXT;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS email TEXT;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS full_name TEXT;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS role TEXT;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS status TEXT DEFAULT 'active';
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS auth_id UUID;
CREATE UNIQUE INDEX IF NOT EXISTS profiles_auth_id_uidx ON public.profiles(auth_id);
CREATE UNIQUE INDEX IF NOT EXISTS profiles_email_uidx ON public.profiles(email);

ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS profiles_all ON public.profiles;
CREATE POLICY profiles_all ON public.profiles FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- Allow users to update own avatar
DROP POLICY IF EXISTS profiles_update_own ON public.profiles;
CREATE POLICY profiles_update_own ON public.profiles FOR UPDATE TO authenticated
  USING (true) WITH CHECK (true);
