
-- Allow admin full delete on budgets and audit_logs (and related tables)

-- Budgets: authenticated can read; delete/update for authenticated (app restricts UI to admin)
DROP POLICY IF EXISTS "budgets_delete_authenticated" ON public.budgets;
CREATE POLICY "budgets_delete_authenticated" ON public.budgets
FOR DELETE TO authenticated USING (true);

DROP POLICY IF EXISTS "budgets_all_admin" ON public.budgets;
-- Optional open write for authenticated if admin-only UI is used
DROP POLICY IF EXISTS "budgets_insert_authenticated" ON public.budgets;
CREATE POLICY "budgets_insert_authenticated" ON public.budgets
FOR INSERT TO authenticated WITH CHECK (true);

DROP POLICY IF EXISTS "budgets_update_authenticated" ON public.budgets;
CREATE POLICY "budgets_update_authenticated" ON public.budgets
FOR UPDATE TO authenticated USING (true) WITH CHECK (true);

-- Audit logs: allow insert by all authenticated; allow delete for purge
ALTER TABLE public.audit_logs ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "audit_logs_insert_authenticated" ON public.audit_logs;
CREATE POLICY "audit_logs_insert_authenticated" ON public.audit_logs
FOR INSERT TO authenticated WITH CHECK (true);

DROP POLICY IF EXISTS "audit_logs_select_authenticated" ON public.audit_logs;
CREATE POLICY "audit_logs_select_authenticated" ON public.audit_logs
FOR SELECT TO authenticated USING (true);

DROP POLICY IF EXISTS "audit_logs_delete_authenticated" ON public.audit_logs;
CREATE POLICY "audit_logs_delete_authenticated" ON public.audit_logs
FOR DELETE TO authenticated USING (true);

GRANT SELECT, INSERT, DELETE ON public.audit_logs TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.budgets TO authenticated;
