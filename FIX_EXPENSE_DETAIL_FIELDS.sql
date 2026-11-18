-- Optional: add denormalized name columns so Expense Details never loses labels
-- Run in Supabase SQL editor once

ALTER TABLE public.expenses ADD COLUMN IF NOT EXISTS category_name TEXT;
ALTER TABLE public.expenses ADD COLUMN IF NOT EXISTS payment_method_name TEXT;
ALTER TABLE public.expenses ADD COLUMN IF NOT EXISTS created_by_name TEXT;
ALTER TABLE public.expenses ADD COLUMN IF NOT EXISTS requested_by_name TEXT;

-- Backfill names from lookup tables where IDs exist
UPDATE public.expenses e
SET category_name = c.name
FROM public.expense_categories c
WHERE e.category_id = c.id AND (e.category_name IS NULL OR e.category_name = '');

UPDATE public.expenses e
SET payment_method_name = p.name
FROM public.payment_methods p
WHERE e.payment_method_id = p.id AND (e.payment_method_name IS NULL OR e.payment_method_name = '');

UPDATE public.expenses e
SET created_by_name = COALESCE(pr.full_name, pr.email)
FROM public.profiles pr
WHERE e.created_by = pr.id AND (e.created_by_name IS NULL OR e.created_by_name = '');

UPDATE public.expenses e
SET requested_by_name = COALESCE(pr.full_name, pr.email)
FROM public.profiles pr
WHERE e.requested_by = pr.id AND (e.requested_by_name IS NULL OR e.requested_by_name = '');
