-- 1) Accountants can read budgets
ALTER TABLE public.budgets ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "budgets_select_authenticated" ON public.budgets;
CREATE POLICY "budgets_select_authenticated" ON public.budgets
FOR SELECT TO authenticated USING (true);
GRANT SELECT ON public.budgets TO authenticated;

-- 2) Optional name column for reliable matching
ALTER TABLE public.budgets ADD COLUMN IF NOT EXISTS category_name TEXT;
ALTER TABLE public.budgets ADD COLUMN IF NOT EXISTS allocated_amount NUMERIC;

-- 3) Backfill names from expense_categories
UPDATE public.budgets b
SET category_name = c.name
FROM public.expense_categories c
WHERE b.category_name IS NULL AND b.category_id = c.id;

-- 4) Backfill allocated_amount from budget_amount
UPDATE public.budgets
SET allocated_amount = budget_amount
WHERE allocated_amount IS NULL AND budget_amount IS NOT NULL;
