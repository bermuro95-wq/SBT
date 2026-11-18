
ALTER TABLE public.audit_logs ADD COLUMN IF NOT EXISTS entity TEXT;
ALTER TABLE public.audit_logs ADD COLUMN IF NOT EXISTS entity_id TEXT;
ALTER TABLE public.audit_logs ADD COLUMN IF NOT EXISTS user_id UUID;
ALTER TABLE public.audit_logs ADD COLUMN IF NOT EXISTS user_name TEXT;
ALTER TABLE public.audit_logs ADD COLUMN IF NOT EXISTS result TEXT DEFAULT 'success';
ALTER TABLE public.audit_logs ADD COLUMN IF NOT EXISTS action TEXT;
ALTER TABLE public.audit_logs ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ DEFAULT NOW();
ALTER TABLE public.audit_logs ADD COLUMN IF NOT EXISTS timestamp TIMESTAMPTZ DEFAULT NOW();
ALTER TABLE public.audit_logs DISABLE ROW LEVEL SECURITY;

-- Optional: backfill entity from action for old rows
UPDATE public.audit_logs
SET entity = CASE
  WHEN action ILIKE '%income%' THEN 'income'
  WHEN action ILIKE '%expense%' THEN 'expense'
  WHEN action ILIKE '%approve%' OR action ILIKE '%reject%' THEN 'approval'
  WHEN action ILIKE '%budget%' THEN 'budget'
  ELSE COALESCE(entity, 'system')
END
WHERE entity IS NULL;
