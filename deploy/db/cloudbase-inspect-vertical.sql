-- Read-only metadata inspection, displayed as two columns instead of one wide row.
-- Run this entire SELECT in the same CloudBase PostgreSQL SQL editor.
-- It does not read business rows/passwords or create/change database objects.
WITH inspection AS (
  SELECT
    current_setting('server_version') AS postgres_version,
    current_database() AS database_name,
    current_user AS inspected_as,
    current_setting('search_path') AS search_path,
    has_schema_privilege(current_user, 'public', 'CREATE') AS can_create_in_public,
    has_database_privilege(current_user, current_database(), 'CREATE') AS can_create_schema,
    (SELECT rolcreaterole FROM pg_roles WHERE rolname = current_user) AS can_create_roles,
    (SELECT rolsuper FROM pg_roles WHERE rolname = current_user) AS role_superuser,
    (SELECT rolbypassrls FROM pg_roles WHERE rolname = current_user) AS role_bypasses_rls,
    (SELECT pg_get_userbyid(nspowner) FROM pg_namespace WHERE nspname = 'public') AS public_schema_owner,
    (SELECT default_version FROM pg_available_extensions WHERE name = 'vector') AS vector_available_version,
    (SELECT extversion FROM pg_extension WHERE extname = 'vector') AS vector_installed_version,
    (SELECT n.nspname FROM pg_extension AS e
      JOIN pg_namespace AS n ON n.oid = e.extnamespace
      WHERE e.extname = 'vector') AS vector_schema,
    (SELECT count(*) FROM pg_class AS c
      JOIN pg_namespace AS n ON n.oid = c.relnamespace
      WHERE n.nspname = 'public' AND c.relkind IN ('r', 'p')) AS public_table_count,
    to_regclass('public.schema_migrations')::text AS migration_ledger,
    to_regclass('public.accounts')::text AS accounts_table,
    to_regclass('public.embedding_indexes')::text AS embedding_index_table,
    (SELECT coalesce(jsonb_agg(rolname ORDER BY rolname), '[]'::jsonb)
      FROM pg_roles WHERE rolname IN ('anon', 'authenticated', 'service_role')) AS platform_client_roles,
    (SELECT coalesce(jsonb_agg(jsonb_build_object(
        'schema', CASE WHEN a.defaclnamespace = 0 THEN '(all schemas)' ELSE n.nspname END,
        'object_type', a.defaclobjtype,
        'acl', a.defaclacl::text
      ) ORDER BY a.defaclnamespace, a.defaclobjtype), '[]'::jsonb)
      FROM pg_default_acl AS a
      LEFT JOIN pg_namespace AS n ON n.oid = a.defaclnamespace
      WHERE a.defaclrole = (SELECT oid FROM pg_roles WHERE rolname = current_user)
        AND (a.defaclnamespace = 0 OR n.nspname = 'public')) AS current_role_default_acl
)
SELECT fields.item, coalesce(fields.value, '(NULL)') AS value
FROM inspection
CROSS JOIN LATERAL jsonb_each_text(to_jsonb(inspection)) AS fields(item, value)
ORDER BY fields.item;
