
-- Storage policies for avatars (run after creating public bucket "avatars")
-- In Dashboard: Storage → New bucket → name: avatars → Public: ON

DROP POLICY IF EXISTS avatars_upload ON storage.objects;
CREATE POLICY avatars_upload ON storage.objects
  FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'avatars');

DROP POLICY IF EXISTS avatars_update ON storage.objects;
CREATE POLICY avatars_update ON storage.objects
  FOR UPDATE TO authenticated
  USING (bucket_id = 'avatars');

DROP POLICY IF EXISTS avatars_read ON storage.objects;
CREATE POLICY avatars_read ON storage.objects
  FOR SELECT TO public
  USING (bucket_id = 'avatars');

ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS avatar_url TEXT;
