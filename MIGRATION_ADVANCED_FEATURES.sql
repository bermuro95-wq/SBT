-- ============================================================
-- Advanced features: memos replies/reactions, backups, audit
-- findings, receipt enforcement helpers. Run in Supabase SQL.
-- ============================================================

-- Memo replies
CREATE TABLE IF NOT EXISTS public.memo_replies (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  memo_id uuid REFERENCES public.memos(id) ON DELETE CASCADE,
  body text NOT NULL,
  author_id uuid,
  author_name text,
  created_at timestamptz DEFAULT now()
);
ALTER TABLE public.memo_replies ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS memo_replies_all ON public.memo_replies;
CREATE POLICY memo_replies_all ON public.memo_replies
  FOR ALL TO authenticated USING (true) WITH CHECK (true);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.memo_replies TO authenticated;

-- Memo reactions
CREATE TABLE IF NOT EXISTS public.memo_reactions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  memo_id uuid REFERENCES public.memos(id) ON DELETE CASCADE,
  user_id uuid,
  emoji text NOT NULL DEFAULT 'like',
  created_at timestamptz DEFAULT now(),
  UNIQUE (memo_id, user_id, emoji)
);
ALTER TABLE public.memo_reactions ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS memo_reactions_all ON public.memo_reactions;
CREATE POLICY memo_reactions_all ON public.memo_reactions
  FOR ALL TO authenticated USING (true) WITH CHECK (true);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.memo_reactions TO authenticated;

-- Data backups (before permanent delete)
CREATE TABLE IF NOT EXISTS public.data_backups (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  label text,
  backup_type text DEFAULT 'manual', -- manual | pre_purge | scheduled
  payload jsonb NOT NULL DEFAULT '{}'::jsonb,
  tables_included text[],
  row_counts jsonb,
  file_size_estimate integer DEFAULT 0,
  integrity_hash text,
  created_by uuid,
  created_by_name text,
  created_at timestamptz DEFAULT now(),
  restored_at timestamptz,
  restored_by uuid,
  status text DEFAULT 'ready' -- ready | restored | failed | expired
);
ALTER TABLE public.data_backups ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS data_backups_select ON public.data_backups;
DROP POLICY IF EXISTS data_backups_write ON public.data_backups;
CREATE POLICY data_backups_select ON public.data_backups
  FOR SELECT TO authenticated USING (true);
CREATE POLICY data_backups_write ON public.data_backups
  FOR ALL TO authenticated USING (true) WITH CHECK (true);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.data_backups TO authenticated;

-- Audit findings / observations module
CREATE TABLE IF NOT EXISTS public.audit_findings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  title text NOT NULL,
  description text,
  finding_type text DEFAULT 'observation', -- observation | risk | control_weakness | recommendation
  severity text DEFAULT 'medium', -- low | medium | high | critical
  status text DEFAULT 'open', -- open | in_progress | resolved | closed
  responsible_person text,
  responsible_department text,
  recommendation text,
  corrective_action text,
  due_date date,
  evidence_urls text[],
  related_entity_type text,
  related_entity_id uuid,
  created_by uuid,
  created_by_name text,
  updated_at timestamptz DEFAULT now(),
  created_at timestamptz DEFAULT now()
);
ALTER TABLE public.audit_findings ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS audit_findings_all ON public.audit_findings;
CREATE POLICY audit_findings_all ON public.audit_findings
  FOR ALL TO authenticated USING (true) WITH CHECK (true);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.audit_findings TO authenticated;

-- system_settings unique on key (fixes upsert)
CREATE UNIQUE INDEX IF NOT EXISTS system_settings_key_uidx ON public.system_settings (key);

-- Prevent updating audit_logs (tamper resistance) — only insert + select + delete for purge
DROP POLICY IF EXISTS audit_logs_update_deny ON public.audit_logs;
-- No UPDATE policy for normal users; leave update blocked by default under RLS

-- Backup access log
CREATE TABLE IF NOT EXISTS public.backup_access_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  backup_id uuid REFERENCES public.data_backups(id) ON DELETE SET NULL,
  action text NOT NULL, -- create | restore | download | delete
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

SELECT 'Advanced features migration complete' AS status;
