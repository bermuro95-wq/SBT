
-- Profiles avatar column
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS avatar_url TEXT;

-- Allow authenticated users to update profiles (including own photo)
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS profiles_all ON public.profiles;
CREATE POLICY profiles_all ON public.profiles
  FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- Storage bucket for avatars (run in SQL; or create in Dashboard → Storage)
INSERT INTO storage.buckets (id, name, public)
VALUES ('avatars', 'avatars', true)
ON CONFLICT (id) DO UPDATE SET public = true;

DROP POLICY IF EXISTS avatars_public_read ON storage.objects;
CREATE POLICY avatars_public_read ON storage.objects
  FOR SELECT USING (bucket_id = 'avatars');

DROP POLICY IF EXISTS avatars_auth_upload ON storage.objects;
CREATE POLICY avatars_auth_upload ON storage.objects
  FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'avatars');

DROP POLICY IF EXISTS avatars_auth_update ON storage.objects;
CREATE POLICY avatars_auth_update ON storage.objects
  FOR UPDATE TO authenticated
  USING (bucket_id = 'avatars');
