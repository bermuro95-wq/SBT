
CREATE TABLE IF NOT EXISTS public.audit_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  action TEXT,
  entity TEXT,
  entity_id TEXT,
  user_id UUID,
  result TEXT DEFAULT 'success',
  old_value JSONB,
  new_value JSONB,
  metadata JSONB,
  user_agent TEXT,
  timestamp TIMESTAMPTZ DEFAULT NOW(),
  created_at TIMESTAMPTZ DEFAULT NOW()
);
ALTER TABLE public.audit_logs DISABLE ROW LEVEL SECURITY;

CREATE TABLE IF NOT EXISTS public.memos (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  body TEXT NOT NULL,
  author_id UUID,
  author_name TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);
ALTER TABLE public.memos DISABLE ROW LEVEL SECURITY;

CREATE TABLE IF NOT EXISTS public.payment_methods (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT UNIQUE
);
INSERT INTO public.payment_methods (name) VALUES
('Cash'),('Bank Transfer'),('Cheque'),('Mobile Money')
ON CONFLICT (name) DO NOTHING;
