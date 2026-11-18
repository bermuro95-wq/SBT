-- ============================================================
-- SELAM BERTU TESFA - Required Supabase fixes for full functionality
-- Run this in Supabase SQL Editor
-- ============================================================

-- 1) Allow status values used by the app
ALTER TABLE income DROP CONSTRAINT IF EXISTS income_approval_status_check;
ALTER TABLE income ADD CONSTRAINT income_approval_status_check
  CHECK (approval_status IS NULL OR approval_status IN (
    'pending', 'draft', 'submitted', 'approved', 'rejected'
  ));

ALTER TABLE expenses DROP CONSTRAINT IF EXISTS expenses_status_check;
ALTER TABLE expenses ADD CONSTRAINT expenses_status_check
  CHECK (status IS NULL OR status IN (
    'pending', 'draft', 'submitted', 'approved', 'rejected', 'paid'
  ));

-- Optional columns used by the app
ALTER TABLE income ADD COLUMN IF NOT EXISTS notes TEXT;
ALTER TABLE income ADD COLUMN IF NOT EXISTS receipt_url TEXT;
ALTER TABLE income ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMPTZ;
ALTER TABLE income ADD COLUMN IF NOT EXISTS deleted_by UUID;
ALTER TABLE expenses ADD COLUMN IF NOT EXISTS notes TEXT;
ALTER TABLE expenses ADD COLUMN IF NOT EXISTS vendor TEXT;
ALTER TABLE expenses ADD COLUMN IF NOT EXISTS receipt_url TEXT;
ALTER TABLE expenses ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMPTZ;
ALTER TABLE expenses ADD COLUMN IF NOT EXISTS deleted_by UUID;

-- 2) Enable RLS
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE income ENABLE ROW LEVEL SECURITY;
ALTER TABLE expenses ENABLE ROW LEVEL SECURITY;
ALTER TABLE financial_years ENABLE ROW LEVEL SECURITY;
ALTER TABLE income_categories ENABLE ROW LEVEL SECURITY;
ALTER TABLE expense_categories ENABLE ROW LEVEL SECURITY;
ALTER TABLE payment_methods ENABLE ROW LEVEL SECURITY;
ALTER TABLE budgets ENABLE ROW LEVEL SECURITY;
ALTER TABLE receipts ENABLE ROW LEVEL SECURITY;
ALTER TABLE approvals ENABLE ROW LEVEL SECURITY;
ALTER TABLE audit_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE notifications ENABLE ROW LEVEL SECURITY;
ALTER TABLE system_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE roles ENABLE ROW LEVEL SECURITY;
ALTER TABLE permissions ENABLE ROW LEVEL SECURITY;
ALTER TABLE role_permissions ENABLE ROW LEVEL SECURITY;
ALTER TABLE budget_categories ENABLE ROW LEVEL SECURITY;

-- 3) Helper: current user's role from profiles
CREATE OR REPLACE FUNCTION public.current_user_role()
RETURNS TEXT
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT role FROM public.profiles WHERE auth_id = auth.uid() LIMIT 1;
$$;

CREATE OR REPLACE FUNCTION public.is_admin()
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.profiles
    WHERE auth_id = auth.uid() AND role = 'administrator'
  );
$$;

-- 4) Drop old policies if re-running
DO $$
DECLARE r RECORD;
BEGIN
  FOR r IN (
    SELECT policyname, tablename FROM pg_policies WHERE schemaname = 'public'
  ) LOOP
    EXECUTE format('DROP POLICY IF EXISTS %I ON public.%I', r.policyname, r.tablename);
  END LOOP;
END $$;

-- 5) PROFILES
CREATE POLICY "profiles_select" ON profiles FOR SELECT TO authenticated
  USING (true);
CREATE POLICY "profiles_update_own" ON profiles FOR UPDATE TO authenticated
  USING (auth_id = auth.uid() OR public.is_admin());
