
CREATE TABLE IF NOT EXISTS public.audit_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  action TEXT,
  entity TEXT,
  entity_id TEXT,
  user_id UUID,
  result TEXT DEFAULT 'success',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  timestamp TIMESTAMPTZ DEFAULT NOW()
);
ALTER TABLE public.audit_logs DISABLE ROW LEVEL SECURITY;

-- seed one row so report is not empty
INSERT INTO public.audit_logs (action, entity, result)
VALUES ('SYSTEM_READY', 'system', 'success');
