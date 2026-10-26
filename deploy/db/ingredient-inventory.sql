-- Public source facts and separately named candidate interpretations. No eligibility grants.
CREATE TABLE public.shiwei_source_recipe_records (
  release_id text NOT NULL REFERENCES public.shiwei_gallery_releases(release_id),
  source_number integer NOT NULL, dish_name text NOT NULL,flavor text NOT NULL,source_uri text NOT NULL,raw_record jsonb NOT NULL,
  PRIMARY KEY(release_id,source_number)
);
CREATE TABLE public.shiwei_source_ingredient_entries (
  release_id text NOT NULL,source_number integer NOT NULL,entry_number integer NOT NULL,
  source_section text NOT NULL,source_text text NOT NULL,recognized_names jsonb NOT NULL,
  parse_state text NOT NULL CHECK(parse_state IN ('parsed-candidate','needs-review')),
  PRIMARY KEY(release_id,source_number,entry_number),
  FOREIGN KEY(release_id,source_number) REFERENCES public.shiwei_source_recipe_records(release_id,source_number)
);
CREATE TABLE public.shiwei_ingredient_inventory (
  release_id text NOT NULL REFERENCES public.shiwei_gallery_releases(release_id),
  food_id text NOT NULL, name text NOT NULL, facts jsonb NOT NULL,
  PRIMARY KEY(release_id,food_id)
);
CREATE TABLE public.shiwei_recipe_inventory (
  release_id text NOT NULL REFERENCES public.shiwei_gallery_releases(release_id),
  recipe_id text NOT NULL,variant_id text NOT NULL,name text NOT NULL,flavor text NOT NULL,
  source_uri text NOT NULL,source_record_id text,ingredients_original jsonb NOT NULL,steps jsonb NOT NULL,
  review_state text NOT NULL CHECK(review_state IN ('source-checked-existing','candidate')),
  PRIMARY KEY(release_id,variant_id)
);
CREATE TABLE public.shiwei_recipe_ingredient_lines (
  release_id text NOT NULL,variant_id text NOT NULL,line_number integer NOT NULL,
  food_id text NOT NULL,role text NOT NULL CHECK(role IN ('main','auxiliary','seasoning')),
  optional boolean NOT NULL,amount numeric,unit text NOT NULL,basis text NOT NULL,form text NOT NULL,
  source_text text,
  PRIMARY KEY(release_id,variant_id,line_number),
  FOREIGN KEY(release_id,variant_id) REFERENCES public.shiwei_recipe_inventory(release_id,variant_id),
  FOREIGN KEY(release_id,food_id) REFERENCES public.shiwei_ingredient_inventory(release_id,food_id)
);
CREATE TABLE public.shiwei_ingredient_proposals (
  release_id text NOT NULL,food_id text NOT NULL,knowledge_version text NOT NULL,
  candidate jsonb NOT NULL,
  review_state text NOT NULL CHECK(review_state IN ('pending-source-review','requires-product-label')),
  PRIMARY KEY(release_id,food_id,knowledge_version),
  FOREIGN KEY(release_id,food_id) REFERENCES public.shiwei_ingredient_inventory(release_id,food_id)
);
DO $$ DECLARE t text; BEGIN
  FOREACH t IN ARRAY ARRAY['shiwei_source_recipe_records','shiwei_source_ingredient_entries','shiwei_ingredient_inventory','shiwei_recipe_inventory','shiwei_recipe_ingredient_lines','shiwei_ingredient_proposals'] LOOP
    EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY',t);
    EXECUTE format('ALTER TABLE public.%I FORCE ROW LEVEL SECURITY',t);
    EXECUTE format('REVOKE ALL ON public.%I FROM PUBLIC,anon,authenticated,service_role',t);
    EXECUTE format('GRANT SELECT ON public.%I TO anon',t);
    EXECUTE format('CREATE POLICY inventory_published ON public.%I FOR SELECT TO anon USING (EXISTS(SELECT 1 FROM public.shiwei_gallery_releases r WHERE r.release_id=%I.release_id AND r.published))',t,t);
  END LOOP;
END $$;
NOTIFY pgrst, 'reload schema';
