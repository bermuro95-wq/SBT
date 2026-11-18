-- ============================================================
-- SELAM BERTU TESFA — Master Integrity Migration
-- Run once on project dfaxwzsiwrpwgambutro
-- Safe / incremental — does not drop business data
-- ============================================================

-- 1) Normalize helper
CREATE OR REPLACE FUNCTION public.normalize_ref(t text)
RETURNS text LANGUAGE sql IMMUTABLE AS $$
  SELECT lower(trim(coalesce(t, '')));
$$;

-- 2) Income / expense reference columns + normalized
ALTER TABLE public.income ADD COLUMN IF NOT EXISTS reference_number text;
ALTER TABLE public.income ADD COLUMN IF NOT EXISTS reference_normalized text;
ALTER TABLE public.income ADD COLUMN IF NOT EXISTS is_deleted boolean DEFAULT false;
ALTER TABLE public.expenses ADD COLUMN IF NOT EXISTS reference_number text;
ALTER TABLE public.expenses ADD COLUMN IF NOT EXISTS reference_normalized text;
ALTER TABLE public.expenses ADD COLUMN IF NOT EXISTS is_deleted boolean DEFAULT false;
ALTER TABLE public.expenses ADD COLUMN IF NOT EXISTS vendor text;

-- Keep normalized ref in sync
CREATE OR REPLACE FUNCTION public.trg_set_reference_normalized()
RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  NEW.reference_normalized := public.normalize_ref(NEW.reference_number);
  IF NEW.reference_normalized = '' THEN
    NEW.reference_normalized := NULL;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS income_ref_norm ON public.income;
CREATE TRIGGER income_ref_norm
BEFORE INSERT OR UPDATE OF reference_number ON public.income
FOR EACH ROW EXECUTE FUNCTION public.trg_set_reference_normalized();

DROP TRIGGER IF EXISTS expense_ref_norm ON public.expenses;
CREATE TRIGGER expense_ref_norm
BEFORE INSERT OR UPDATE OF reference_number ON public.expenses
FOR EACH ROW EXECUTE FUNCTION public.trg_set_reference_normalized();

-- Backfill
UPDATE public.income SET reference_normalized = public.normalize_ref(reference_number)
WHERE reference_number IS NOT NULL AND (reference_normalized IS NULL OR reference_normalized = '');
UPDATE public.expenses SET reference_normalized = public.normalize_ref(reference_number)
WHERE reference_number IS NOT NULL AND (reference_normalized IS NULL OR reference_normalized = '');

-- Unique indexes (partial — only non-deleted, non-null refs)
-- Income: unique reference per org globally when provided
DROP INDEX IF EXISTS ux_income_ref_norm;
CREATE UNIQUE INDEX IF NOT EXISTS ux_income_ref_norm
ON public.income (reference_normalized)
WHERE reference_normalized IS NOT NULL AND coalesce(is_deleted, false) = false;

-- Expense: unique (vendor normalized + reference) 
DROP INDEX IF EXISTS ux_expense_vendor_ref;
CREATE UNIQUE INDEX IF NOT EXISTS ux_expense_vendor_ref
ON public.expenses (reference_normalized, lower(trim(coalesce(vendor, ''))))
WHERE reference_normalized IS NOT NULL AND coalesce(is_deleted, false) = false;

-- 3) Profiles: roles + email uniqueness
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS role text DEFAULT 'accountant';
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS status text DEFAULT 'active';
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS email text;

UPDATE public.profiles SET role = 'administrator' WHERE lower(role) IN ('admin', 'administrator');
UPDATE public.profiles SET role = 'accountant' WHERE role IS NULL OR role = '';

-- Case-insensitive unique email
CREATE UNIQUE INDEX IF NOT EXISTS ux_profiles_email_lower
ON public.profiles (lower(trim(email)))
WHERE email IS NOT NULL AND trim(email) <> '' AND position('@deleted.local' in lower(email)) = 0;

-- 4) Grand budget tables
CREATE TABLE IF NOT EXISTS public.grand_budgets (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  financial_year_id uuid REFERENCES public.financial_years(id) ON DELETE CASCADE,
  annual_limit numeric(18,2) NOT NULL DEFAULT 0,
  opening_balance numeric(18,2) NOT NULL DEFAULT 0,
  total_income numeric(18,2) NOT NULL DEFAULT 0,
  total_allocated numeric(18,2) NOT NULL DEFAULT 0,
  total_expenses numeric(18,2) NOT NULL DEFAULT 0,
  total_released numeric(18,2) NOT NULL DEFAULT 0,
  notes text,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  UNIQUE (financial_year_id)
);

CREATE TABLE IF NOT EXISTS public.budget_ledger (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  financial_year_id uuid,
  entry_type text NOT NULL, -- income_credit | allocate | expense_debit | release
  category_id uuid,
  amount numeric(18,2) NOT NULL,
  reference_id uuid,
  reference_table text,
  note text,
  created_by uuid,
  created_at timestamptz DEFAULT now()
);

