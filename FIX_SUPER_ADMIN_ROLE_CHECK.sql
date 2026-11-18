-- Fix: allow super_admin on profiles.role (constraint was too narrow)

-- 1) Drop the old check constraint
ALTER TABLE public.profiles DROP CONSTRAINT IF EXISTS profiles_role_check;

-- 2) Recreate with super_admin included
ALTER TABLE public.profiles
ADD CONSTRAINT profiles_role_check
CHECK (
  role IS NULL
  OR lower(role) IN (
    'super_admin',
    'superadmin',
    'administrator',
    'admin',
    'accountant'
  )
);

-- 3) Promote Super Admin
UPDATE public.profiles
SET role = 'super_admin', status = 'active'
WHERE lower(trim(email)) = lower('admin@selambertu.org');

-- 4) Verify
SELECT email, role, status FROM public.profiles
WHERE lower(email) = lower('admin@selambertu.org');
