-- ============================================================
-- SELAM BERTU TESFA - Audit System Enhancements
-- Backward-compatible additions for comprehensive audit logging
-- Safe to run on existing production databases
-- ============================================================

-- Ensure audit_logs has all required columns (idempotent)
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='audit_logs' AND column_name='severity') THEN
    ALTER TABLE public.audit_logs ADD COLUMN severity TEXT DEFAULT 'info'
      CHECK (severity IN ('info','warning','critical','suspicious'));
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='audit_logs' AND column_name='ip_address') THEN
    ALTER TABLE public.audit_logs ADD COLUMN ip_address TEXT;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='audit_logs' AND column_name='user_agent') THEN
    ALTER TABLE public.audit_logs ADD COLUMN user_agent TEXT;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='audit_logs' AND column_name='user_name') THEN
    ALTER TABLE public.audit_logs ADD COLUMN user_name TEXT;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='audit_logs' AND column_name='role_at_event') THEN
    ALTER TABLE public.audit_logs ADD COLUMN role_at_event TEXT;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='audit_logs' AND column_name='correlation_id') THEN
    ALTER TABLE public.audit_logs ADD COLUMN correlation_id TEXT;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='audit_logs' AND column_name='integrity_hash') THEN
    ALTER TABLE public.audit_logs ADD COLUMN integrity_hash TEXT;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='audit_logs' AND column_name='created_at') THEN
    ALTER TABLE public.audit_logs ADD COLUMN created_at TIMESTAMPTZ DEFAULT NOW();
  END IF;
END $$;

-- Indexes for fast search / filter / pagination
CREATE INDEX IF NOT EXISTS idx_audit_action ON public.audit_logs(action);
CREATE INDEX IF NOT EXISTS idx_audit_entity ON public.audit_logs(entity);
CREATE INDEX IF NOT EXISTS idx_audit_user ON public.audit_logs(user_id);
CREATE INDEX IF NOT EXISTS idx_audit_result ON public.audit_logs(result);
CREATE INDEX IF NOT EXISTS idx_audit_severity ON public.audit_logs(severity);
CREATE INDEX IF NOT EXISTS idx_audit_ts_desc ON public.audit_logs(timestamp DESC);
CREATE INDEX IF NOT EXISTS idx_audit_event_id ON public.audit_logs(event_id);

-- Harden: prevent ordinary updates/deletes of audit rows
-- (only service_role / superuser can bypass; RLS already blocks non-admin SELECT)
DROP POLICY IF EXISTS audit_no_update ON public.audit_logs;
CREATE POLICY audit_no_update ON public.audit_logs
  FOR UPDATE TO authenticated
  USING (false);

DROP POLICY IF EXISTS audit_no_delete ON public.audit_logs;
CREATE POLICY audit_no_delete ON public.audit_logs
  FOR DELETE TO authenticated
  USING (false);

-- Enhanced write_audit_log RPC (captures more context, severity, UA)
CREATE OR REPLACE FUNCTION public.write_audit_log(
  p_action TEXT,
  p_entity TEXT DEFAULT NULL,
  p_entity_id UUID DEFAULT NULL,
  p_old JSONB DEFAULT NULL,
  p_new JSONB DEFAULT NULL,
  p_metadata JSONB DEFAULT NULL,
  p_result TEXT DEFAULT 'success',
  p_severity TEXT DEFAULT 'info',
  p_ip TEXT DEFAULT NULL,
  p_user_agent TEXT DEFAULT NULL
) RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  new_id UUID;
  v_profile_id UUID;
  v_user_name TEXT;
  v_role TEXT;
  v_event_id TEXT;
  v_hash TEXT;
BEGIN
  v_profile_id := public.current_profile_id();
  SELECT full_name, role INTO v_user_name, v_role
  FROM public.profiles WHERE id = v_profile_id LIMIT 1;

  v_event_id := 'AUD-' || to_char(NOW() AT TIME ZONE 'UTC', 'YYYYMMDD') || '-' ||
                substr(replace(gen_random_uuid()::text, '-', ''), 1, 10);

  -- Simple integrity hash (not cryptographic chain; indicates record was written by RPC)
  v_hash := encode(
    digest(
      coalesce(v_event_id,'') || coalesce(p_action,'') || coalesce(p_entity,'') ||
      coalesce(p_entity_id::text,'') || coalesce(p_result,'') || coalesce(v_profile_id::text,''),
      'sha256'
    ),
    'hex'
  );

  INSERT INTO public.audit_logs (
    event_id, user_id, user_name, role_at_event, action, entity, entity_id,
    old_value, new_value, metadata, result, severity,
    ip_address, user_agent, integrity_hash, timestamp, created_at
  ) VALUES (
    v_event_id, v_profile_id, v_user_name, v_role, p_action, p_entity, p_entity_id,
    p_old, p_new, p_metadata, p_result,
    COALESCE(NULLIF(p_severity,''), 'info'),
    p_ip, p_user_agent, v_hash, NOW(), NOW()
  ) RETURNING id INTO new_id;

  RETURN new_id;
END;
$$;

GRANT EXECUTE ON FUNCTION public.write_audit_log TO authenticated;

-- Helper to log failed login attempts (no authenticated user yet)
-- Called from client after failed sign-in; limited fields only
CREATE OR REPLACE FUNCTION public.write_failed_login_audit(
  p_email TEXT,
  p_ip TEXT DEFAULT NULL,
  p_user_agent TEXT DEFAULT NULL,
  p_reason TEXT DEFAULT 'invalid_credentials'
) RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  new_id UUID;
  v_event_id TEXT;
BEGIN
  v_event_id := 'AUD-' || to_char(NOW() AT TIME ZONE 'UTC', 'YYYYMMDD') || '-' ||
                substr(replace(gen_random_uuid()::text, '-', ''), 1, 10);

  INSERT INTO public.audit_logs (
    event_id, action, entity, result, severity, metadata,
    ip_address, user_agent, user_name, timestamp, created_at
  ) VALUES (
    v_event_id,
    'LOGIN_FAILED',
    'auth',
    'failure',
    'warning',
    jsonb_build_object(
      'email_attempted', left(coalesce(p_email,''), 120),
      'reason', p_reason
    ),
    p_ip,
    left(coalesce(p_user_agent,''), 500),
    left(coalesce(p_email,''), 120),
    NOW(),
    NOW()
  ) RETURNING id INTO new_id;

  RETURN new_id;
END;
$$;

-- Allow anon + authenticated to call failed-login logger (no secrets stored)
GRANT EXECUTE ON FUNCTION public.write_failed_login_audit TO anon, authenticated;

-- Comment for operators
COMMENT ON FUNCTION public.write_audit_log IS
  'Trusted server-side audit writer. Prefer this over direct INSERT. Captures actor, severity, integrity hash.';
COMMENT ON FUNCTION public.write_failed_login_audit IS
  'Records failed authentication attempts without requiring a session. Never stores passwords.';
