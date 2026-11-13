-- Additive LOCAL research storage. Never a product/CloudBase migration.
CREATE TABLE IF NOT EXISTS health_kb.nutrition_releases (
  id text PRIMARY KEY,
  canonical_hash text NOT NULL CHECK(length(canonical_hash)=64),
  payload jsonb NOT NULL,
  imported_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE IF NOT EXISTS health_kb.nutrition_composition (
  bundle_id text NOT NULL REFERENCES health_kb.nutrition_releases(id),
  food_id text NOT NULL,
  nutrient_id text NOT NULL,
  value numeric NULL CHECK(value >= 0),
  unit text NOT NULL CHECK(unit IN ('KCAL','G','MG','UG')),
  status text NOT NULL CHECK(status IN ('source_reported','not_reported')),
  record jsonb NOT NULL,
  PRIMARY KEY(bundle_id,food_id,nutrient_id),
  CHECK((status='not_reported' AND value IS NULL) OR (status='source_reported' AND value IS NOT NULL))
);
CREATE INDEX IF NOT EXISTS nutrition_composition_nutrient_value
  ON health_kb.nutrition_composition(bundle_id,nutrient_id,value DESC) WHERE value IS NOT NULL;
DO $guard$
DECLARE tab text;
BEGIN
  FOREACH tab IN ARRAY ARRAY['nutrition_releases','nutrition_composition'] LOOP
    IF NOT EXISTS(SELECT 1 FROM pg_trigger WHERE tgname='immutable_'||tab
      AND tgrelid=('health_kb.'||tab)::regclass AND NOT tgisinternal) THEN
      EXECUTE format('CREATE TRIGGER %I BEFORE UPDATE OR DELETE ON health_kb.%I FOR EACH ROW EXECUTE FUNCTION health_kb.reject_research_mutation()', 'immutable_'||tab, tab);
    END IF;
  END LOOP;
END $guard$;
REVOKE ALL ON health_kb.nutrition_releases, health_kb.nutrition_composition FROM PUBLIC;
COMMENT ON TABLE health_kb.nutrition_releases IS 'Immutable public nutrition/food-guidance research snapshots; no clinical release, profile or query storage.';
