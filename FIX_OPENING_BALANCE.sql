
-- Ensure opening balance on open year + remove absurd amounts
ALTER TABLE public.financial_years ADD COLUMN IF NOT EXISTS opening_balance NUMERIC(18,2) DEFAULT 0;
ALTER TABLE public.financial_years ADD COLUMN IF NOT EXISTS annual_budget NUMERIC(18,2) DEFAULT 0;

UPDATE public.financial_years
SET opening_balance = 150000,
    annual_budget = COALESCE(NULLIF(annual_budget,0), 2500000),
    status = 'open',
    name = COALESCE(name, '2026 Financial Year'),
    start_date = COALESCE(start_date, '2026-01-01'),
    end_date = COALESCE(end_date, '2026-12-31')
WHERE status = 'open' OR name ILIKE '%2026%';

-- If no open year, insert one
INSERT INTO public.financial_years (name, start_date, end_date, status, opening_balance, annual_budget)
SELECT '2026 Financial Year', '2026-01-01', '2026-12-31', 'open', 150000, 2500000
WHERE NOT EXISTS (SELECT 1 FROM public.financial_years WHERE status = 'open');

-- Zero out absurd corrupted amounts
UPDATE public.income SET amount = 0 WHERE amount IS NULL OR amount > 100000000000 OR amount < 0;
UPDATE public.expenses SET amount = 0 WHERE amount IS NULL OR amount > 100000000000 OR amount < 0;
