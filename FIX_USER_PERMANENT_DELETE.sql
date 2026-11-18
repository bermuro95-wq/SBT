
-- Allow authenticated admins to delete profiles (app enforces admin-only UI)
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "profiles_delete_authenticated" ON public.profiles;
CREATE POLICY "profiles_delete_authenticated"
ON public.profiles FOR DELETE TO authenticated
USING (true);

GRANT DELETE ON public.profiles TO authenticated;

-- Optional: RPC to delete auth user (run as security definer)
CREATE OR REPLACE FUNCTION public.admin_delete_auth_user(target_uid uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Only callable when request has a session; further restrict if needed
  DELETE FROM auth.users WHERE id = target_uid;
EXCEPTION WHEN OTHERS THEN
  RAISE NOTICE 'auth delete skipped: %', SQLERRM;
END;
$$;

GRANT EXECUTE ON FUNCTION public.admin_delete_auth_user(uuid) TO authenticated;
