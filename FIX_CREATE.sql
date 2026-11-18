-- Fix create income/expense/budget support

ALTER TABLE income ADD COLUMN IF NOT EXISTS is_deleted BOOLEAN DEFAULT FALSE;
ALTER TABLE income ADD COLUMN IF NOT EXISTS description TEXT;
ALTER TABLE income ADD COLUMN IF NOT EXISTS reference_number TEXT;
ALTER TABLE income ADD COLUMN IF NOT EXISTS transaction_id TEXT;
ALTER TABLE expenses ADD COLUMN IF NOT EXISTS is_deleted BOOLEAN DEFAULT FALSE;
ALTER TABLE expenses ADD COLUMN IF NOT EXISTS description TEXT;
ALTER TABLE expenses ADD COLUMN IF NOT EXISTS reference_number TEXT;
ALTER TABLE expenses ADD COLUMN IF NOT EXISTS transaction_id TEXT;
ALTER TABLE expenses ADD COLUMN IF NOT EXISTS vendor TEXT;
ALTER TABLE budgets ADD COLUMN IF NOT EXISTS budget_amount NUMERIC(15,2);
ALTER TABLE budgets ADD COLUMN IF NOT EXISTS notes TEXT;
ALTER TABLE budgets ADD COLUMN IF NOT EXISTS category_id UUID;
ALTER TABLE budgets ADD COLUMN IF NOT EXISTS financial_year_id UUID;

-- Relax status checks if needed
ALTER TABLE income DROP CONSTRAINT IF EXISTS income_approval_status_check;
ALTER TABLE income ADD CONSTRAINT income_approval_status_check
  CHECK (approval_status IS NULL OR approval_status IN ('pending','draft','submitted','approved','rejected'));

ALTER TABLE expenses DROP CONSTRAINT IF EXISTS expenses_status_check;
ALTER TABLE expenses ADD CONSTRAINT expenses_status_check
  CHECK (status IS NULL OR status IN ('pending','draft','submitted','approved','rejected','paid'));

-- Ensure open year + lookups
INSERT INTO financial_years (name, start_date, end_date, status)
SELECT '2026 Financial Year', '2026-01-01', '2026-12-31', 'open'
WHERE NOT EXISTS (SELECT 1 FROM financial_years WHERE status = 'open');

INSERT INTO income_categories (name) VALUES
('Donations'),('Grants'),('Membership Fees'),('Other Income')
ON CONFLICT (name) DO NOTHING;

INSERT INTO expense_categories (name) VALUES
('Office'),('Transportation'),('Food'),('Utilities'),('Other')
ON CONFLICT (name) DO NOTHING;

INSERT INTO payment_methods (name) VALUES
('Cash'),('Bank Transfer'),('Cheque'),('Mobile Money')
ON CONFLICT (name) DO NOTHING;

-- Broad RLS for authenticated create/read/update
DO $$ BEGIN
  EXECUTE 'DROP POLICY IF EXISTS income_all ON income';
  EXECUTE 'CREATE POLICY income_all ON income FOR ALL TO authenticated USING (true) WITH CHECK (true)';
EXCEPTION WHEN OTHERS THEN
  BEGIN
    CREATE POLICY income_all ON income FOR ALL TO authenticated USING (true) WITH CHECK (true);
  EXCEPTION WHEN OTHERS THEN NULL;
  END;
END $$;

DO $$ BEGIN
  EXECUTE 'DROP POLICY IF EXISTS expenses_all ON expenses';
  EXECUTE 'CREATE POLICY expenses_all ON expenses FOR ALL TO authenticated USING (true) WITH CHECK (true)';
EXCEPTION WHEN OTHERS THEN
  BEGIN
    CREATE POLICY expenses_all ON expenses FOR ALL TO authenticated USING (true) WITH CHECK (true);
  EXCEPTION WHEN OTHERS THEN NULL;
  END;
END $$;

DO $$ BEGIN
  EXECUTE 'DROP POLICY IF EXISTS budgets_all ON budgets';
  EXECUTE 'CREATE POLICY budgets_all ON budgets FOR ALL TO authenticated USING (true) WITH CHECK (true)';
EXCEPTION WHEN OTHERS THEN
  BEGIN
    CREATE POLICY budgets_all ON budgets FOR ALL TO authenticated USING (true) WITH CHECK (true);
  EXCEPTION WHEN OTHERS THEN NULL;
  END;
END $$;
