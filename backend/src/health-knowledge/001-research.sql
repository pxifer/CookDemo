-- Explicit opt-in research schema. Not registered in production migrations.
CREATE SCHEMA IF NOT EXISTS health_kb;
REVOKE ALL ON SCHEMA health_kb FROM PUBLIC;
CREATE TABLE IF NOT EXISTS health_kb.health_releases (
  id text PRIMARY KEY, bundle_hash text NOT NULL CHECK (length(bundle_hash)=64),
  state text NOT NULL CHECK (state='research_ready'), clinical_release jsonb CHECK (clinical_release IS NULL),
  manifest jsonb NOT NULL, imported_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE IF NOT EXISTS health_kb.health_documents (
  bundle_id text NOT NULL REFERENCES health_kb.health_releases(id), id text NOT NULL,
  version text NOT NULL, source_hash text NOT NULL CHECK(length(source_hash)=64),
  state text NOT NULL CHECK(state IN ('active','withdrawn')), document jsonb NOT NULL,
  PRIMARY KEY(bundle_id,id), UNIQUE(bundle_id,id,version,source_hash)
);
CREATE TABLE IF NOT EXISTS health_kb.health_entities (
  bundle_id text NOT NULL REFERENCES health_kb.health_releases(id), id text NOT NULL,
  kind text NOT NULL CHECK(kind IN ('disease','component','food','food_group','process')), name text NOT NULL,
  entity jsonb NOT NULL, PRIMARY KEY(bundle_id,id)
);
CREATE TABLE IF NOT EXISTS health_kb.health_aliases (
  bundle_id text NOT NULL, entity_id text NOT NULL, alias text NOT NULL,
  PRIMARY KEY(bundle_id,entity_id,alias),
  FOREIGN KEY(bundle_id,entity_id) REFERENCES health_kb.health_entities(bundle_id,id)
);
CREATE INDEX IF NOT EXISTS health_alias_lookup ON health_kb.health_aliases(bundle_id,alias);
CREATE TABLE IF NOT EXISTS health_kb.health_evidence_chunks (
  bundle_id text NOT NULL, id text NOT NULL, source_id text NOT NULL, source_version text NOT NULL,
  source_hash text NOT NULL, state text NOT NULL CHECK(state IN ('active','withdrawn')),
  chunk jsonb NOT NULL, search_tokens tsvector NOT NULL,
  PRIMARY KEY(bundle_id,id),
  FOREIGN KEY(bundle_id,source_id,source_version,source_hash)
    REFERENCES health_kb.health_documents(bundle_id,id,version,source_hash)
);
CREATE INDEX IF NOT EXISTS health_evidence_keywords ON health_kb.health_evidence_chunks USING gin(search_tokens);
CREATE TABLE IF NOT EXISTS health_kb.health_facts (
  bundle_id text NOT NULL REFERENCES health_kb.health_releases(id), id text NOT NULL, version text NOT NULL,
  kind text NOT NULL CHECK(kind IN ('disease_component','food_component','food_guidance','cooking_effect')),
  subject_id text NOT NULL, object_id text NOT NULL, predicate text NOT NULL, fact jsonb NOT NULL,
  PRIMARY KEY(bundle_id,id), UNIQUE(bundle_id,id,version),
  FOREIGN KEY(bundle_id,subject_id) REFERENCES health_kb.health_entities(bundle_id,id),
  FOREIGN KEY(bundle_id,object_id) REFERENCES health_kb.health_entities(bundle_id,id),
  CHECK(fact->>'clinicalReview'='pending')
);
CREATE INDEX IF NOT EXISTS health_fact_edges ON health_kb.health_facts(bundle_id,subject_id,kind,object_id);
CREATE TABLE IF NOT EXISTS health_kb.health_fact_evidence (
  bundle_id text NOT NULL, fact_id text NOT NULL, evidence_id text NOT NULL,
  stance text NOT NULL CHECK(stance IN ('support','qualify')),
  PRIMARY KEY(bundle_id,fact_id,evidence_id,stance),
  FOREIGN KEY(bundle_id,fact_id) REFERENCES health_kb.health_facts(bundle_id,id),
  FOREIGN KEY(bundle_id,evidence_id) REFERENCES health_kb.health_evidence_chunks(bundle_id,id)
);
CREATE TABLE IF NOT EXISTS health_kb.health_rule_versions (
  bundle_id text NOT NULL, id text NOT NULL, version text NOT NULL, fact_id text NOT NULL,
  state text NOT NULL CHECK(state='draft'), reviewer text CHECK(reviewer IS NULL),
  PRIMARY KEY(bundle_id,id,version),
  FOREIGN KEY(bundle_id,fact_id,version) REFERENCES health_kb.health_facts(bundle_id,id,version)
);
CREATE TABLE IF NOT EXISTS health_kb.health_revocations (
  target_id text PRIMARY KEY, reason text NOT NULL, withdrawn_at timestamptz NOT NULL DEFAULT now()
);
-- Revocations are global across imported bundles; reimporting cannot clear them.
CREATE TABLE IF NOT EXISTS health_kb.health_conflicts (
  bundle_id text NOT NULL REFERENCES health_kb.health_releases(id), id text NOT NULL,
  record jsonb NOT NULL, PRIMARY KEY(bundle_id,id)
);
CREATE TABLE IF NOT EXISTS health_kb.health_index_manifests (
  bundle_id text PRIMARY KEY REFERENCES health_kb.health_releases(id), kind text NOT NULL CHECK(kind='structured_plus_controlled_keywords'),
  version text NOT NULL, embedding_model text CHECK(embedding_model IS NULL), record jsonb NOT NULL
);
CREATE OR REPLACE VIEW health_kb.health_disease_component_effects AS SELECT * FROM health_kb.health_facts WHERE kind='disease_component';
CREATE OR REPLACE VIEW health_kb.health_food_component_facts AS SELECT * FROM health_kb.health_facts WHERE kind='food_component';
CREATE OR REPLACE VIEW health_kb.health_food_guidance AS SELECT * FROM health_kb.health_facts WHERE kind='food_guidance';
CREATE OR REPLACE VIEW health_kb.health_cooking_effect_facts AS SELECT * FROM health_kb.health_facts WHERE kind='cooking_effect';
REVOKE ALL ON ALL TABLES IN SCHEMA health_kb FROM PUBLIC;
-- No anon/authenticated grants and no publication pointer for the product.
