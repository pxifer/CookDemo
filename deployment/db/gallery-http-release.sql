-- Public recipe facts only. No account/profile/credential/query data belongs here.
CREATE TABLE public.shiwei_gallery_releases (
  release_id text PRIMARY KEY CHECK (release_id ~ '^[a-z0-9-]{1,80}$'),
  checksum text NOT NULL CHECK (checksum ~ '^[a-f0-9]{64}$'),
  payload jsonb NOT NULL CHECK (jsonb_typeof(payload) = 'object'),
  published boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.shiwei_gallery_releases ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.shiwei_gallery_releases FORCE ROW LEVEL SECURITY;
REVOKE ALL ON public.shiwei_gallery_releases FROM PUBLIC, anon, authenticated, service_role;
GRANT USAGE ON SCHEMA public TO anon;
GRANT SELECT (release_id, payload, published) ON public.shiwei_gallery_releases TO anon;
CREATE POLICY shiwei_public_recipe_release ON public.shiwei_gallery_releases
  FOR SELECT TO anon USING (published);
