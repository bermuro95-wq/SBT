
CREATE TABLE IF NOT EXISTS public.approvals (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  transaction_id UUID,
  transaction_type TEXT,
  submitted_by UUID,
  submitted_date TIMESTAMPTZ,
  reviewed_by UUID,
  reviewed_date TIMESTAMPTZ,
  decision TEXT,
  reason TEXT,
  previous_status TEXT,
  new_status TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);
ALTER TABLE public.approvals ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS approvals_all ON public.approvals;
CREATE POLICY approvals_all ON public.approvals FOR ALL TO authenticated USING (true) WITH CHECK (true);

CREATE TABLE IF NOT EXISTS public.notifications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID,
  title TEXT,
  message TEXT,
  type TEXT DEFAULT 'info',
  is_read BOOLEAN DEFAULT FALSE,
  link TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);
ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS notifications_all ON public.notifications;
CREATE POLICY notifications_all ON public.notifications FOR ALL TO authenticated USING (true) WITH CHECK (true);

CREATE TABLE IF NOT EXISTS public.audit_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id TEXT,
  user_id UUID,
  action TEXT,
  entity TEXT,
  entity_id TEXT,
  old_value JSONB,
  new_value JSONB,
  metadata JSONB,
  result TEXT,
  user_agent TEXT,
  timestamp TIMESTAMPTZ DEFAULT NOW()
);
ALTER TABLE public.audit_logs ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS audit_all ON public.audit_logs;
CREATE POLICY audit_all ON public.audit_logs FOR ALL TO authenticated USING (true) WITH CHECK (true);

ALTER TABLE public.financial_years ADD COLUMN IF NOT EXISTS opening_balance NUMERIC(15,2) DEFAULT 0;
ALTER TABLE public.financial_years ADD COLUMN IF NOT EXISTS annual_budget NUMERIC(15,2) DEFAULT 0;
