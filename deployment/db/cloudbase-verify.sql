-- Read-only verification after both CloudBase migrations have actually completed.
WITH project_tables AS (
  SELECT c.oid,c.relname,c.relrowsecurity,c.relowner
  FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace
  WHERE n.nspname='public' AND c.relkind IN ('r','p') AND c.relname IN (
    'schema_migrations','accounts','profiles','favorites','credentials','operations','quota','erasures',
    'public_releases','revocations','content_sources','catalog_releases','catalog_release_sources',
    'catalog_foods','catalog_food_aliases','catalog_food_relations','catalog_nutrition',
    'catalog_recipes','catalog_variants','catalog_variant_lines','catalog_variant_steps',
    'catalog_search_documents','app_sessions','user_consents','embedding_indexes','recipe_variant_embeddings'
  )
), client_roles AS (
  SELECT oid,rolname FROM pg_roles WHERE rolname IN ('anon','authenticated','service_role')
), project_sequences AS (
  SELECT DISTINCT s.oid,s.relname FROM pg_class s JOIN pg_depend d
    ON d.objid=s.oid AND d.classid='pg_class'::regclass AND d.refclassid='pg_class'::regclass AND d.deptype IN ('a','i')
  JOIN project_tables t ON t.oid=d.refobjid WHERE s.relkind='S'
)
SELECT jsonb_build_object(
  'database',current_database(),
  'migration_role',current_user,
  'migrations',(SELECT jsonb_agg(jsonb_build_object('version',version,'filename',filename,'checksum',checksum) ORDER BY version) FROM public.schema_migrations),
  'project_table_count',(SELECT count(*) FROM project_tables),
  'tables_without_rls',(SELECT count(*) FROM project_tables WHERE NOT relrowsecurity),
  'client_table_access',(SELECT coalesce(jsonb_agg(jsonb_build_object('role',r.rolname,'table',t.relname)), '[]'::jsonb)
    FROM client_roles r CROSS JOIN project_tables t
    WHERE has_table_privilege(r.oid,t.oid,'SELECT,INSERT,UPDATE,DELETE,TRUNCATE,REFERENCES,TRIGGER,MAINTAIN')
      OR has_any_column_privilege(r.oid,t.oid,'SELECT,INSERT,UPDATE,REFERENCES')),
  'client_sequence_access',(SELECT coalesce(jsonb_agg(jsonb_build_object('role',r.rolname,'sequence',s.relname)), '[]'::jsonb)
    FROM client_roles r CROSS JOIN project_sequences s WHERE has_sequence_privilege(r.oid,s.oid,'USAGE,SELECT,UPDATE')),
  'client_public_defaults',(SELECT coalesce(jsonb_agg(jsonb_build_object('role',coalesce(r.rolname,'PUBLIC'),'object_type',a.defaclobjtype,'privilege',p.privilege_type)), '[]'::jsonb)
    FROM pg_default_acl a CROSS JOIN LATERAL aclexplode(a.defaclacl) p LEFT JOIN pg_roles r ON r.oid=p.grantee
    WHERE a.defaclrole=(SELECT oid FROM pg_roles WHERE rolname=current_user)
      AND (a.defaclnamespace=0 OR a.defaclnamespace=(SELECT oid FROM pg_namespace WHERE nspname='public'))
      AND a.defaclobjtype IN ('r','S') AND (p.grantee=0 OR r.rolname IN ('anon','authenticated','service_role'))),
  'vector',(SELECT jsonb_build_object('version',e.extversion,'schema',n.nspname) FROM pg_extension e JOIN pg_namespace n ON n.oid=e.extnamespace WHERE e.extname='vector'),
  'account_count',(SELECT count(*) FROM public.accounts),
  'recipe_count',(SELECT count(*) FROM public.catalog_recipes),
  'embedding_count',(SELECT count(*) FROM public.recipe_variant_embeddings)
) AS result;
