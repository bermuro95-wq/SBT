-- ============================================================
-- Allow Super Admin purge to wipe ALL financial data
-- including Budget History (budget_ledger) and grand_budgets
-- Run once in Supabase SQL Editor
-- ============================================================

-- Open DELETE on all operational tables for authenticated
-- (UI restricts the purge button to Super Admin only)

DO $$
DECLARE
  t text;
BEGIN
  FOREACH t IN ARRAY ARRAY[
    'budget_ledger',
    'grand_budgets',
    'receipts',
    'approvals',
    'audit_evidence',
    'notifications',
    'memos',
    'income',
    'expenses',
    'budgets',
    'audit_logs'
  ]
  LOOP
    BEGIN
      EXECUTE format('ALTER TABLE IF EXISTS public.%I ENABLE ROW LEVEL SECURITY', t);
      EXECUTE format('DROP POLICY IF EXISTS %I ON public.%I', t || '_delete_purge', t);
      EXECUTE format(
        'CREATE POLICY %I ON public.%I FOR DELETE TO authenticated USING (true)',
        t || '_delete_purge', t
      );
      EXECUTE format('GRANT SELECT, DELETE ON public.%I TO authenticated', t);
    EXCEPTION WHEN undefined_table THEN
      RAISE NOTICE 'skip missing table %', t;
    WHEN OTHERS THEN
      RAISE NOTICE 'policy on %: %', t, SQLERRM;
    END;
  END LOOP;
END $$;

-- Optional: one-shot wipe right now (run as postgres / service role in SQL editor)
-- Uncomment to delete everything immediately:

/*
TRUNCATE TABLE
  public.budget_ledger,
  public.grand_budgets,
  public.receipts,
  public.approvals,
  public.audit_evidence,
  public.notifications,
  public.memos,
  public.income,
  public.expenses,
  public.budgets,
  public.audit_logs
RESTART IDENTITY CASCADE;

UPDATE public.financial_years
SET opening_balance = 0, annual_budget = 0;
*/

SELECT 'Purge policies ready. Use Settings → Danger Zone, or uncomment TRUNCATE above.' AS info;
