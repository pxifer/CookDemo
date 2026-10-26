-- Read-only public release metadata. No user IDs, profiles or credentials.
SELECT jsonb_build_object(
 'base_release', (SELECT jsonb_build_object('checksum',checksum,'published',published) FROM public.shiwei_gallery_releases WHERE release_id='gallery-preview-20261023'),
 'composition_release', (SELECT jsonb_build_object('id',release_id,'checksum',checksum,'published',published,
   'variant_records',jsonb_array_length(payload->'records'),
   'verified', (SELECT count(*) FROM jsonb_array_elements(payload->'records') r WHERE r->>'state'='verified-composition'),
   'pending', (SELECT count(*) FROM jsonb_array_elements(payload->'records') r WHERE r->>'state'='pending-source-review'))
   FROM public.shiwei_gallery_releases WHERE release_id='composition-review-20261024-v1'),
 'inventory',jsonb_build_object('foods',(SELECT count(*) FROM public.shiwei_ingredient_inventory),'variants',(SELECT count(*) FROM public.shiwei_recipe_inventory),'lines',(SELECT count(*) FROM public.shiwei_recipe_ingredient_lines),'source_records',(SELECT count(*) FROM public.shiwei_source_recipe_records),'source_entries',(SELECT count(*) FROM public.shiwei_source_ingredient_entries)),
 'release_table_rls',(SELECT relrowsecurity AND relforcerowsecurity FROM pg_class WHERE oid='public.shiwei_gallery_releases'::regclass),
 'anon_can_write',has_table_privilege('anon','public.shiwei_gallery_releases','INSERT,UPDATE,DELETE'),
 'anon_private_access',has_table_privilege('anon','public.shiwei_account_state','SELECT,INSERT,UPDATE,DELETE')
) AS evidence;