ALTER TABLE public.budgets ADD COLUMN IF NOT EXISTS allocated_amount numeric(18,2);
ALTER TABLE public.budgets ADD COLUMN IF NOT EXISTS budget_amount numeric(18,2);
ALTER TABLE public.budgets ADD COLUMN IF NOT EXISTS spent_amount numeric(18,2) DEFAULT 0;
ALTER TABLE public.budgets ADD COLUMN IF NOT EXISTS category_name text;

-- Ensure grand budget row for each financial year
INSERT INTO public.grand_budgets (financial_year_id, annual_limit, opening_balance)
SELECT fy.id, coalesce(fy.annual_budget, 0), coalesce(fy.opening_balance, 0)
FROM public.financial_years fy
WHERE NOT EXISTS (
  SELECT 1 FROM public.grand_budgets g WHERE g.financial_year_id = fy.id
);

-- 5) Credit grand budget when income approved
CREATE OR REPLACE FUNCTION public.credit_grand_budget_on_income()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  fy uuid;
  amt numeric(18,2);
BEGIN
  IF TG_OP = 'UPDATE'
     AND lower(coalesce(NEW.approval_status, NEW.status, '')) = 'approved'
     AND lower(coalesce(OLD.approval_status, OLD.status, '')) IS DISTINCT FROM 'approved'
  THEN
    amt := coalesce(NEW.amount, 0);
    fy := NEW.financial_year_id;
    IF fy IS NULL THEN
      SELECT id INTO fy FROM public.financial_years WHERE status = 'open' ORDER BY start_date DESC LIMIT 1;
    END IF;
    IF fy IS NOT NULL AND amt > 0 THEN
      INSERT INTO public.grand_budgets (financial_year_id, total_income)
      VALUES (fy, amt)
      ON CONFLICT (financial_year_id) DO UPDATE
      SET total_income = public.grand_budgets.total_income + EXCLUDED.total_income,
          updated_at = now();
      INSERT INTO public.budget_ledger (financial_year_id, entry_type, amount, reference_id, reference_table, note)
      VALUES (fy, 'income_credit', amt, NEW.id, 'income', coalesce(NEW.transaction_id, ''));
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_income_credit_grand ON public.income;
CREATE TRIGGER trg_income_credit_grand
AFTER UPDATE ON public.income
FOR EACH ROW EXECUTE FUNCTION public.credit_grand_budget_on_income();

-- 6) Expense approval reduces category spent (idempotent-ish via ledger check)
CREATE OR REPLACE FUNCTION public.debit_budget_on_expense_approved()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  fy uuid;
  amt numeric(18,2);
  already int;
BEGIN
  IF TG_OP = 'UPDATE'
     AND lower(coalesce(NEW.status, NEW.approval_status, '')) = 'approved'
     AND lower(coalesce(OLD.status, OLD.approval_status, '')) IS DISTINCT FROM 'approved'
  THEN
    amt := coalesce(NEW.amount, 0);
    fy := NEW.financial_year_id;
    IF fy IS NULL THEN
      SELECT id INTO fy FROM public.financial_years WHERE status = 'open' ORDER BY start_date DESC LIMIT 1;
    END IF;
    SELECT count(*) INTO already FROM public.budget_ledger
      WHERE reference_id = NEW.id AND entry_type = 'expense_debit';
    IF already = 0 AND amt > 0 THEN
      IF NEW.category_id IS NOT NULL THEN
        UPDATE public.budgets
        SET spent_amount = coalesce(spent_amount, 0) + amt
        WHERE category_id = NEW.category_id
          AND (financial_year_id = fy OR fy IS NULL);
      END IF;
      IF fy IS NOT NULL THEN
        UPDATE public.grand_budgets
        SET total_expenses = total_expenses + amt, updated_at = now()
        WHERE financial_year_id = fy;
      END IF;
      INSERT INTO public.budget_ledger (financial_year_id, entry_type, category_id, amount, reference_id, reference_table, note)
      VALUES (fy, 'expense_debit', NEW.category_id, amt, NEW.id, 'expenses', coalesce(NEW.transaction_id, ''));
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_expense_debit_budget ON public.expenses;
CREATE TRIGGER trg_expense_debit_budget
AFTER UPDATE ON public.expenses
FOR EACH ROW EXECUTE FUNCTION public.debit_budget_on_expense_approved();

-- 7) Role helpers for RLS
CREATE OR REPLACE FUNCTION public.current_user_role()
RETURNS text LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT lower(coalesce(
    (SELECT role FROM public.profiles WHERE auth_id = auth.uid() LIMIT 1),
    ''
  ));
$$;

CREATE OR REPLACE FUNCTION public.is_super_admin()
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT public.current_user_role() IN ('super_admin', 'superadmin');
$$;

CREATE OR REPLACE FUNCTION public.is_admin_or_above()
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT public.current_user_role() IN ('super_admin', 'superadmin', 'administrator', 'admin');
$$;

-- 8) RLS — tighten sensitive tables (profiles, budgets, audit_logs)
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.budgets ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.grand_budgets ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.budget_ledger ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.audit_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.income ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.expenses ENABLE ROW LEVEL SECURITY;

