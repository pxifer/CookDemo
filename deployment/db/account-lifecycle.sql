-- Append-only account revocation for actual CloudBase encrypted account tables.
-- Apply after account-sync.sql and health-chat.sql. No user payload is copied.
CREATE TABLE public.shiwei_account_tombstones (
  owner_id text PRIMARY KEY,
  operation_id uuid NOT NULL UNIQUE,
  state text NOT NULL CHECK(state IN ('private_revoked','completed')),
  created_at timestamptz NOT NULL DEFAULT now(),
  completed_at timestamptz
);
ALTER TABLE public.shiwei_account_tombstones ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.shiwei_account_tombstones FORCE ROW LEVEL SECURITY;
REVOKE ALL ON public.shiwei_account_tombstones FROM PUBLIC,anon,authenticated,service_role;
GRANT SELECT ON public.shiwei_account_tombstones TO authenticated;
GRANT SELECT,INSERT,UPDATE ON public.shiwei_account_tombstones TO service_role;
CREATE POLICY shiwei_tombstone_owner ON public.shiwei_account_tombstones TO authenticated USING(owner_id=auth.uid()::text);
CREATE POLICY shiwei_tombstone_service ON public.shiwei_account_tombstones TO service_role USING(true) WITH CHECK(true);
GRANT SELECT,UPDATE ON public.shiwei_account_state TO service_role;
GRANT SELECT,DELETE ON public.shiwei_account_sessions TO service_role;
CREATE POLICY shiwei_erasure_state_service ON public.shiwei_account_state TO service_role USING(true) WITH CHECK(true);
CREATE POLICY shiwei_erasure_sessions_service ON public.shiwei_account_sessions TO service_role USING(true) WITH CHECK(true);
DROP POLICY shiwei_account_owner ON public.shiwei_account_state;
CREATE POLICY shiwei_account_owner ON public.shiwei_account_state TO authenticated
  USING(owner_id=auth.uid()::text AND NOT EXISTS(SELECT 1 FROM shiwei_account_tombstones WHERE owner_id=auth.uid()::text))
  WITH CHECK(owner_id=auth.uid()::text AND NOT EXISTS(SELECT 1 FROM shiwei_account_tombstones WHERE owner_id=auth.uid()::text));

CREATE OR REPLACE FUNCTION public.shiwei_session_check(p_session text) RETURNS jsonb LANGUAGE sql SECURITY INVOKER SET search_path=public,pg_temp AS $$
  SELECT jsonb_build_object('active',NOT EXISTS(SELECT 1 FROM shiwei_account_tombstones WHERE owner_id=auth.uid()::text)
    AND EXISTS(SELECT 1 FROM shiwei_account_sessions WHERE owner_id=auth.uid()::text AND session_hash=p_session AND expires_at>now()),
    'password_initialized',COALESCE((SELECT password_initialized FROM shiwei_account_state WHERE owner_id=auth.uid()::text),false));
$$;
CREATE OR REPLACE FUNCTION public.shiwei_session_start(p_session text,p_expires timestamptz) RETURNS jsonb LANGUAGE plpgsql SECURITY INVOKER SET search_path=public,pg_temp AS $$
BEGIN
  IF auth.uid() IS NULL OR p_expires<=now() OR p_expires>now()+interval '31 minutes'
    OR EXISTS(SELECT 1 FROM shiwei_account_tombstones WHERE owner_id=auth.uid()::text) THEN RAISE EXCEPTION 'invalid session'; END IF;
  INSERT INTO shiwei_account_state(owner_id) VALUES(auth.uid()::text) ON CONFLICT DO NOTHING;
  PERFORM 1 FROM shiwei_account_state WHERE owner_id=auth.uid()::text FOR UPDATE;
  IF EXISTS(SELECT 1 FROM shiwei_account_tombstones WHERE owner_id=auth.uid()::text) THEN RAISE EXCEPTION 'account revoked'; END IF;
  DELETE FROM shiwei_account_sessions WHERE owner_id=auth.uid()::text AND expires_at<=now();
  IF (SELECT count(*) FROM shiwei_account_sessions WHERE owner_id=auth.uid()::text)>=20 THEN RAISE EXCEPTION 'session limit'; END IF;
  INSERT INTO shiwei_account_sessions(session_hash,expires_at) VALUES(p_session,p_expires);
  RETURN (SELECT jsonb_build_object('password_initialized',password_initialized) FROM shiwei_account_state WHERE owner_id=auth.uid()::text);
END $$;
CREATE FUNCTION public.shiwei_erasure_begin(p_owner text,p_session text,p_operation uuid) RETURNS jsonb LANGUAGE plpgsql SECURITY INVOKER SET search_path=public,pg_temp AS $$
BEGIN
  PERFORM 1 FROM shiwei_account_state WHERE owner_id=p_owner FOR UPDATE;
  IF EXISTS(SELECT 1 FROM shiwei_account_tombstones WHERE owner_id=p_owner AND operation_id=p_operation) THEN RETURN jsonb_build_object('revoked',true); END IF;
  IF p_operation IS NULL OR NOT EXISTS(SELECT 1 FROM shiwei_account_sessions WHERE owner_id=p_owner AND session_hash=p_session AND expires_at>now()) THEN RAISE EXCEPTION 'invalid erasure session'; END IF;
  INSERT INTO shiwei_account_tombstones(owner_id,operation_id,state) VALUES(p_owner,p_operation,'private_revoked');
  UPDATE shiwei_account_state SET envelope=NULL,version=version+1,password_initialized=false,updated_at=now() WHERE owner_id=p_owner;
  DELETE FROM shiwei_account_sessions WHERE owner_id=p_owner;
  RETURN jsonb_build_object('revoked',true);
END $$;
CREATE FUNCTION public.shiwei_erasure_finish(p_owner text,p_operation uuid) RETURNS jsonb LANGUAGE plpgsql SECURITY INVOKER SET search_path=public,pg_temp AS $$
BEGIN
  UPDATE shiwei_account_tombstones SET state='completed',completed_at=now() WHERE owner_id=p_owner AND operation_id=p_operation;
  IF NOT FOUND THEN RAISE EXCEPTION 'erasure intent missing'; END IF;
  RETURN jsonb_build_object('completed',true);
END $$;
REVOKE ALL ON FUNCTION public.shiwei_erasure_begin(text,text,uuid),public.shiwei_erasure_finish(text,uuid) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.shiwei_erasure_begin(text,text,uuid),public.shiwei_erasure_finish(text,uuid) TO service_role;
COMMENT ON TABLE public.shiwei_account_tombstones IS 'Account revocation metadata; independent durable journal must be confirmed by server before service-role begin. Never clear during restore or rollback. Immutable to users.';
NOTIFY pgrst,'reload schema';
