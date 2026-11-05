-- Constructed constraint probe only. Every inserted fixture is rolled back by
-- the inner exception block, including on unexpected errors. No real data/model.
-- Run only after the vector migration, using the controlled migration role.
DO $shiwei_vector_probe$
DECLARE fixture text := '_shiwei_structure_probe_20261021';
BEGIN
  BEGIN
    INSERT INTO public.content_sources(id,version,kind,title) VALUES(fixture,'fixture','recipe','STRUCTURE_CHECK_ONLY');
    INSERT INTO public.public_releases(id,content_hash,manifest) VALUES(fixture,'constructed','{}');
    INSERT INTO public.catalog_releases(id) VALUES(fixture);
    INSERT INTO public.catalog_release_sources(release_id,source_id,source_version) VALUES(fixture,fixture,'fixture');
    INSERT INTO public.catalog_recipes(release_id,id,name,category,home_style,minutes,source_id,source_version)
      VALUES(fixture,'recipe','STRUCTURE_CHECK_ONLY','veg',true,1,fixture,'fixture');
    INSERT INTO public.catalog_variants(release_id,id,recipe_id,flavor) VALUES(fixture,'variant','recipe','fixture');
    INSERT INTO public.embedding_indexes(id,release_id,model_id,model_revision,dimensions,distance_metric,representation_version,normalization)
      VALUES(fixture,fixture,'constructed','fixture',3,'cosine','fixture','none');
    BEGIN
      INSERT INTO public.recipe_variant_embeddings(index_id,release_id,variant_id,dimensions,text_hash,embedding)
        VALUES(fixture,fixture,'variant',3,'fixture','[1,2]'::extensions.vector);
      RAISE EXCEPTION 'WRONG_VECTOR_DIMENSIONS_ACCEPTED';
    EXCEPTION WHEN check_violation THEN
      NULL;
    END;
    INSERT INTO public.recipe_variant_embeddings(index_id,release_id,variant_id,dimensions,text_hash,embedding)
      VALUES(fixture,fixture,'variant',3,'fixture','[1,2,3]'::extensions.vector);
    IF NOT EXISTS (SELECT 1 FROM public.recipe_variant_embeddings
      WHERE index_id=fixture AND extensions.vector_dims(embedding)=3) THEN
      RAISE EXCEPTION 'VALID_VECTOR_DIMENSIONS_REJECTED';
    END IF;
    RAISE EXCEPTION USING ERRCODE='ZSW01', MESSAGE='SHIWEI_CONSTRUCTED_PROBE_ROLLBACK';
  EXCEPTION WHEN SQLSTATE 'ZSW01' THEN
    IF SQLERRM <> 'SHIWEI_CONSTRUCTED_PROBE_ROLLBACK' THEN RAISE; END IF;
  END;
  IF EXISTS (SELECT 1 FROM public.public_releases WHERE id=fixture)
    OR EXISTS (SELECT 1 FROM public.content_sources WHERE id=fixture)
    OR EXISTS (SELECT 1 FROM public.embedding_indexes WHERE id=fixture) THEN
    RAISE EXCEPTION 'CONSTRUCTED_PROBE_NOT_ROLLED_BACK';
  END IF;
END
$shiwei_vector_probe$;
