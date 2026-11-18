-- Create backup tables required by Settings → Backup & Recovery
-- Run once in Supabase SQL Editor as project owner

CREATE TABLE IF NOT EXISTS public.data_backups (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  label text,
  backup_type text DEFAULT 'manual',
  payload jsonb,
  tables_included text[],
  row_counts jsonb,
  file_size_estimate bigint,
  integrity_hash text,
  created_by uuid,
  created_by_name text,
  status text DEFAULT 'ready',
  created_at timestamptz DEFAULT now()
);

ALTER TABLE public.data_backups ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS data_backups_select ON public.data_backups;
DROP POLICY IF EXISTS data_backups_write ON public.data_backups;

CREATE POLICY data_backups_select ON public.data_backups
  FOR SELECT TO authenticated USING (true);

CREATE POLICY data_backups_write ON public.data_backups
  FOR ALL TO authenticated USING (true) WITH CHECK (true);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.data_backups TO authenticated;

CREATE TABLE IF NOT EXISTS public.backup_access_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  backup_id uuid REFERENCES public.data_backups(id) ON DELETE SET NULL,
  action text,
  performed_by uuid,
  performed_by_name text,
  details text,
  created_at timestamptz DEFAULT now()
);

ALTER TABLE public.backup_access_logs ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS backup_access_logs_all ON public.backup_access_logs;
CREATE POLICY backup_access_logs_all ON public.backup_access_logs
  FOR ALL TO authenticated USING (true) WITH CHECK (true);
GRANT SELECT, INSERT ON public.backup_access_logs TO authenticated;

-- Optional: ensure audit_logs exists for activity feed
CREATE TABLE IF NOT EXISTS public.audit_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  action text,
  entity_type text,
  entity_id text,
  user_id uuid,
  user_name text,
  details jsonb,
  created_at timestamptz DEFAULT now()
);
ALTER TABLE public.audit_logs ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS audit_logs_select ON public.audit_logs;
CREATE POLICY audit_logs_select ON public.audit_logs
  FOR SELECT TO authenticated USING (true);
DROP POLICY IF EXISTS audit_logs_insert ON public.audit_logs;
CREATE POLICY audit_logs_insert ON public.audit_logs
  FOR INSERT TO authenticated WITH CHECK (true);
GRANT SELECT, INSERT ON public.audit_logs TO authenticated;
