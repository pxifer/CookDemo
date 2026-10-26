#!/bin/bash
set -euo pipefail
# Only generated base64url credentials are accepted before using SQL literals.
owner_password="$(cat /run/secrets/db_owner_password)"
app_password="$(cat /run/secrets/db_app_password)"
[[ "$owner_password" =~ ^[A-Za-z0-9_-]{43}$ && "$app_password" =~ ^[A-Za-z0-9_-]{43}$ ]] || exit 1
psql -v ON_ERROR_STOP=1 --username "$POSTGRES_USER" --dbname "$POSTGRES_DB" <<EOSQL
CREATE ROLE shiwei_owner LOGIN NOSUPERUSER NOCREATEDB NOCREATEROLE PASSWORD '$owner_password';
CREATE ROLE shiwei_app LOGIN NOSUPERUSER NOCREATEDB NOCREATEROLE PASSWORD '$app_password';
ALTER DATABASE shiwei_dev OWNER TO shiwei_owner;
REVOKE CREATE ON SCHEMA public FROM PUBLIC;
GRANT USAGE,CREATE ON SCHEMA public TO shiwei_owner;
GRANT USAGE ON SCHEMA public TO shiwei_app;
CREATE EXTENSION IF NOT EXISTS vector;
ALTER DEFAULT PRIVILEGES FOR ROLE shiwei_owner IN SCHEMA public GRANT SELECT ON TABLES TO shiwei_app;
ALTER DEFAULT PRIVILEGES FOR ROLE shiwei_owner IN SCHEMA public GRANT USAGE,SELECT ON SEQUENCES TO shiwei_app;
CREATE DATABASE shiwei_test_structure OWNER shiwei_owner;
EOSQL
psql -v ON_ERROR_STOP=1 --username "$POSTGRES_USER" --dbname shiwei_test_structure <<EOSQL
REVOKE CREATE ON SCHEMA public FROM PUBLIC;
GRANT USAGE,CREATE ON SCHEMA public TO shiwei_owner;
CREATE EXTENSION IF NOT EXISTS vector;
EOSQL
unset owner_password app_password
