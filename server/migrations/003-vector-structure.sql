-- Optional: --vector. Installs storage only, with no chosen model or embedding rows.
CREATE EXTENSION IF NOT EXISTS vector;
CREATE TABLE embedding_indexes (
  id text PRIMARY KEY, release_id text NOT NULL REFERENCES catalog_releases(id),
  model_id text NOT NULL, model_revision text NOT NULL,
  dimensions integer NOT NULL CHECK (dimensions BETWEEN 1 AND 16000),
  distance_metric text NOT NULL CHECK (distance_metric IN ('cosine','l2','inner_product')),
  representation_version text NOT NULL, normalization text NOT NULL,
  state text NOT NULL DEFAULT 'draft' CHECK (state IN ('draft','ready','withdrawn')),
  created_at timestamptz NOT NULL DEFAULT now(), UNIQUE (id,release_id,dimensions)
);
CREATE TABLE recipe_variant_embeddings (
  index_id text NOT NULL, release_id text NOT NULL, variant_id text NOT NULL,
  dimensions integer NOT NULL, text_hash text NOT NULL, embedding vector NOT NULL,
  PRIMARY KEY (index_id,variant_id),
  FOREIGN KEY (index_id,release_id,dimensions) REFERENCES embedding_indexes(id,release_id,dimensions),
  FOREIGN KEY (release_id,variant_id) REFERENCES catalog_variants(release_id,id),
  CHECK (vector_dims(embedding) = dimensions)
);
COMMENT ON TABLE recipe_variant_embeddings IS '仅公共菜谱变体向量；禁止写入个人查询、健康限制和推荐历史。';
-- Small catalogues use exact search. No HNSW/IVFFlat index is created by default.
