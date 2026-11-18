-- ============================================================
-- SELAM BERTU TESFA ORGANIZATION
-- Production Schema Additions (safe to run on existing DB)
-- NO demo data. Seeds only structure/lookups required for app.
-- ============================================================

CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- ---------- Helper functions ----------
CREATE OR REPLACE FUNCTION public.set_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION public.current_profile_id()
RETURNS UUID LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT id FROM public.profiles WHERE auth_id = auth.uid() LIMIT 1;
$$;

CREATE OR REPLACE FUNCTION public.current_user_role()
RETURNS TEXT LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT role FROM public.profiles WHERE auth_id = auth.uid() LIMIT 1;
$$;

CREATE OR REPLACE FUNCTION public.is_admin()
RETURNS BOOLEAN LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.profiles
    WHERE auth_id = auth.uid() AND role = 'administrator' AND status = 'active'
  );
$$;

CREATE OR REPLACE FUNCTION public.is_active_user()
RETURNS BOOLEAN LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.profiles
    WHERE auth_id = auth.uid() AND status = 'active'
  );
$$;

-- ---------- Ensure core tables exist (idempotent) ----------
CREATE TABLE IF NOT EXISTS public.roles (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name TEXT NOT NULL UNIQUE,
  description TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.permissions (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  resource TEXT NOT NULL,
  action TEXT NOT NULL,
  description TEXT,
  UNIQUE(resource, action)
);

CREATE TABLE IF NOT EXISTS public.role_permissions (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  role_id UUID NOT NULL REFERENCES public.roles(id) ON DELETE CASCADE,
  permission_id UUID NOT NULL REFERENCES public.permissions(id) ON DELETE CASCADE,
  UNIQUE(role_id, permission_id)
);

CREATE TABLE IF NOT EXISTS public.profiles (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  auth_id UUID UNIQUE REFERENCES auth.users(id) ON DELETE CASCADE,
  full_name TEXT NOT NULL,
  email TEXT NOT NULL,
  role TEXT NOT NULL DEFAULT 'accountant'
    CHECK (role IN ('administrator', 'accountant', 'viewer')),
  role_id UUID REFERENCES public.roles(id),
  status TEXT NOT NULL DEFAULT 'active'
    CHECK (status IN ('active', 'inactive', 'suspended')),
  avatar_url TEXT,
  language TEXT DEFAULT 'en',
  theme TEXT DEFAULT 'light',
  last_login TIMESTAMPTZ,
  last_activity TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.financial_years (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name TEXT NOT NULL,
  start_date DATE NOT NULL,
  end_date DATE NOT NULL,
  status TEXT NOT NULL DEFAULT 'open'
    CHECK (status IN ('open', 'closed', 'archived')),
  opening_balance NUMERIC(15,2) DEFAULT 0,
  annual_budget NUMERIC(15,2) DEFAULT 0,
  created_by UUID REFERENCES public.profiles(id),
  closed_by UUID REFERENCES public.profiles(id),
  closed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.income_categories (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name TEXT NOT NULL UNIQUE,
  description TEXT,
  is_active BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.expense_categories (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name TEXT NOT NULL UNIQUE,
  description TEXT,
  is_active BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.payment_methods (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name TEXT NOT NULL UNIQUE,
  description TEXT,
  is_active BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.income (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  transaction_id TEXT UNIQUE,
  date DATE NOT NULL,
  amount NUMERIC(15,2) NOT NULL CHECK (amount > 0),
  currency TEXT DEFAULT 'ETB',
  source TEXT NOT NULL,
  description TEXT,
  reference_number TEXT,
  notes TEXT,
  receipt_url TEXT,
  category_id UUID REFERENCES public.income_categories(id),
  payment_method_id UUID REFERENCES public.payment_methods(id),
  financial_year_id UUID REFERENCES public.financial_years(id),
  approval_status TEXT NOT NULL DEFAULT 'pending'
    CHECK (approval_status IN ('pending','draft','submitted','approved','rejected')),
  received_by UUID REFERENCES public.profiles(id),
  created_by UUID REFERENCES public.profiles(id),
  approved_by UUID REFERENCES public.profiles(id),
  approved_at TIMESTAMPTZ,
  rejection_reason TEXT,
  is_deleted BOOLEAN DEFAULT FALSE,
  deleted_at TIMESTAMPTZ,
  deleted_by UUID REFERENCES public.profiles(id),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.expenses (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  transaction_id TEXT UNIQUE,
  date DATE NOT NULL,
  amount NUMERIC(15,2) NOT NULL CHECK (amount > 0),
  currency TEXT DEFAULT 'ETB',
  vendor TEXT,
  description TEXT,
  reference_number TEXT,
  notes TEXT,
  receipt_url TEXT,
  category_id UUID REFERENCES public.expense_categories(id),
  payment_method_id UUID REFERENCES public.payment_methods(id),
  financial_year_id UUID REFERENCES public.financial_years(id),
  status TEXT NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending','draft','submitted','approved','rejected','paid')),
  requested_by UUID REFERENCES public.profiles(id),
  created_by UUID REFERENCES public.profiles(id),
  approved_by UUID REFERENCES public.profiles(id),
  approved_at TIMESTAMPTZ,
  rejection_reason TEXT,
  is_deleted BOOLEAN DEFAULT FALSE,
  deleted_at TIMESTAMPTZ,
  deleted_by UUID REFERENCES public.profiles(id),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.budgets (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  financial_year_id UUID NOT NULL REFERENCES public.financial_years(id),
  category_id UUID REFERENCES public.expense_categories(id),
  category_name TEXT,
  budget_amount NUMERIC(15,2) NOT NULL CHECK (budget_amount >= 0),
  period_type TEXT DEFAULT 'annual' CHECK (period_type IN ('annual','quarterly','monthly')),
  period_key TEXT,
  notes TEXT,
  created_by UUID REFERENCES public.profiles(id),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.budget_categories (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name TEXT NOT NULL UNIQUE,
  description TEXT,
  is_active BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.receipts (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  document_id TEXT UNIQUE,
  income_id UUID REFERENCES public.income(id) ON DELETE SET NULL,
  expense_id UUID REFERENCES public.expenses(id) ON DELETE SET NULL,
  file_name TEXT,
  file_url TEXT,
  file_type TEXT,
  file_size INTEGER,
  document_type TEXT DEFAULT 'receipt',
  financial_year_id UUID REFERENCES public.financial_years(id),
  uploaded_by UUID REFERENCES public.profiles(id),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.transaction_documents (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  document_id TEXT UNIQUE,
  entity_type TEXT NOT NULL CHECK (entity_type IN ('income','expense')),
  entity_id UUID NOT NULL,
  file_name TEXT,
  file_url TEXT,
  file_type TEXT,
  file_size INTEGER,
  document_type TEXT,
  financial_year_id UUID REFERENCES public.financial_years(id),
  uploaded_by UUID REFERENCES public.profiles(id),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.approvals (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  entity_type TEXT NOT NULL CHECK (entity_type IN ('income','expense')),
  entity_id UUID NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending','approved','rejected')),
  previous_status TEXT,
  new_status TEXT,
  requested_by UUID REFERENCES public.profiles(id),
  reviewed_by UUID REFERENCES public.profiles(id),
  comments TEXT,
  reason TEXT,
  reviewed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.audit_logs (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  event_id TEXT,
  user_id UUID REFERENCES public.profiles(id),
  action TEXT NOT NULL,
  entity TEXT,
  entity_id UUID,
  old_value JSONB,
  new_value JSONB,
  metadata JSONB,
  result TEXT DEFAULT 'success',
  ip_address TEXT,
  user_agent TEXT,
  timestamp TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.notifications (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  message TEXT,
  type TEXT DEFAULT 'info',
  link TEXT,
  is_read BOOLEAN DEFAULT FALSE,
  read_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.system_settings (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  key TEXT NOT NULL UNIQUE,
  value TEXT,
  description TEXT,
  updated_by UUID REFERENCES public.profiles(id),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.transaction_history (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  entity_type TEXT NOT NULL CHECK (entity_type IN ('income','expense')),
  entity_id UUID NOT NULL,
  field_name TEXT,
  old_value TEXT,
  new_value TEXT,
  changed_by UUID REFERENCES public.profiles(id),
  reason TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_profiles_auth ON profiles(auth_id);
CREATE INDEX IF NOT EXISTS idx_profiles_role ON profiles(role);
CREATE INDEX IF NOT EXISTS idx_income_year ON income(financial_year_id);
CREATE INDEX IF NOT EXISTS idx_income_status ON income(approval_status);
CREATE INDEX IF NOT EXISTS idx_income_deleted ON income(is_deleted);
CREATE INDEX IF NOT EXISTS idx_income_date ON income(date);
CREATE INDEX IF NOT EXISTS idx_expenses_year ON expenses(financial_year_id);
CREATE INDEX IF NOT EXISTS idx_expenses_status ON expenses(status);
CREATE INDEX IF NOT EXISTS idx_expenses_deleted ON expenses(is_deleted);
CREATE INDEX IF NOT EXISTS idx_expenses_date ON expenses(date);
CREATE INDEX IF NOT EXISTS idx_audit_ts ON audit_logs(timestamp DESC);
CREATE INDEX IF NOT EXISTS idx_notif_user ON notifications(user_id, is_read);

-- Status constraint repairs for existing DBs
ALTER TABLE income DROP CONSTRAINT IF EXISTS income_approval_status_check;
ALTER TABLE income ADD CONSTRAINT income_approval_status_check
  CHECK (approval_status IS NULL OR approval_status IN ('pending','draft','submitted','approved','rejected'));

ALTER TABLE expenses DROP CONSTRAINT IF EXISTS expenses_status_check;
ALTER TABLE expenses ADD CONSTRAINT expenses_status_check
  CHECK (status IS NULL OR status IN ('pending','draft','submitted','approved','rejected','paid'));

ALTER TABLE financial_years DROP CONSTRAINT IF EXISTS financial_years_status_check;
ALTER TABLE financial_years ADD CONSTRAINT financial_years_status_check
  CHECK (status IS NULL OR status IN ('open','closed','archived'));

-- Extra columns if tables already existed without them
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS last_activity TIMESTAMPTZ;
ALTER TABLE income ADD COLUMN IF NOT EXISTS currency TEXT DEFAULT 'ETB';
ALTER TABLE income ADD COLUMN IF NOT EXISTS notes TEXT;
ALTER TABLE income ADD COLUMN IF NOT EXISTS receipt_url TEXT;
ALTER TABLE income ADD COLUMN IF NOT EXISTS rejection_reason TEXT;
ALTER TABLE expenses ADD COLUMN IF NOT EXISTS currency TEXT DEFAULT 'ETB';
ALTER TABLE expenses ADD COLUMN IF NOT EXISTS vendor TEXT;
ALTER TABLE expenses ADD COLUMN IF NOT EXISTS notes TEXT;
ALTER TABLE expenses ADD COLUMN IF NOT EXISTS receipt_url TEXT;
ALTER TABLE expenses ADD COLUMN IF NOT EXISTS rejection_reason TEXT;
ALTER TABLE financial_years ADD COLUMN IF NOT EXISTS opening_balance NUMERIC(15,2) DEFAULT 0;
ALTER TABLE financial_years ADD COLUMN IF NOT EXISTS annual_budget NUMERIC(15,2) DEFAULT 0;
ALTER TABLE financial_years ADD COLUMN IF NOT EXISTS closed_by UUID;
ALTER TABLE financial_years ADD COLUMN IF NOT EXISTS closed_at TIMESTAMPTZ;

-- Structure seeds only (not fake financial records)
INSERT INTO roles (name, description) VALUES
('administrator', 'Full organizational access'),
('accountant', 'Financial operations without admin controls'),
('viewer', 'Read-only access')
ON CONFLICT (name) DO NOTHING;

INSERT INTO permissions (resource, action, description) VALUES
('dashboard','view','View dashboard'),
('income','view','View income'),
('income','create','Create income'),
('income','edit','Edit income'),
('income','delete','Delete income'),
('expense','view','View expenses'),
('expense','create','Create expenses'),
('expense','edit','Edit expenses'),
('expense','delete','Delete expenses'),
('transaction','approve','Approve transactions'),
('transaction','reject','Reject transactions'),
('receipt','view','View receipts'),
('receipt','upload','Upload receipts'),
('report','generate','Generate reports'),
('report','export','Export reports'),
('budget','view','View budgets'),
('budget','manage','Manage budgets'),
('users','view','View users'),
('users','manage','Manage users'),
('roles','manage','Manage roles'),
('audit','view','View audit logs'),
('financial_year','view','View financial years'),
('financial_year','manage','Manage financial years'),
('settings','manage','Manage settings')
ON CONFLICT (resource, action) DO NOTHING;

INSERT INTO role_permissions (role_id, permission_id)
SELECT r.id, p.id FROM roles r CROSS JOIN permissions p
WHERE r.name = 'administrator'
ON CONFLICT DO NOTHING;

INSERT INTO role_permissions (role_id, permission_id)
SELECT r.id, p.id FROM roles r CROSS JOIN permissions p
WHERE r.name = 'accountant'
  AND NOT (p.resource IN ('users','roles','audit','settings'))
  AND NOT (p.resource = 'transaction' AND p.action IN ('approve','reject'))
  AND NOT (p.resource = 'financial_year' AND p.action = 'manage')
ON CONFLICT DO NOTHING;

INSERT INTO income_categories (name) VALUES
('Donations'),('Grants'),('Membership Fees'),('Other Income')
ON CONFLICT (name) DO NOTHING;

INSERT INTO expense_categories (name) VALUES
('Office'),('Transportation'),('Food'),('Utilities'),('Equipment'),
('Communication'),('Training'),('Operations'),('Emergency'),('Other')
ON CONFLICT (name) DO NOTHING;

INSERT INTO payment_methods (name) VALUES
('Cash'),('Bank Transfer'),('Cheque'),('Mobile Money')
ON CONFLICT (name) DO NOTHING;

INSERT INTO system_settings (key, value, description) VALUES
('organization_name', 'SELAM BERTU TESFA ORGANIZATION', 'Organization name'),
('currency', 'ETB', 'Default currency'),
('currency_symbol', 'Br', 'Currency symbol'),
('date_format', 'YYYY-MM-DD', 'Date format')
ON CONFLICT (key) DO NOTHING;

-- Open financial year if none
INSERT INTO financial_years (name, start_date, end_date, status, opening_balance, annual_budget)
SELECT '2026 Financial Year', '2026-01-01', '2026-12-31', 'open', 0, 0
WHERE NOT EXISTS (SELECT 1 FROM financial_years WHERE status = 'open');

-- Profile auto-create on signup
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  INSERT INTO public.profiles (auth_id, full_name, email, role, status)
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data->>'full_name', split_part(NEW.email, '@', 1)),
    NEW.email,
    COALESCE(NEW.raw_user_meta_data->>'role', 'accountant'),
    'active'
  )
  ON CONFLICT (auth_id) DO NOTHING;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- Prevent edits to closed financial years (income/expenses)
CREATE OR REPLACE FUNCTION public.prevent_closed_year_modifications()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
DECLARE yr_status TEXT;
BEGIN
  SELECT status INTO yr_status FROM financial_years
  WHERE id = COALESCE(NEW.financial_year_id, OLD.financial_year_id);
  IF yr_status IN ('closed', 'archived') AND NOT public.is_admin() THEN
    RAISE EXCEPTION 'Cannot modify records in a closed or archived financial year';
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS income_closed_year ON income;
CREATE TRIGGER income_closed_year
  BEFORE INSERT OR UPDATE ON income
  FOR EACH ROW EXECUTE FUNCTION public.prevent_closed_year_modifications();

DROP TRIGGER IF EXISTS expenses_closed_year ON expenses;
CREATE TRIGGER expenses_closed_year
  BEFORE INSERT OR UPDATE ON expenses
  FOR EACH ROW EXECUTE FUNCTION public.prevent_closed_year_modifications();

-- Audit log helper (callable from clients with care)
CREATE OR REPLACE FUNCTION public.write_audit_log(
  p_action TEXT,
  p_entity TEXT DEFAULT NULL,
  p_entity_id UUID DEFAULT NULL,
  p_old JSONB DEFAULT NULL,
  p_new JSONB DEFAULT NULL,
  p_metadata JSONB DEFAULT NULL,
  p_result TEXT DEFAULT 'success'
) RETURNS UUID LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE new_id UUID;
BEGIN
  INSERT INTO audit_logs (event_id, user_id, action, entity, entity_id, old_value, new_value, metadata, result)
  VALUES (
    'AUD-' || to_char(NOW(), 'YYYY') || '-' || substr(replace(gen_random_uuid()::text, '-', ''), 1, 8),
    public.current_profile_id(),
    p_action, p_entity, p_entity_id, p_old, p_new, p_metadata, p_result
  ) RETURNING id INTO new_id;
  RETURN new_id;
END;
$$;

GRANT EXECUTE ON FUNCTION public.write_audit_log TO authenticated;
GRANT EXECUTE ON FUNCTION public.is_admin TO authenticated;
GRANT EXECUTE ON FUNCTION public.current_user_role TO authenticated;
GRANT EXECUTE ON FUNCTION public.current_profile_id TO authenticated;
