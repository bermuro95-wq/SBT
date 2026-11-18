
-- Admin and all authenticated users can READ profiles (needed for Users page + names)
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "profiles_select_authenticated" ON public.profiles;
CREATE POLICY "profiles_select_authenticated"
ON public.profiles FOR SELECT TO authenticated
USING (true);

DROP POLICY IF EXISTS "profiles_update_authenticated" ON public.profiles;
CREATE POLICY "profiles_update_authenticated"
ON public.profiles FOR UPDATE TO authenticated
USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "profiles_insert_authenticated" ON public.profiles;
CREATE POLICY "profiles_insert_authenticated"
ON public.profiles FOR INSERT TO authenticated
WITH CHECK (true);

DROP POLICY IF EXISTS "profiles_delete_authenticated" ON public.profiles;
CREATE POLICY "profiles_delete_authenticated"
ON public.profiles FOR DELETE TO authenticated
USING (true);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.profiles TO authenticated;

-- Ensure your admin row has the correct role (replace email if needed)
UPDATE public.profiles
SET role = 'administrator', status = 'active'
WHERE lower(email) = lower('admin@selambertu.org');
