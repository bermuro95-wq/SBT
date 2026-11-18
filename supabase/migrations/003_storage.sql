-- Create buckets in Dashboard if needed: avatars (public), receipts (private)
-- Storage policies example (run after buckets exist):

-- INSERT INTO storage.buckets (id, name, public) VALUES ('avatars', 'avatars', true)
-- ON CONFLICT (id) DO NOTHING;
-- INSERT INTO storage.buckets (id, name, public) VALUES ('receipts', 'receipts', false)
-- ON CONFLICT (id) DO NOTHING;

-- CREATE POLICY avatar_read ON storage.objects FOR SELECT TO authenticated
--   USING (bucket_id = 'avatars');
-- CREATE POLICY avatar_write ON storage.objects FOR INSERT TO authenticated
--   WITH CHECK (bucket_id = 'avatars');
-- CREATE POLICY receipts_read ON storage.objects FOR SELECT TO authenticated
--   USING (bucket_id = 'receipts');
-- CREATE POLICY receipts_write ON storage.objects FOR INSERT TO authenticated
--   WITH CHECK (bucket_id = 'receipts');
