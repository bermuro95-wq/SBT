-- Run in Supabase SQL Editor

-- 1) Ensure open financial year exists
INSERT INTO financial_years (name, start_date, end_date, status, opening_balance, annual_budget)
SELECT '2026 Financial Year', '2026-01-01', '2026-12-31', 'open', 0, 0
WHERE NOT EXISTS (SELECT 1 FROM financial_years WHERE status = 'open');

-- 2) Ensure categories exist
INSERT INTO income_categories (name) VALUES
('Donations'), ('Grants'), ('Membership Fees'), ('Other Income')
ON CONFLICT (name) DO NOTHING;

INSERT INTO expense_categories (name) VALUES
('Office'), ('Transportation'), ('Food'), ('Utilities'), ('Equipment'),
('Communication'), ('Training'), ('Operations'), ('Emergency'), ('Other')
ON CONFLICT (name) DO NOTHING;

INSERT INTO payment_methods (name) VALUES
('Cash'), ('Bank Transfer'), ('Cheque'), ('Mobile Money')
ON CONFLICT (name) DO NOTHING;

-- 3) Fix admin profile (replace auth_id if needed)
UPDATE profiles
SET role = 'administrator', status = 'active'
WHERE email = 'admin@selambertu.org';

UPDATE profiles
SET role = 'accountant', status = 'active'
WHERE email = 'accountant@selambertu.org';

-- 4) Allow authenticated users to insert income/expenses (if RLS blocks)
DROP POLICY IF EXISTS income_insert ON income;
CREATE POLICY income_insert ON income FOR INSERT TO authenticated WITH CHECK (true);
DROP POLICY IF EXISTS income_select ON income;
CREATE POLICY income_select ON income FOR SELECT TO authenticated USING (true);
DROP POLICY IF EXISTS income_update ON income;
CREATE POLICY income_update ON income FOR UPDATE TO authenticated USING (true);

DROP POLICY IF EXISTS expenses_insert ON expenses;
CREATE POLICY expenses_insert ON expenses FOR INSERT TO authenticated WITH CHECK (true);
DROP POLICY IF EXISTS expenses_select ON expenses;
CREATE POLICY expenses_select ON expenses FOR SELECT TO authenticated USING (true);
DROP POLICY IF EXISTS expenses_update ON expenses;
CREATE POLICY expenses_update ON expenses FOR UPDATE TO authenticated USING (true);

DROP POLICY IF EXISTS profiles_select ON profiles;
CREATE POLICY profiles_select ON profiles FOR SELECT TO authenticated USING (true);
DROP POLICY IF EXISTS profiles_update ON profiles;
CREATE POLICY profiles_update ON profiles FOR UPDATE TO authenticated USING (true);
DROP POLICY IF EXISTS profiles_insert ON profiles;
CREATE POLICY profiles_insert ON profiles FOR INSERT TO authenticated WITH CHECK (true);

DROP POLICY IF EXISTS fy_all ON financial_years;
CREATE POLICY fy_all ON financial_years FOR ALL TO authenticated USING (true) WITH CHECK (true);
DROP POLICY IF EXISTS inc_cat ON income_categories;
CREATE POLICY inc_cat ON income_categories FOR SELECT TO authenticated USING (true);
DROP POLICY IF EXISTS exp_cat ON expense_categories;
CREATE POLICY exp_cat ON expense_categories FOR SELECT TO authenticated USING (true);
DROP POLICY IF EXISTS pay_m ON payment_methods;
CREATE POLICY pay_m ON payment_methods FOR SELECT TO authenticated USING (true);
