-- Run in Supabase SQL Editor: recalculate grand_budgets.total_income from real approved income
-- income uses approval_status; expenses uses status

DO $$
DECLARE
  inc numeric := 0;
  exp numeric := 0;
BEGIN
  SELECT COALESCE(SUM(amount), 0) INTO inc
  FROM public.income
  WHERE COALESCE(is_deleted, false) = false
    AND lower(COALESCE(approval_status, '')) = 'approved';

  SELECT COALESCE(SUM(amount), 0) INTO exp
  FROM public.expenses
  WHERE COALESCE(is_deleted, false) = false
    AND lower(COALESCE(status, '')) = 'approved';

  UPDATE public.grand_budgets
  SET total_income = inc,
      total_expenses = exp,
      updated_at = now();

  -- If no row exists, create one
  IF NOT EXISTS (SELECT 1 FROM public.grand_budgets) THEN
    INSERT INTO public.grand_budgets (total_income, total_expenses, annual_limit, opening_balance, total_allocated, total_released)
    VALUES (inc, exp, 0, 0, 0, 0);
  END IF;
END $$;

-- Verify
SELECT 'grand_budgets' AS source, total_income, total_expenses, annual_limit, opening_balance
FROM public.grand_budgets;

SELECT COALESCE(SUM(amount),0) AS approved_income_from_rows
FROM public.income
WHERE COALESCE(is_deleted,false)=false
  AND lower(COALESCE(approval_status,''))='approved';

SELECT id, amount, approval_status, is_deleted, created_at
FROM public.income
ORDER BY created_at DESC
LIMIT 15;