-- Profiles: all auth can read; insert/update own or admin; delete super_admin only for admins
DROP POLICY IF EXISTS "profiles_select_authenticated" ON public.profiles;
CREATE POLICY "profiles_select_authenticated" ON public.profiles
FOR SELECT TO authenticated USING (true);

DROP POLICY IF EXISTS "profiles_insert_authenticated" ON public.profiles;
CREATE POLICY "profiles_insert_authenticated" ON public.profiles
FOR INSERT TO authenticated WITH CHECK (true);

DROP POLICY IF EXISTS "profiles_update_authenticated" ON public.profiles;
CREATE POLICY "profiles_update_authenticated" ON public.profiles
FOR UPDATE TO authenticated
USING (
  auth_id = auth.uid()
  OR public.is_admin_or_above()
)
WITH CHECK (
  auth_id = auth.uid()
  OR public.is_admin_or_above()
);

DROP POLICY IF EXISTS "profiles_delete_authenticated" ON public.profiles;
CREATE POLICY "profiles_delete_authenticated" ON public.profiles
FOR DELETE TO authenticated
USING (
  public.is_super_admin()
  OR (
    public.is_admin_or_above()
    AND lower(coalesce(role, '')) IN ('accountant', '')
  )
);

-- Budgets: read all auth; write admin+
DROP POLICY IF EXISTS "budgets_select_authenticated" ON public.budgets;
CREATE POLICY "budgets_select_authenticated" ON public.budgets
FOR SELECT TO authenticated USING (true);

DROP POLICY IF EXISTS "budgets_insert_authenticated" ON public.budgets;
CREATE POLICY "budgets_insert_authenticated" ON public.budgets
FOR INSERT TO authenticated WITH CHECK (public.is_admin_or_above());

DROP POLICY IF EXISTS "budgets_update_authenticated" ON public.budgets;
CREATE POLICY "budgets_update_authenticated" ON public.budgets
FOR UPDATE TO authenticated USING (public.is_admin_or_above()) WITH CHECK (public.is_admin_or_above());

DROP POLICY IF EXISTS "budgets_delete_authenticated" ON public.budgets;
CREATE POLICY "budgets_delete_authenticated" ON public.budgets
FOR DELETE TO authenticated USING (public.is_admin_or_above());

-- Grand budgets
DROP POLICY IF EXISTS "grand_budgets_select" ON public.grand_budgets;
CREATE POLICY "grand_budgets_select" ON public.grand_budgets
FOR SELECT TO authenticated USING (true);

DROP POLICY IF EXISTS "grand_budgets_write" ON public.grand_budgets;
CREATE POLICY "grand_budgets_write" ON public.grand_budgets
FOR ALL TO authenticated
USING (public.is_admin_or_above())
WITH CHECK (public.is_admin_or_above());

DROP POLICY IF EXISTS "budget_ledger_select" ON public.budget_ledger;
CREATE POLICY "budget_ledger_select" ON public.budget_ledger
FOR SELECT TO authenticated USING (true);

DROP POLICY IF EXISTS "budget_ledger_insert" ON public.budget_ledger;
CREATE POLICY "budget_ledger_insert" ON public.budget_ledger
FOR INSERT TO authenticated WITH CHECK (public.is_admin_or_above() OR true);

-- Audit logs: read admin+; insert all; delete only super_admin
DROP POLICY IF EXISTS "audit_logs_select_authenticated" ON public.audit_logs;
CREATE POLICY "audit_logs_select_authenticated" ON public.audit_logs
FOR SELECT TO authenticated USING (public.is_admin_or_above());

DROP POLICY IF EXISTS "audit_logs_insert_authenticated" ON public.audit_logs;
CREATE POLICY "audit_logs_insert_authenticated" ON public.audit_logs
FOR INSERT TO authenticated WITH CHECK (true);

DROP POLICY IF EXISTS "audit_logs_delete_authenticated" ON public.audit_logs;
CREATE POLICY "audit_logs_delete_authenticated" ON public.audit_logs
FOR DELETE TO authenticated USING (public.is_super_admin());

-- Income / expenses: authenticated CRUD for active use (app enforces finer rules)
DROP POLICY IF EXISTS "income_all_auth" ON public.income;
CREATE POLICY "income_all_auth" ON public.income
FOR ALL TO authenticated USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "expenses_all_auth" ON public.expenses;
CREATE POLICY "expenses_all_auth" ON public.expenses
FOR ALL TO authenticated USING (true) WITH CHECK (true);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.profiles TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.budgets TO authenticated;
GRANT SELECT, INSERT, UPDATE ON public.grand_budgets TO authenticated;
GRANT SELECT, INSERT ON public.budget_ledger TO authenticated;
GRANT SELECT, INSERT ON public.audit_logs TO authenticated;
GRANT DELETE ON public.audit_logs TO authenticated;

-- 9) Promote primary admin to super_admin (adjust email if needed)
UPDATE public.profiles
SET role = 'super_admin', status = 'active'
WHERE lower(email) = lower('admin@selambertu.org');

-- If no row matched, leave existing administrator as-is
