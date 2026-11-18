-- ============================================================
-- FIX: Grand Budget + Settings for Super Admin
-- Run once in Supabase SQL Editor
-- ============================================================

-- 1) is_admin must include super_admin
CREATE OR REPLACE FUNCTION public.is_admin()
RETURNS BOOLEAN LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.profiles
    WHERE auth_id = auth.uid()
      AND status = 'active'
      AND lower(role) IN ('super_admin', 'superadmin', 'administrator', 'admin')
  );
$$;

CREATE OR REPLACE FUNCTION public.is_super_admin()
RETURNS BOOLEAN LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.profiles
    WHERE auth_id = auth.uid()
      AND status = 'active'
      AND lower(role) IN ('super_admin', 'superadmin')
  );
$$;

CREATE OR REPLACE FUNCTION public.is_admin_or_above()
RETURNS BOOLEAN LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT public.is_admin();
$$;

-- 2) Grand budgets table + open RLS
-- NOTE: no FK on financial_year_id — avoids CREATE failure when financial_years is missing
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
CREATE UNIQUE INDEX IF NOT EXISTS grand_budgets_fy_uidx
  ON public.grand_budgets (financial_year_id)
  WHERE financial_year_id IS NOT NULL;

ALTER TABLE public.grand_budgets ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS grand_budgets_select ON public.grand_budgets;
DROP POLICY IF EXISTS grand_budgets_all ON public.grand_budgets;
DROP POLICY IF EXISTS grand_budgets_insert ON public.grand_budgets;
DROP POLICY IF EXISTS grand_budgets_update ON public.grand_budgets;
DROP POLICY IF EXISTS grand_budgets_delete ON public.grand_budgets;

CREATE POLICY grand_budgets_select ON public.grand_budgets
  FOR SELECT TO authenticated USING (true);
CREATE POLICY grand_budgets_insert ON public.grand_budgets
  FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY grand_budgets_update ON public.grand_budgets
  FOR UPDATE TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY grand_budgets_delete ON public.grand_budgets
  FOR DELETE TO authenticated USING (public.is_admin());

-- 3) system_settings writable by admin + super_admin
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
DROP POLICY IF EXISTS system_settings_all ON public.system_settings;

CREATE POLICY settings_select ON public.system_settings
  FOR SELECT TO authenticated USING (true);
CREATE POLICY settings_write ON public.system_settings
  FOR ALL TO authenticated
  USING (public.is_admin())
  WITH CHECK (public.is_admin());

-- 4) budget_ledger
CREATE TABLE IF NOT EXISTS public.budget_ledger (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  financial_year_id uuid,
  entry_type text NOT NULL,
  category_id uuid,
  amount numeric(18,2) NOT NULL,
  reference_id uuid,
  reference_table text,
  note text,
  created_at timestamptz DEFAULT now()
);
ALTER TABLE public.budget_ledger ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS budget_ledger_all ON public.budget_ledger;
CREATE POLICY budget_ledger_all ON public.budget_ledger
  FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- 5) One-shot: sync Grand Budget from already-approved income & expenses
-- NOTE: income table uses column "approval_status"
--       expenses table uses column "status"
DO $$
DECLARE
  inc numeric := 0;
  exp numeric := 0;
  gid uuid;
BEGIN
  -- income → approval_status only
  SELECT COALESCE(SUM(amount), 0) INTO inc
  FROM public.income
  WHERE COALESCE(is_deleted, false) = false
    AND lower(COALESCE(approval_status, '')) = 'approved';

  -- expenses → status only
  SELECT COALESCE(SUM(amount), 0) INTO exp
  FROM public.expenses
  WHERE COALESCE(is_deleted, false) = false
    AND lower(COALESCE(status, '')) = 'approved';

  SELECT id INTO gid FROM public.grand_budgets LIMIT 1;
  IF gid IS NULL THEN
    INSERT INTO public.grand_budgets (total_income, total_expenses, opening_balance, annual_limit, total_allocated, total_released)
    VALUES (inc, exp, 0, 0, 0, 0);
  ELSE
    UPDATE public.grand_budgets
    SET total_income = inc,
        total_expenses = exp,
        updated_at = now()
    WHERE id = gid;
  END IF;
END $$;

-- 6) Seed security defaults
INSERT INTO public.system_settings (key, value) VALUES
  ('max_login_attempts', '5'),
  ('lockout_minutes', '15'),
  ('password_lock_enabled', 'true'),
  ('allow_password_reset', 'true'),
  ('block_inactive', 'true'),
  ('require_income_before_expense', 'true'),
  ('session_timeout_minutes', '60')
ON CONFLICT (key) DO NOTHING;

-- Verify
SELECT 'grand_budgets' AS t, total_income, total_expenses FROM public.grand_budgets
UNION ALL
SELECT 'approved_income_sum', COALESCE(SUM(amount),0), 0
FROM public.income
WHERE COALESCE(is_deleted,false)=false AND lower(COALESCE(approval_status,''))='approved';
