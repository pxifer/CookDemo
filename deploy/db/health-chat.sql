-- BYOK chat receipts only. No API keys, disease names, prompts, replies or query vectors.
CREATE TABLE public.shiwei_ai_chat_operations (
  owner_id text NOT NULL DEFAULT auth.uid()::text,
  operation_id uuid NOT NULL,
  fingerprint text NOT NULL CHECK (fingerprint ~ '^[a-f0-9]{64}$'),
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY(owner_id,operation_id)
);
CREATE INDEX shiwei_ai_chat_time ON public.shiwei_ai_chat_operations(owner_id,created_at);
ALTER TABLE public.shiwei_ai_chat_operations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.shiwei_ai_chat_operations FORCE ROW LEVEL SECURITY;
REVOKE ALL ON public.shiwei_ai_chat_operations FROM PUBLIC,anon,authenticated,service_role;
-- Immutable to clients: INSERT can only consume an operation, never refund/re-arm one.
GRANT SELECT,INSERT ON public.shiwei_ai_chat_operations TO authenticated;
CREATE POLICY shiwei_ai_chat_owner ON public.shiwei_ai_chat_operations TO authenticated
  USING(owner_id=auth.uid()::text) WITH CHECK(owner_id=auth.uid()::text);

CREATE FUNCTION public.shiwei_ai_chat_claim(p_session text,p_operation uuid,p_fingerprint text)
RETURNS jsonb LANGUAGE plpgsql SECURITY INVOKER SET search_path=public,pg_temp AS $$
DECLARE uid text:=auth.uid()::text; claimed integer;
BEGIN
  IF uid IS NULL OR NOT (public.shiwei_session_check(p_session)->>'active')::boolean
    OR NOT (public.shiwei_session_check(p_session)->>'password_initialized')::boolean THEN
    RAISE EXCEPTION 'session expired';
  END IF;
  IF p_fingerprint IS NULL OR p_fingerprint !~ '^[a-f0-9]{64}$' THEN RAISE EXCEPTION 'invalid fingerprint'; END IF;
  -- Serialize calls by account across sessions/instances in this short transaction.
  PERFORM 1 FROM public.shiwei_account_state WHERE owner_id=uid FOR UPDATE;
  IF EXISTS(SELECT 1 FROM public.shiwei_ai_chat_operations WHERE owner_id=uid AND operation_id=p_operation) THEN
    RETURN jsonb_build_object('claimed',false,'reason','duplicate');
  END IF;
  IF (SELECT count(*) FROM public.shiwei_ai_chat_operations WHERE owner_id=uid AND created_at>now()-interval '1 minute')>=6
    OR (SELECT count(*) FROM public.shiwei_ai_chat_operations WHERE owner_id=uid AND created_at>now()-interval '1 day')>=120 THEN
    RETURN jsonb_build_object('claimed',false,'reason','limit');
  END IF;
  INSERT INTO public.shiwei_ai_chat_operations(owner_id,operation_id,fingerprint) VALUES(uid,p_operation,p_fingerprint)
    ON CONFLICT DO NOTHING;
  GET DIAGNOSTICS claimed=ROW_COUNT;
  RETURN jsonb_build_object('claimed',claimed=1,'reason',CASE WHEN claimed=1 THEN 'claimed' ELSE 'duplicate' END);
END $$;
REVOKE ALL ON FUNCTION public.shiwei_ai_chat_claim(text,uuid,text) FROM PUBLIC,anon,service_role;
GRANT EXECUTE ON FUNCTION public.shiwei_ai_chat_claim(text,uuid,text) TO authenticated;
COMMENT ON TABLE public.shiwei_ai_chat_operations IS 'BYOK one-shot claims; immutable to app users; no keys or health/chat payload. Administrative retention cleanup must not replay old operations.';
NOTIFY pgrst, 'reload schema';
