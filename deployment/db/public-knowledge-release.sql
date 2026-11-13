-- Versioned public facts only. No account, profile, query, credential or invocation data.
CREATE TABLE public.shiwei_knowledge_releases (
 release_id text PRIMARY KEY CHECK(release_id ~ '^knowledge-[a-z0-9-]{1,65}$'),
 checksum text NOT NULL CHECK(checksum ~ '^[a-f0-9]{64}$'),
 payload jsonb NOT NULL CHECK(jsonb_typeof(payload)='object'),
 revocations jsonb NOT NULL DEFAULT '[]' CHECK(jsonb_typeof(revocations)='array'),
 published boolean NOT NULL DEFAULT false,
 created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.shiwei_knowledge_releases ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.shiwei_knowledge_releases FORCE ROW LEVEL SECURITY;
REVOKE ALL ON public.shiwei_knowledge_releases FROM PUBLIC,anon,authenticated,service_role;
GRANT SELECT(release_id,checksum,payload,revocations,published) ON public.shiwei_knowledge_releases TO anon;
CREATE POLICY published_knowledge ON public.shiwei_knowledge_releases FOR SELECT TO anon USING(published);
CREATE FUNCTION public.shiwei_knowledge_immutable() RETURNS trigger LANGUAGE plpgsql SET search_path=pg_catalog AS $$
BEGIN
 IF TG_OP='DELETE' THEN RAISE EXCEPTION 'Knowledge history cannot be deleted'; END IF;
 IF NEW.release_id<>OLD.release_id OR NEW.checksum<>OLD.checksum OR NEW.payload<>OLD.payload OR NEW.created_at<>OLD.created_at THEN RAISE EXCEPTION 'Knowledge content requires a new release'; END IF;
 IF NOT NEW.revocations @> OLD.revocations THEN RAISE EXCEPTION 'Knowledge withdrawals cannot be removed'; END IF;
 RETURN NEW;
END $$;
CREATE TRIGGER shiwei_knowledge_immutable BEFORE UPDATE OR DELETE ON public.shiwei_knowledge_releases FOR EACH ROW EXECUTE FUNCTION public.shiwei_knowledge_immutable();
