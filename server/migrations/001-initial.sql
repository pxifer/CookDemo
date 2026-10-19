BEGIN;
CREATE TABLE IF NOT EXISTS schema_migrations (version integer PRIMARY KEY, installed_at timestamptz NOT NULL DEFAULT now());
CREATE TABLE IF NOT EXISTS accounts (
  id uuid PRIMARY KEY, issuer text NOT NULL, external_subject text NOT NULL,
  disabled boolean NOT NULL DEFAULT false, version integer NOT NULL DEFAULT 1,
  UNIQUE (issuer, external_subject)
);
CREATE TABLE IF NOT EXISTS profiles (
  user_id uuid PRIMARY KEY REFERENCES accounts(id) ON DELETE CASCADE,
  version integer NOT NULL CHECK (version > 0), envelope jsonb NOT NULL
);
CREATE TABLE IF NOT EXISTS favorites (
  user_id uuid NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
  recipe_id text NOT NULL, variant_id text NOT NULL, version integer NOT NULL,
  PRIMARY KEY (user_id, recipe_id, variant_id)
);
CREATE TABLE IF NOT EXISTS credentials (
  id uuid PRIMARY KEY, user_id uuid NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
  provider text NOT NULL, version integer NOT NULL, envelope jsonb NOT NULL,
  revoked boolean NOT NULL DEFAULT false
);
CREATE TABLE IF NOT EXISTS operations (
  subject text NOT NULL, operation_id text NOT NULL, fingerprint text NOT NULL,
  fee_mode text NOT NULL CHECK (fee_mode IN ('platform_free','byok')),
  state text NOT NULL CHECK (state IN ('admitted','attempting','completed','failed','unknown','cancelled')),
  attempts integer NOT NULL DEFAULT 0 CHECK (attempts BETWEEN 0 AND 2),
  credential_version text, provider_model text NOT NULL, max_attempts integer NOT NULL CHECK(max_attempts BETWEEN 1 AND 2),
  created_at timestamptz NOT NULL DEFAULT now(), expires_at timestamptz NOT NULL,
  PRIMARY KEY (subject, operation_id)
);
CREATE TABLE IF NOT EXISTS quota (
  bucket text PRIMARY KEY, used integer NOT NULL DEFAULT 0 CHECK (used >= 0), maximum integer NOT NULL CHECK (maximum >= 0)
);
CREATE TABLE IF NOT EXISTS erasures (
  id uuid PRIMARY KEY, user_id uuid NOT NULL, scope text NOT NULL CHECK (scope IN ('profile','credentials','favorites','account')),
  state text NOT NULL CHECK (state IN ('pending','processing','completed')),
  auth_deleted boolean NOT NULL DEFAULT false, data_deleted boolean NOT NULL DEFAULT false,
  journal_confirmed boolean NOT NULL DEFAULT false, attempts integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE IF NOT EXISTS public_releases (
  id text PRIMARY KEY, content_hash text NOT NULL, manifest jsonb NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE IF NOT EXISTS revocations (
  sequence bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY, object_id text UNIQUE NOT NULL,
  revoked_at timestamptz NOT NULL DEFAULT now()
);
INSERT INTO schema_migrations(version) VALUES (1) ON CONFLICT DO NOTHING;
COMMIT;
