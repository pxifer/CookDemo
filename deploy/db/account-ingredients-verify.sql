SELECT jsonb_build_object(
  'foods',(SELECT count(*) FROM public.shiwei_ingredient_inventory),
  'variants',(SELECT count(*) FROM public.shiwei_recipe_inventory),
  'ingredient_lines',(SELECT count(*) FROM public.shiwei_recipe_ingredient_lines),
  'source_records',(SELECT count(*) FROM public.shiwei_source_recipe_records),
  'source_entries',(SELECT count(*) FROM public.shiwei_source_ingredient_entries),
  'unmatched_source_entries',(SELECT count(*) FROM public.shiwei_source_ingredient_entries WHERE parse_state='needs-review'),
  'pending_proposals',(SELECT count(*) FROM public.shiwei_ingredient_proposals),
  'table_rls',(SELECT jsonb_agg(jsonb_build_object('name',relname,'rls',relrowsecurity,'force_rls',relforcerowsecurity)) FROM pg_class WHERE relnamespace='public'::regnamespace AND relname IN ('shiwei_account_state','shiwei_account_sessions','shiwei_source_recipe_records','shiwei_source_ingredient_entries','shiwei_ingredient_inventory','shiwei_recipe_inventory','shiwei_recipe_ingredient_lines','shiwei_ingredient_proposals')),
  'anon_private_access',(SELECT jsonb_agg(table_name||':'||privilege_type) FROM information_schema.role_table_grants WHERE grantee='anon' AND table_schema='public' AND table_name IN ('shiwei_account_state','shiwei_account_sessions')),
  'anon_inventory_writes',(SELECT jsonb_agg(table_name||':'||privilege_type) FROM information_schema.role_table_grants WHERE grantee='anon' AND table_schema='public' AND table_name LIKE 'shiwei_%' AND privilege_type<>'SELECT'),
  'account_plaintext_columns',(SELECT jsonb_agg(column_name) FROM information_schema.columns WHERE table_schema='public' AND table_name='shiwei_account_state' AND column_name IN ('password','favorites','defaults','restrictions')),
  'allergy_gate_changed',false,
  'nutrition_inferred',false
) AS verification;
