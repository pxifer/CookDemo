-- Explicit research-only extension. This file is not a production migration.
-- Frozen knowledge bundles and the existing recipe-variant index are unchanged.
CREATE EXTENSION IF NOT EXISTS vector;
CREATE TABLE IF NOT EXISTS health_kb.vector_index_manifests (
  id text PRIMARY KEY,
  bundle_id text NOT NULL REFERENCES health_kb.health_bundle_snapshots(bundle_id),
  bundle_hash text NOT NULL CHECK (length(bundle_hash)=64),
  identity_hash text NOT NULL CHECK (length(identity_hash)=64),
  identity jsonb NOT NULL,
  dimensions integer NOT NULL CHECK (dimensions BETWEEN 1 AND 16000),
  expected_chunks integer NOT NULL CHECK (expected_chunks > 0),
  payload_hash text NOT NULL CHECK (length(payload_hash)=64),
  state text NOT NULL CHECK (state='ready'),
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(id,bundle_id,dimensions),
  CHECK (identity->>'normalization'='l2'),
  CHECK ((identity->>'dimensions')::integer=dimensions)
);
CREATE TABLE IF NOT EXISTS health_kb.evidence_embeddings (
  index_id text NOT NULL,
  bundle_id text NOT NULL,
  evidence_id text NOT NULL,
  dimensions integer NOT NULL,
  text_hash text NOT NULL CHECK (length(text_hash)=64),
  vector_hash text NOT NULL CHECK (length(vector_hash)=64),
  embedding vector NOT NULL,
  PRIMARY KEY(index_id,evidence_id),
  FOREIGN KEY(index_id,bundle_id,dimensions)
    REFERENCES health_kb.vector_index_manifests(id,bundle_id,dimensions),
  FOREIGN KEY(bundle_id,evidence_id)
    REFERENCES health_kb.health_evidence_chunks(bundle_id,id),
  CHECK (vector_dims(embedding)=dimensions)
);
-- No HNSW/IVFFlat: exact cosine is the correctness baseline for this small corpus.
DO $guard$
DECLARE t text;
BEGIN
  FOREACH t IN ARRAY ARRAY['vector_index_manifests','evidence_embeddings']
  LOOP
    IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname='immutable_research_'||t
      AND tgrelid=('health_kb.'||t)::regclass AND NOT tgisinternal) THEN
      EXECUTE format('CREATE TRIGGER %I BEFORE UPDATE OR DELETE ON health_kb.%I FOR EACH ROW EXECUTE FUNCTION health_kb.reject_research_mutation()', 'immutable_research_'||t,t);
    END IF;
  END LOOP;
END $guard$;
REVOKE ALL ON health_kb.vector_index_manifests,health_kb.evidence_embeddings FROM PUBLIC;
COMMENT ON TABLE health_kb.evidence_embeddings IS
  'Public research evidence only. No personal queries, health profiles, conversations or recommendation history.';
