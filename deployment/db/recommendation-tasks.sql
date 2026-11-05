-- Per-page AI task ordering; metadata only. Apply before enabling the runtime flag.
CREATE TABLE public.shiwei_recommendation_tasks (
  owner_id text NOT NULL DEFAULT auth.uid()::text,
  task_id uuid NOT NULL,
  meal_version integer NOT NULL CHECK(meal_version>=0),
  operation_id uuid NOT NULL,
  touched_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY(owner_id,task_id)
);
ALTER TABLE public.shiwei_recommendation_tasks ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.shiwei_recommendation_tasks FORCE ROW LEVEL SECURITY;
REVOKE ALL ON public.shiwei_recommendation_tasks FROM PUBLIC,anon,authenticated,service_role;
GRANT SELECT,INSERT,UPDATE,DELETE ON public.shiwei_recommendation_tasks TO authenticated;
CREATE POLICY shiwei_recommendation_task_owner ON public.shiwei_recommendation_tasks TO authenticated
  USING(owner_id=auth.uid()::text) WITH CHECK(owner_id=auth.uid()::text);

CREATE FUNCTION public.shiwei_recommendation_task_advance(p_session text,p_task uuid,p_version integer,p_operation uuid)
RETURNS jsonb LANGUAGE plpgsql SECURITY INVOKER SET search_path=public,pg_temp AS $$
DECLARE uid text:=auth.uid()::text; previous_version integer;
BEGIN
  IF uid IS NULL OR p_task IS NULL OR p_operation IS NULL OR p_version IS NULL OR p_version<0
    OR NOT COALESCE((public.shiwei_session_check(p_session)->>'active')::boolean,false)
    OR NOT COALESCE((public.shiwei_session_check(p_session)->>'password_initialized')::boolean,false) THEN RAISE EXCEPTION 'invalid task session'; END IF;
  PERFORM 1 FROM public.shiwei_account_state WHERE owner_id=uid FOR UPDATE;
  DELETE FROM public.shiwei_recommendation_tasks WHERE owner_id=uid AND touched_at<now()-interval '31 minutes';
  SELECT meal_version INTO previous_version FROM public.shiwei_recommendation_tasks WHERE owner_id=uid AND task_id=p_task;
  IF previous_version IS NOT NULL AND previous_version>p_version THEN RETURN jsonb_build_object('accepted',false,'reason','stale'); END IF;
  IF previous_version IS NULL AND (SELECT count(*) FROM public.shiwei_recommendation_tasks WHERE owner_id=uid)>=128 THEN RETURN jsonb_build_object('accepted',false,'reason','limit'); END IF;
  INSERT INTO public.shiwei_recommendation_tasks(owner_id,task_id,meal_version,operation_id) VALUES(uid,p_task,p_version,p_operation)
    ON CONFLICT(owner_id,task_id) DO UPDATE SET meal_version=EXCLUDED.meal_version,operation_id=EXCLUDED.operation_id,touched_at=now();
  RETURN jsonb_build_object('accepted',true,'reason','current');
END $$;
CREATE FUNCTION public.shiwei_recommendation_task_current(p_session text,p_task uuid,p_version integer,p_operation uuid)
RETURNS jsonb LANGUAGE sql SECURITY INVOKER SET search_path=public,pg_temp AS $$
  SELECT jsonb_build_object('current',COALESCE((public.shiwei_session_check(p_session)->>'active')::boolean,false)
    AND EXISTS(SELECT 1 FROM public.shiwei_recommendation_tasks WHERE owner_id=auth.uid()::text AND task_id=p_task AND meal_version=p_version AND operation_id=p_operation AND touched_at>now()-interval '31 minutes'));
$$;
REVOKE ALL ON FUNCTION public.shiwei_recommendation_task_advance(text,uuid,integer,uuid),public.shiwei_recommendation_task_current(text,uuid,integer,uuid) FROM PUBLIC,anon,service_role;
GRANT EXECUTE ON FUNCTION public.shiwei_recommendation_task_advance(text,uuid,integer,uuid),public.shiwei_recommendation_task_current(text,uuid,integer,uuid) TO authenticated;
COMMENT ON TABLE public.shiwei_recommendation_tasks IS 'Transient AI task ordering metadata only: no keys, meals, profiles, chats, choices or recommendation history. Separate from one-shot paid invocation claims.';
NOTIFY pgrst, 'reload schema';
