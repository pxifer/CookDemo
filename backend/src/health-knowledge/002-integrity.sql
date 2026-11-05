-- Additive research-only migration. Frozen 001 and production migrations stay unchanged.
CREATE TABLE IF NOT EXISTS health_kb.health_bundle_snapshots (
  bundle_id text PRIMARY KEY REFERENCES health_kb.health_releases(id),
  metadata jsonb NOT NULL, canonical_hash text NOT NULL CHECK(length(canonical_hash)=64)
);
REVOKE ALL ON health_kb.health_bundle_snapshots FROM PUBLIC;
CREATE OR REPLACE FUNCTION health_kb.reject_research_mutation() RETURNS trigger
LANGUAGE plpgsql AS $$ BEGIN RAISE EXCEPTION 'HEALTH_RESEARCH_IMMUTABLE_USE_NEW_BUNDLE_OR_REVOCATION'; END $$;
DO $guard$
DECLARE t text;
BEGIN
  FOREACH t IN ARRAY ARRAY['health_releases','health_documents','health_entities','health_aliases',
    'health_evidence_chunks','health_facts','health_fact_evidence','health_rule_versions',
    'health_conflicts','health_index_manifests','health_bundle_snapshots','health_revocations']
  LOOP
    IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname='immutable_research_'||t
      AND tgrelid=('health_kb.'||t)::regclass AND NOT tgisinternal) THEN
      EXECUTE format('CREATE TRIGGER %I BEFORE UPDATE OR DELETE ON health_kb.%I FOR EACH ROW EXECUTE FUNCTION health_kb.reject_research_mutation()', 'immutable_research_'||t,t);
    END IF;
  END LOOP;
END $guard$;
