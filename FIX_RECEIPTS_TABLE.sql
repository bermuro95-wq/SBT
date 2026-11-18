
CREATE TABLE IF NOT EXISTS public.receipts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  document_id TEXT,
  file_name TEXT,
  file_url TEXT,
  storage_path TEXT,
  file_type TEXT,
  file_size BIGINT,
  document_type TEXT DEFAULT 'receipt',
  transaction_type TEXT,
  transaction_id TEXT,
  income_id UUID,
  expense_id UUID,
  uploaded_by UUID,
  uploaded_by_name TEXT,
  upload_date TIMESTAMPTZ DEFAULT NOW(),
  created_at TIMESTAMPTZ DEFAULT NOW()
);
ALTER TABLE public.receipts ADD COLUMN IF NOT EXISTS uploaded_by_name TEXT;
ALTER TABLE public.receipts ADD COLUMN IF NOT EXISTS uploaded_by UUID;
ALTER TABLE public.receipts ADD COLUMN IF NOT EXISTS file_url TEXT;
ALTER TABLE public.receipts ADD COLUMN IF NOT EXISTS file_name TEXT;
ALTER TABLE public.receipts ADD COLUMN IF NOT EXISTS transaction_type TEXT;
ALTER TABLE public.receipts ADD COLUMN IF NOT EXISTS transaction_id TEXT;
ALTER TABLE public.receipts DISABLE ROW LEVEL SECURITY;
