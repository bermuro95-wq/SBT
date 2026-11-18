-- ============================================================
-- Production RLS Policies
-- ============================================================

ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE income ENABLE ROW LEVEL SECURITY;
ALTER TABLE expenses ENABLE ROW LEVEL SECURITY;
ALTER TABLE financial_years ENABLE ROW LEVEL SECURITY;
ALTER TABLE income_categories ENABLE ROW LEVEL SECURITY;
ALTER TABLE expense_categories ENABLE ROW LEVEL SECURITY;
ALTER TABLE payment_methods ENABLE ROW LEVEL SECURITY;
ALTER TABLE budgets ENABLE ROW LEVEL SECURITY;
ALTER TABLE budget_categories ENABLE ROW LEVEL SECURITY;
ALTER TABLE receipts ENABLE ROW LEVEL SECURITY;
ALTER TABLE transaction_documents ENABLE ROW LEVEL SECURITY;
ALTER TABLE approvals ENABLE ROW LEVEL SECURITY;
ALTER TABLE audit_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE notifications ENABLE ROW LEVEL SECURITY;
ALTER TABLE system_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE roles ENABLE ROW LEVEL SECURITY;
ALTER TABLE permissions ENABLE ROW LEVEL SECURITY;
ALTER TABLE role_permissions ENABLE ROW LEVEL SECURITY;
ALTER TABLE transaction_history ENABLE ROW LEVEL SECURITY;

DO $$
DECLARE r RECORD;
BEGIN
  FOR r IN (SELECT policyname, tablename FROM pg_policies WHERE schemaname = 'public') LOOP
    EXECUTE format('DROP POLICY IF EXISTS %I ON public.%I', r.policyname, r.tablename);
  END LOOP;
END $$;

-- Active authenticated users only for most ops
-- PROFILES
CREATE POLICY profiles_select ON profiles FOR SELECT TO authenticated
  USING (public.is_active_user() OR public.is_admin());
CREATE POLICY profiles_update ON profiles FOR UPDATE TO authenticated
  USING (auth_id = auth.uid() OR public.is_admin());
CREATE POLICY profiles_insert ON profiles FOR INSERT TO authenticated
  WITH CHECK (auth_id = auth.uid() OR public.is_admin());
CREATE POLICY profiles_admin_delete ON profiles FOR DELETE TO authenticated
  USING (public.is_admin());

-- INCOME / EXPENSES: active users; soft-delete aware
CREATE POLICY income_select ON income FOR SELECT TO authenticated
  USING (public.is_active_user() AND (is_deleted IS NOT TRUE OR public.is_admin()));
CREATE POLICY income_insert ON income FOR INSERT TO authenticated
  WITH CHECK (public.is_active_user());
CREATE POLICY income_update ON income FOR UPDATE TO authenticated
  USING (public.is_active_user());
CREATE POLICY income_delete ON income FOR DELETE TO authenticated
  USING (public.is_admin());

CREATE POLICY expenses_select ON expenses FOR SELECT TO authenticated
  USING (public.is_active_user() AND (is_deleted IS NOT TRUE OR public.is_admin()));
CREATE POLICY expenses_insert ON expenses FOR INSERT TO authenticated
  WITH CHECK (public.is_active_user());
CREATE POLICY expenses_update ON expenses FOR UPDATE TO authenticated
  USING (public.is_active_user());
CREATE POLICY expenses_delete ON expenses FOR DELETE TO authenticated
  USING (public.is_admin());

-- Lookups
CREATE POLICY fy_all ON financial_years FOR ALL TO authenticated
  USING (public.is_active_user()) WITH CHECK (public.is_active_user());
CREATE POLICY inc_cat ON income_categories FOR ALL TO authenticated
  USING (public.is_active_user()) WITH CHECK (public.is_admin() OR true);
CREATE POLICY exp_cat ON expense_categories FOR ALL TO authenticated
  USING (public.is_active_user()) WITH CHECK (public.is_admin() OR true);
CREATE POLICY pay_m ON payment_methods FOR ALL TO authenticated
  USING (public.is_active_user()) WITH CHECK (public.is_admin() OR true);

CREATE POLICY budgets_all ON budgets FOR ALL TO authenticated
  USING (public.is_active_user()) WITH CHECK (public.is_active_user());
CREATE POLICY budget_cat ON budget_categories FOR ALL TO authenticated
  USING (public.is_active_user()) WITH CHECK (public.is_active_user());

CREATE POLICY receipts_all ON receipts FOR ALL TO authenticated
  USING (public.is_active_user()) WITH CHECK (public.is_active_user());
CREATE POLICY docs_all ON transaction_documents FOR ALL TO authenticated
  USING (public.is_active_user()) WITH CHECK (public.is_active_user());

-- Approvals: any active can read; write for active (UI restricts approve to admin)
CREATE POLICY approvals_all ON approvals FOR ALL TO authenticated
  USING (public.is_active_user()) WITH CHECK (public.is_active_user());

-- Audit: read admin-only; insert any authenticated via function preferred
CREATE POLICY audit_select ON audit_logs FOR SELECT TO authenticated
  USING (public.is_admin());
CREATE POLICY audit_insert ON audit_logs FOR INSERT TO authenticated
  WITH CHECK (public.is_active_user());

CREATE POLICY notif_all ON notifications FOR ALL TO authenticated
  USING (user_id = public.current_profile_id() OR public.is_admin())
  WITH CHECK (user_id = public.current_profile_id() OR public.is_admin());

CREATE POLICY settings_select ON system_settings FOR SELECT TO authenticated
  USING (public.is_active_user());
CREATE POLICY settings_write ON system_settings FOR ALL TO authenticated
  USING (public.is_admin()) WITH CHECK (public.is_admin());

CREATE POLICY roles_select ON roles FOR SELECT TO authenticated USING (true);
CREATE POLICY perm_select ON permissions FOR SELECT TO authenticated USING (true);
CREATE POLICY rp_select ON role_permissions FOR SELECT TO authenticated USING (true);

CREATE POLICY th_select ON transaction_history FOR SELECT TO authenticated
  USING (public.is_active_user());
CREATE POLICY th_insert ON transaction_history FOR INSERT TO authenticated
  WITH CHECK (public.is_active_user());
