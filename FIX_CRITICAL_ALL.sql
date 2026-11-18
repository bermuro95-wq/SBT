
-- ============================================================
-- SELAM BERTU TESFA — Critical fixes
-- Password recovery support, profiles/users store, purge balances
-- ============================================================

-- A) Profiles table writable + columns
ALTER TABLE public.profiles DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS auth_id UUID;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS full_name TEXT;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS email TEXT;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS role TEXT DEFAULT 'accountant';
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS status TEXT DEFAULT 'active';
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS avatar_url TEXT;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ DEFAULT NOW();
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS last_login TIMESTAMPTZ;
CREATE UNIQUE INDEX IF NOT EXISTS profiles_auth_id_uidx ON public.profiles(auth_id);

-- Open policies (authenticated can manage profiles — needed for admin add-user)
DROP POLICY IF EXISTS profiles_all ON public.profiles;
DROP POLICY IF EXISTS profiles_select ON public.profiles;
DROP POLICY IF EXISTS profiles_insert ON public.profiles;
DROP POLICY IF EXISTS profiles_update ON public.profiles;
DROP POLICY IF EXISTS profiles_admin_delete ON public.profiles;
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
CREATE POLICY profiles_all ON public.profiles
  FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- Auto profile when Auth user is created (helps admin signUp)
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.profiles (auth_id, email, full_name, role, status)
  VALUES (
    NEW.id,
    NEW.email,
    COALESCE(NEW.raw_user_meta_data->>'full_name', split_part(NEW.email, '@', 1)),
    COALESCE(NEW.raw_user_meta_data->>'role', 'accountant'),
    'active'
  )
  ON CONFLICT (auth_id) DO UPDATE SET
    email = EXCLUDED.email,
    full_name = COALESCE(EXCLUDED.full_name, public.profiles.full_name),
    role = COALESCE(EXCLUDED.role, public.profiles.role);
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- B) Financial tables open for store/delete
DO $$
DECLARE t text;
BEGIN
  FOREACH t IN ARRAY ARRAY[
    'income','expenses','budgets','financial_years','receipts',
    'approvals','audit_logs','audit_evidence','notifications','memos',
    'income_categories','expense_categories','payment_methods'
  ]
  LOOP
    BEGIN
      EXECUTE format('ALTER TABLE public.%I DISABLE ROW LEVEL SECURITY', t);
    EXCEPTION WHEN undefined_table THEN NULL;
    END;
  END LOOP;
END $$;

ALTER TABLE public.financial_years ADD COLUMN IF NOT EXISTS opening_balance NUMERIC(18,2) DEFAULT 0;
ALTER TABLE public.financial_years ADD COLUMN IF NOT EXISTS annual_budget NUMERIC(18,2) DEFAULT 0;

-- C) Amount columns wide enough
DO $$ BEGIN
  ALTER TABLE public.income ALTER COLUMN amount TYPE NUMERIC(18,2);
EXCEPTION WHEN others THEN NULL; END $$;
DO $$ BEGIN
  ALTER TABLE public.expenses ALTER COLUMN amount TYPE NUMERIC(18,2);
EXCEPTION WHEN others THEN NULL; END $$;

SELECT 'OK: profiles, trigger, RLS, balances ready' AS status;
