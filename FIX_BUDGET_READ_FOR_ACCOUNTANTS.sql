-- Allow authenticated users (accountants) to READ budgets so expense checks work.
-- Admins still manage (insert/update/delete) budgets in the app.

ALTER TABLE public.budgets ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "budgets_select_authenticated" ON public.budgets;
CREATE POLICY "budgets_select_authenticated"
ON public.budgets
FOR SELECT
TO authenticated
USING (true);

-- Optional: if RLS is off and you use grants instead:
GRANT SELECT ON public.budgets TO authenticated;
