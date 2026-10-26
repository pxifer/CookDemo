-- Private encrypted business state. User identity is always the verified gateway JWT sub.
CREATE TABLE public.shiwei_account_state (
  owner_id text PRIMARY KEY DEFAULT auth.uid()::text,
  version integer NOT NULL DEFAULT 0 CHECK(version>=0),
  envelope jsonb,
  password_initialized boolean NOT NULL DEFAULT false,
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE public.shiwei_account_sessions (
  owner_id text NOT NULL DEFAULT auth.uid()::text,
  session_hash text NOT NULL CHECK(session_hash ~ '^[a-f0-9]{64}$'),
  expires_at timestamptz NOT NULL,
  PRIMARY KEY(owner_id,session_hash)
);
ALTER TABLE public.shiwei_account_state ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.shiwei_account_state FORCE ROW LEVEL SECURITY;
ALTER TABLE public.shiwei_account_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.shiwei_account_sessions FORCE ROW LEVEL SECURITY;
REVOKE ALL ON public.shiwei_account_state,public.shiwei_account_sessions FROM PUBLIC,anon,authenticated,service_role;
GRANT SELECT,INSERT,UPDATE ON public.shiwei_account_state TO authenticated;
GRANT SELECT,INSERT,DELETE ON public.shiwei_account_sessions TO authenticated;
CREATE POLICY shiwei_account_owner ON public.shiwei_account_state TO authenticated USING(owner_id=auth.uid()::text) WITH CHECK(owner_id=auth.uid()::text);
CREATE POLICY shiwei_session_owner ON public.shiwei_account_sessions TO authenticated USING(owner_id=auth.uid()::text) WITH CHECK(owner_id=auth.uid()::text);

CREATE FUNCTION public.shiwei_session_start(p_session text,p_expires timestamptz) RETURNS jsonb LANGUAGE plpgsql SECURITY INVOKER SET search_path=public,pg_temp AS $$
BEGIN
  IF auth.uid() IS NULL OR p_expires<=now() OR p_expires>now()+interval '31 minutes' THEN RAISE EXCEPTION 'invalid session'; END IF;
  INSERT INTO shiwei_account_state(owner_id) VALUES(auth.uid()::text) ON CONFLICT DO NOTHING;
  DELETE FROM shiwei_account_sessions WHERE owner_id=auth.uid()::text AND expires_at<=now();
  IF (SELECT count(*) FROM shiwei_account_sessions WHERE owner_id=auth.uid()::text)>=20 THEN RAISE EXCEPTION 'session limit'; END IF;
  INSERT INTO shiwei_account_sessions(session_hash,expires_at) VALUES(p_session,p_expires);
  RETURN (SELECT jsonb_build_object('password_initialized',password_initialized) FROM shiwei_account_state WHERE owner_id=auth.uid()::text);
END $$;
CREATE FUNCTION public.shiwei_session_check(p_session text) RETURNS jsonb LANGUAGE sql SECURITY INVOKER SET search_path=public,pg_temp AS $$
  SELECT jsonb_build_object('active',EXISTS(SELECT 1 FROM shiwei_account_sessions WHERE owner_id=auth.uid()::text AND session_hash=p_session AND expires_at>now()),'password_initialized',COALESCE((SELECT password_initialized FROM shiwei_account_state WHERE owner_id=auth.uid()::text),false));
$$;
CREATE FUNCTION public.shiwei_account_load(p_session text) RETURNS jsonb LANGUAGE plpgsql SECURITY INVOKER SET search_path=public,pg_temp AS $$
BEGIN
  IF NOT (shiwei_session_check(p_session)->>'active')::boolean THEN RAISE EXCEPTION 'session expired'; END IF;
  RETURN (SELECT jsonb_build_object('version',version,'envelope',envelope) FROM shiwei_account_state WHERE owner_id=auth.uid()::text);
END $$;
CREATE FUNCTION public.shiwei_account_save(p_session text,p_expected integer,p_envelope jsonb) RETURNS jsonb LANGUAGE plpgsql SECURITY INVOKER SET search_path=public,pg_temp AS $$
DECLARE next_version integer;
BEGIN
  IF NOT (shiwei_session_check(p_session)->>'active')::boolean THEN RAISE EXCEPTION 'session expired'; END IF;
  IF jsonb_typeof(p_envelope)<>'object' OR octet_length(p_envelope::text)>100000 OR NOT p_envelope ?& ARRAY['ciphertext','nonce','tag','keyVersion'] THEN RAISE EXCEPTION 'invalid envelope'; END IF;
  UPDATE shiwei_account_state SET version=version+1,envelope=p_envelope,updated_at=now() WHERE owner_id=auth.uid()::text AND version=p_expected AND password_initialized RETURNING version INTO next_version;
  RETURN CASE WHEN next_version IS NULL THEN jsonb_build_object('conflict',true) ELSE jsonb_build_object('version',next_version) END;
END $$;
CREATE FUNCTION public.shiwei_session_end(p_session text) RETURNS jsonb LANGUAGE sql SECURITY INVOKER SET search_path=public,pg_temp AS $$
  WITH removed AS (DELETE FROM shiwei_account_sessions WHERE owner_id=auth.uid()::text AND session_hash=p_session RETURNING 1) SELECT jsonb_build_object('ended',true);
$$;
CREATE FUNCTION public.shiwei_password_initialized(p_session text) RETURNS jsonb LANGUAGE plpgsql SECURITY INVOKER SET search_path=public,pg_temp AS $$
BEGIN
  IF NOT (shiwei_session_check(p_session)->>'active')::boolean THEN RAISE EXCEPTION 'session expired'; END IF;
  UPDATE shiwei_account_state SET password_initialized=true WHERE owner_id=auth.uid()::text;
  DELETE FROM shiwei_account_sessions WHERE owner_id=auth.uid()::text AND session_hash<>p_session;
  RETURN jsonb_build_object('initialized',true);
END $$;
REVOKE ALL ON FUNCTION public.shiwei_session_start(text,timestamptz),public.shiwei_session_check(text),public.shiwei_account_load(text),public.shiwei_account_save(text,integer,jsonb),public.shiwei_session_end(text),public.shiwei_password_initialized(text) FROM PUBLIC,anon,service_role;
GRANT EXECUTE ON FUNCTION public.shiwei_session_start(text,timestamptz),public.shiwei_session_check(text),public.shiwei_account_load(text),public.shiwei_account_save(text,integer,jsonb),public.shiwei_session_end(text),public.shiwei_password_initialized(text) TO authenticated;
NOTIFY pgrst, 'reload schema';
