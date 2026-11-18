
CREATE TABLE IF NOT EXISTS public.audit_evidence (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  reference_code TEXT,
  title TEXT NOT NULL,
  evidence_type TEXT DEFAULT 'document',
  entity TEXT DEFAULT 'general',
  risk_level TEXT DEFAULT 'low',
  status TEXT DEFAULT 'collected',
  description TEXT,
  source_location TEXT,
  file_url TEXT,
  file_name TEXT,
  collected_by UUID,
  collected_by_name TEXT,
  collected_at TIMESTAMPTZ DEFAULT NOW(),
  verified_by_name TEXT,
  verified_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW()
);
ALTER TABLE public.audit_evidence DISABLE ROW LEVEL SECURITY;
