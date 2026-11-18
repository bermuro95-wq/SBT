-- ============================================================
-- CREATE grand_budgets NOW (safe — no FK dependency)
-- Copy ALL of this into Supabase SQL Editor → Run
-- ============================================================

-- 1) Create table WITHOUT foreign key (avoids failure if financial_years missing/empty)
CREATE TABLE IF NOT EXISTS public.grand_budgets (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  financial_year_id uuid NULL,
  annual_limit numeric(18,2) NOT NULL DEFAULT 0,
  opening_balance numeric(18,2) NOT NULL DEFAULT 0,
  total_income numeric(18,2) NOT NULL DEFAULT 0,
  total_allocated numeric(18,2) NOT NULL DEFAULT 0,
  total_expenses numeric(18,2) NOT NULL DEFAULT 0,
  total_released numeric(18,2) NOT NULL DEFAULT 0,
  notes text,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Unique index only when FY is set (allows one row with NULL FY)
CREATE UNIQUE INDEX IF NOT EXISTS grand_budgets_fy_uidx
  ON public.grand_budgets (financial_year_id)
  WHERE financial_year_id IS NOT NULL;

-- 2) RLS so authenticated users can read/write
ALTER TABLE public.grand_budgets ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS grand_budgets_select ON public.grand_budgets;
DROP POLICY IF EXISTS grand_budgets_insert ON public.grand_budgets;
DROP POLICY IF EXISTS grand_budgets_update ON public.grand_budgets;
DROP POLICY IF EXISTS grand_budgets_delete ON public.grand_budgets;
DROP POLICY IF EXISTS grand_budgets_all ON public.grand_budgets;

CREATE POLICY grand_budgets_select ON public.grand_budgets
  FOR SELECT TO authenticated USING (true);
CREATE POLICY grand_budgets_insert ON public.grand_budgets
  FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY grand_budgets_update ON public.grand_budgets
  FOR UPDATE TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY grand_budgets_delete ON public.grand_budgets
  FOR DELETE TO authenticated USING (true);

-- 3) Helper roles (safe if already exist)
CREATE OR REPLACE FUNCTION public.is_admin()
RETURNS BOOLEAN LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.profiles
    WHERE auth_id = auth.uid()
      AND status = 'active'
      AND lower(COALESCE(role, '')) IN ('super_admin', 'superadmin', 'administrator', 'admin')
  );
$$;

CREATE OR REPLACE FUNCTION public.is_super_admin()
RETURNS BOOLEAN LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.profiles
    WHERE auth_id = auth.uid()
      AND status = 'active'
      AND lower(COALESCE(role, '')) IN ('super_admin', 'superadmin')
  );
$$;

-- 4) system_settings (for Security & Access page)
CREATE TABLE IF NOT EXISTS public.system_settings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  key TEXT NOT NULL UNIQUE,
  value TEXT,
  description TEXT,
  updated_by UUID,
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE public.system_settings ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS settings_select ON public.system_settings;
DROP POLICY IF EXISTS settings_write ON public.system_settings;
CREATE POLICY settings_select ON public.system_settings
  FOR SELECT TO authenticated USING (true);
CREATE POLICY settings_write ON public.system_settings
  FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- 5) budget_ledger (history)
CREATE TABLE IF NOT EXISTS public.budget_ledger (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  financial_year_id uuid,
  entry_type text NOT NULL,
  category_id uuid,
  amount numeric(18,2) NOT NULL DEFAULT 0,
  reference_id uuid,
  reference_table text,
  note text,
  created_at timestamptz DEFAULT now()
);
ALTER TABLE public.budget_ledger ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS budget_ledger_all ON public.budget_ledger;
CREATE POLICY budget_ledger_all ON public.budget_ledger
  FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- 6) Seed one Grand Budget row + sync from approved income
DO $$
DECLARE
  inc numeric := 0;
  exp numeric := 0;
  gid uuid;
BEGIN
  BEGIN
    SELECT COALESCE(SUM(amount), 0) INTO inc
    FROM public.income
    WHERE COALESCE(is_deleted, false) = false
      AND lower(COALESCE(approval_status, status, '')) = 'approved';
  EXCEPTION WHEN undefined_table THEN
    inc := 0;
  END;

  BEGIN
    SELECT COALESCE(SUM(amount), 0) INTO exp
    FROM public.expenses
    WHERE COALESCE(is_deleted, false) = false
      AND lower(COALESCE(approval_status, status, '')) = 'approved';
  EXCEPTION WHEN undefined_table THEN
    exp := 0;
  END;

  SELECT id INTO gid FROM public.grand_budgets LIMIT 1;
  IF gid IS NULL THEN
    INSERT INTO public.grand_budgets (
      total_income, total_expenses, opening_balance, annual_limit, total_allocated, total_released
    ) VALUES (inc, exp, 0, 0, 0, 0);
  ELSE
    UPDATE public.grand_budgets
    SET total_income = inc,
        total_expenses = exp,
        updated_at = now()
    WHERE id = gid;
  END IF;
END $$;

-- 7) Verify — this must return rows (not an error)
SELECT id, annual_limit, opening_balance, total_income, total_allocated, total_expenses
FROM public.grand_budgets;
