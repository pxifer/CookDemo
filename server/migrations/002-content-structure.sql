-- Empty, versioned public content structure. This migration does not admit or seed data.
CREATE TABLE content_sources (
  id text NOT NULL, version text NOT NULL, kind text NOT NULL
    CHECK (kind IN ('recipe','food','nutrition','evidence')),
  title text NOT NULL, source_uri text, license_name text, license_evidence text,
  state text NOT NULL DEFAULT 'pending' CHECK (state IN ('pending','approved','withdrawn')),
  checked_at timestamptz, PRIMARY KEY (id,version),
  CHECK (state <> 'approved' OR (license_name IS NOT NULL AND license_evidence IS NOT NULL AND checked_at IS NOT NULL))
);
CREATE TABLE catalog_releases (
  id text PRIMARY KEY REFERENCES public_releases(id),
  state text NOT NULL DEFAULT 'draft' CHECK (state IN ('draft','published','withdrawn')),
  created_at timestamptz NOT NULL DEFAULT now(), published_at timestamptz,
  CHECK (state <> 'published' OR published_at IS NOT NULL)
);
CREATE TABLE catalog_release_sources (
  release_id text NOT NULL REFERENCES catalog_releases(id), source_id text NOT NULL, source_version text NOT NULL,
  PRIMARY KEY (release_id,source_id,source_version),
  FOREIGN KEY (source_id,source_version) REFERENCES content_sources(id,version)
);
CREATE TABLE catalog_foods (
  release_id text NOT NULL REFERENCES catalog_releases(id), id text NOT NULL,
  name text NOT NULL, default_unit text NOT NULL CHECK (default_unit IN ('g','个','ml')),
  form text NOT NULL, components_complete boolean NOT NULL DEFAULT false,
  allergens text[] NOT NULL DEFAULT '{}',
  state text NOT NULL DEFAULT 'draft' CHECK (state IN ('draft','published','withdrawn')),
  PRIMARY KEY (release_id,id)
);
CREATE TABLE catalog_food_aliases (
  release_id text NOT NULL, food_id text NOT NULL, alias text NOT NULL,
  PRIMARY KEY (release_id,food_id,alias), FOREIGN KEY (release_id,food_id) REFERENCES catalog_foods(release_id,id)
);
CREATE INDEX catalog_food_alias_lookup ON catalog_food_aliases(release_id,alias);
CREATE TABLE catalog_food_relations (
  release_id text NOT NULL, food_id text NOT NULL, related_food_id text NOT NULL,
  kind text NOT NULL CHECK (kind IN ('contains','category_member','substitute')),
  PRIMARY KEY (release_id,food_id,related_food_id,kind),
  FOREIGN KEY (release_id,food_id) REFERENCES catalog_foods(release_id,id),
  FOREIGN KEY (release_id,related_food_id) REFERENCES catalog_foods(release_id,id)
);
CREATE TABLE catalog_nutrition (
  release_id text NOT NULL, food_id text NOT NULL, nutrient text NOT NULL,
  value numeric(18,6) NOT NULL CHECK (value >= 0), unit text NOT NULL,
  edible_basis_grams numeric(12,3) NOT NULL DEFAULT 100 CHECK (edible_basis_grams = 100),
  source_id text NOT NULL, source_version text NOT NULL, source_record_id text NOT NULL,
  PRIMARY KEY (release_id,food_id,nutrient,source_id,source_version),
  FOREIGN KEY (release_id,food_id) REFERENCES catalog_foods(release_id,id),
  FOREIGN KEY (release_id,source_id,source_version) REFERENCES catalog_release_sources(release_id,source_id,source_version)
);
CREATE TABLE catalog_recipes (
  release_id text NOT NULL REFERENCES catalog_releases(id), id text NOT NULL, name text NOT NULL,
  category text NOT NULL CHECK (category IN ('meat','veg','soup')), home_style boolean NOT NULL,
  minutes integer NOT NULL CHECK (minutes > 0),
  state text NOT NULL DEFAULT 'draft' CHECK (state IN ('draft','published','withdrawn')),
  source_id text NOT NULL, source_version text NOT NULL,
  PRIMARY KEY (release_id,id),
  FOREIGN KEY (release_id,source_id,source_version) REFERENCES catalog_release_sources(release_id,source_id,source_version)
);
CREATE TABLE catalog_variants (
  release_id text NOT NULL, id text NOT NULL, recipe_id text NOT NULL, flavor text NOT NULL,
  state text NOT NULL DEFAULT 'draft' CHECK (state IN ('draft','published','withdrawn')),
  PRIMARY KEY (release_id,id), FOREIGN KEY (release_id,recipe_id) REFERENCES catalog_recipes(release_id,id)
);
CREATE INDEX catalog_variant_parent ON catalog_variants(release_id,recipe_id);
CREATE TABLE catalog_variant_lines (
  release_id text NOT NULL, variant_id text NOT NULL, position integer NOT NULL CHECK (position >= 0),
  food_id text NOT NULL, amount numeric(15,3) NOT NULL CHECK (amount > 0),
  unit text NOT NULL CHECK (unit IN ('g','个','ml')),
  role text NOT NULL CHECK (role IN ('main','auxiliary','seasoning')),
  basis text NOT NULL CHECK (basis IN ('edible','as_purchased','unknown')), form text NOT NULL,
  optional boolean NOT NULL DEFAULT false, edible_grams numeric(15,3) CHECK (edible_grams > 0),
  PRIMARY KEY (release_id,variant_id,position),
  FOREIGN KEY (release_id,variant_id) REFERENCES catalog_variants(release_id,id),
  FOREIGN KEY (release_id,food_id) REFERENCES catalog_foods(release_id,id)
);
COMMENT ON TABLE catalog_variant_lines IS '固定整道变体用量；人数只影响菜数，不缩放单道配料。';
CREATE TABLE catalog_variant_steps (
  release_id text NOT NULL, variant_id text NOT NULL, position integer NOT NULL CHECK (position >= 0),
  instruction text NOT NULL CHECK (length(instruction) > 0),
  PRIMARY KEY (release_id,variant_id,position),
  FOREIGN KEY (release_id,variant_id) REFERENCES catalog_variants(release_id,id)
);
CREATE TABLE catalog_search_documents (
  release_id text NOT NULL, variant_id text NOT NULL, representation_version text NOT NULL,
  text_hash text NOT NULL, search_text text NOT NULL,
  tokens tsvector NOT NULL,
  PRIMARY KEY (release_id,variant_id,representation_version),
  FOREIGN KEY (release_id,variant_id) REFERENCES catalog_variants(release_id,id)
);
CREATE INDEX catalog_search_tokens ON catalog_search_documents USING gin(tokens);
COMMENT ON COLUMN catalog_search_documents.tokens IS '受控中文词典先分词，再使用 simple 配置；非 BM25。';
CREATE TABLE app_sessions (
  token_hash text PRIMARY KEY, user_id uuid NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
  expires_at timestamptz NOT NULL, revoked_at timestamptz, created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX app_sessions_user ON app_sessions(user_id);
CREATE INDEX app_sessions_expiry ON app_sessions(expires_at);
CREATE TABLE user_consents (
  user_id uuid NOT NULL REFERENCES accounts(id) ON DELETE CASCADE, purpose text NOT NULL,
  version text NOT NULL, accepted_at timestamptz NOT NULL DEFAULT now(), revoked_at timestamptz,
  PRIMARY KEY(user_id,purpose,version)
);
