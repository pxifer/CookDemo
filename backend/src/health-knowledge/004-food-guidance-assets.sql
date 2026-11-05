-- Additive LOCAL research assets; not registered as a product migration.
CREATE TABLE IF NOT EXISTS health_kb.guidance_assets (
  id text PRIMARY KEY,
  kind text NOT NULL CHECK(kind IN ('goal_knowledge','food_mapping')),
  sha256 text NOT NULL CHECK(length(sha256)=64),
  payload jsonb NOT NULL,
  imported_at timestamptz NOT NULL DEFAULT now()
);
DO $guard$
BEGIN
  IF NOT EXISTS(SELECT 1 FROM pg_trigger WHERE tgname='immutable_research_guidance_assets'
    AND tgrelid='health_kb.guidance_assets'::regclass AND NOT tgisinternal) THEN
    CREATE TRIGGER immutable_research_guidance_assets BEFORE UPDATE OR DELETE ON health_kb.guidance_assets
      FOR EACH ROW EXECUTE FUNCTION health_kb.reject_research_mutation();
  END IF;
END $guard$;
REVOKE ALL ON health_kb.guidance_assets FROM PUBLIC;
COMMENT ON TABLE health_kb.guidance_assets IS 'Public local research goal/mapping snapshots only; no profile, query or clinical publication pointer.';
