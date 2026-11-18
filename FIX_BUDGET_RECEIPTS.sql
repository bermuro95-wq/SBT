
-- Budget + Receipts DB support
ALTER TABLE budgets ADD COLUMN IF NOT EXISTS budget_amount NUMERIC(15,2);
ALTER TABLE budgets ADD COLUMN IF NOT EXISTS allocated_amount NUMERIC(15,2);
ALTER TABLE budgets ADD COLUMN IF NOT EXISTS notes TEXT;
ALTER TABLE budgets ADD COLUMN IF NOT EXISTS category_id UUID;
ALTER TABLE budgets ADD COLUMN IF NOT EXISTS financial_year_id UUID;

CREATE TABLE IF NOT EXISTS receipts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  document_id TEXT,
  income_id UUID,
  expense_id UUID,
  file_name TEXT,
  file_url TEXT,
  file_type TEXT,
  file_size INTEGER,
  document_type TEXT DEFAULT 'receipt',
  transaction_type TEXT,
  financial_year_id UUID,
  uploaded_by UUID,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE receipts ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS receipts_all ON receipts;
CREATE POLICY receipts_all ON receipts FOR ALL TO authenticated USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS budgets_all ON budgets;
CREATE POLICY budgets_all ON budgets FOR ALL TO authenticated USING (true) WITH CHECK (true);

INSERT INTO financial_years (name, start_date, end_date, status)
SELECT '2026 Financial Year', '2026-01-01', '2026-12-31', 'open'
WHERE NOT EXISTS (SELECT 1 FROM financial_years WHERE status = 'open');

INSERT INTO expense_categories (name) VALUES
('Office'),('Transportation'),('Food'),('Utilities'),('Other')
ON CONFLICT (name) DO NOTHING;
