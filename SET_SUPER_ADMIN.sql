
-- Make sure Super Admin exists and can use the system
-- 1) Ensure role column accepts super_admin
UPDATE public.profiles
SET role = 'super_admin', status = 'active'
WHERE lower(trim(email)) IN (
  lower('admin@selambertu.org')
);

-- Optional: promote another email (edit then run)
-- UPDATE public.profiles SET role = 'super_admin', status = 'active'
-- WHERE lower(trim(email)) = lower('your@email.com');

-- Verify
SELECT id, email, role, status FROM public.profiles ORDER BY role, email;
