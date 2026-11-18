
ALTER TABLE public.expenses ADD COLUMN IF NOT EXISTS created_by UUID;
ALTER TABLE public.expenses ADD COLUMN IF NOT EXISTS requested_by UUID;
ALTER TABLE public.expenses ADD COLUMN IF NOT EXISTS created_by_name TEXT;
ALTER TABLE public.expenses ADD COLUMN IF NOT EXISTS requested_by_name TEXT;

ALTER TABLE public.income ADD COLUMN IF NOT EXISTS created_by UUID;
ALTER TABLE public.income ADD COLUMN IF NOT EXISTS requested_by UUID;
ALTER TABLE public.income ADD COLUMN IF NOT EXISTS created_by_name TEXT;
ALTER TABLE public.income ADD COLUMN IF NOT EXISTS requested_by_name TEXT;

-- Backfill names from profiles when ids exist
UPDATE public.expenses e
SET created_by_name = p.full_name
FROM public.profiles p
WHERE e.created_by_name IS NULL AND e.created_by IS NOT NULL AND (e.created_by = p.id OR e.created_by = p.auth_id);

UPDATE public.expenses e
SET requested_by_name = p.full_name
FROM public.profiles p
WHERE e.requested_by_name IS NULL AND e.requested_by IS NOT NULL AND (e.requested_by = p.id OR e.requested_by = p.auth_id);

UPDATE public.income i
SET created_by_name = p.full_name
FROM public.profiles p
WHERE i.created_by_name IS NULL AND i.created_by IS NOT NULL AND (i.created_by = p.id OR i.created_by = p.auth_id);

UPDATE public.income i
SET requested_by_name = p.full_name
FROM public.profiles p
WHERE i.requested_by_name IS NULL AND i.requested_by IS NOT NULL AND (i.requested_by = p.id OR i.requested_by = p.auth_id);