CREATE POLICY "profiles_insert" ON profiles FOR INSERT TO authenticated
  WITH CHECK (auth_id = auth.uid() OR public.is_admin() OR auth_id IS NOT NULL);
CREATE POLICY "profiles_admin_all" ON profiles FOR ALL TO authenticated
  USING (public.is_admin()) WITH CHECK (public.is_admin());

-- 6) Core financial tables - authenticated can read/write (app enforces roles in UI)
CREATE POLICY "income_all" ON income FOR ALL TO authenticated
  USING (true) WITH CHECK (true);
CREATE POLICY "expenses_all" ON expenses FOR ALL TO authenticated
  USING (true) WITH CHECK (true);
CREATE POLICY "budgets_all" ON budgets FOR ALL TO authenticated
  USING (true) WITH CHECK (true);
CREATE POLICY "receipts_all" ON receipts FOR ALL TO authenticated
  USING (true) WITH CHECK (true);
CREATE POLICY "approvals_all" ON approvals FOR ALL TO authenticated
  USING (true) WITH CHECK (true);
CREATE POLICY "audit_logs_select" ON audit_logs FOR SELECT TO authenticated
  USING (true);
CREATE POLICY "audit_logs_insert" ON audit_logs FOR INSERT TO authenticated
  WITH CHECK (true);
CREATE POLICY "notifications_all" ON notifications FOR ALL TO authenticated
  USING (true) WITH CHECK (true);
CREATE POLICY "settings_all" ON system_settings FOR ALL TO authenticated
  USING (true) WITH CHECK (true);

-- Lookups
CREATE POLICY "fy_all" ON financial_years FOR ALL TO authenticated
  USING (true) WITH CHECK (true);
CREATE POLICY "inc_cat_all" ON income_categories FOR ALL TO authenticated
  USING (true) WITH CHECK (true);
CREATE POLICY "exp_cat_all" ON expense_categories FOR ALL TO authenticated
  USING (true) WITH CHECK (true);
CREATE POLICY "pay_all" ON payment_methods FOR ALL TO authenticated
  USING (true) WITH CHECK (true);
CREATE POLICY "roles_select" ON roles FOR SELECT TO authenticated USING (true);
CREATE POLICY "permissions_select" ON permissions FOR SELECT TO authenticated USING (true);
CREATE POLICY "role_permissions_select" ON role_permissions FOR SELECT TO authenticated USING (true);
CREATE POLICY "budget_cat_all" ON budget_categories FOR ALL TO authenticated
  USING (true) WITH CHECK (true);

-- 7) Ensure seed lookup data exists
INSERT INTO roles (name, description) VALUES
('administrator', 'Full access'),
('accountant', 'Financial operations'),
('viewer', 'Read only')
ON CONFLICT (name) DO NOTHING;

INSERT INTO income_categories (name) VALUES
('Donations'), ('Grants'), ('Membership Fees'), ('Other Income')
ON CONFLICT (name) DO NOTHING;

INSERT INTO expense_categories (name) VALUES
('Office'), ('Transportation'), ('Programs'), ('Utilities'), ('Salaries'), ('Other Expense')
ON CONFLICT (name) DO NOTHING;

INSERT INTO payment_methods (name) VALUES
('Cash'), ('Bank Transfer'), ('Cheque'), ('Mobile Money')
ON CONFLICT (name) DO NOTHING;

INSERT INTO financial_years (name, start_date, end_date, status)
SELECT '2025 Financial Year', '2025-01-01', '2025-12-31', 'open'
WHERE NOT EXISTS (SELECT 1 FROM financial_years WHERE status = 'open');

INSERT INTO financial_years (name, start_date, end_date, status)
SELECT '2026 Financial Year', '2026-01-01', '2026-12-31', 'open'
WHERE NOT EXISTS (SELECT 1 FROM financial_years WHERE name = '2026 Financial Year');

-- 8) Storage buckets (ignore error if exist)
-- Create in Dashboard if this fails: avatars (public), receipts (private)
