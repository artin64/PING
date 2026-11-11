#!/bin/sh
set -eu

: "${PINGO_API_PASSWORD:=pingo-api-local-only}"
: "${PINGO_WORKER_PASSWORD:=pingo-worker-local-only}"

psql --username "$POSTGRES_USER" --dbname "$POSTGRES_DB" \
  --set=admin_role="$POSTGRES_USER" \
  --set=database_name="$POSTGRES_DB" \
  --set=api_password="$PINGO_API_PASSWORD" \
  --set=worker_password="$PINGO_WORKER_PASSWORD" <<'SQL'
SELECT format(
  'CREATE ROLE pingo_api LOGIN PASSWORD %L NOSUPERUSER NOCREATEDB NOCREATEROLE NOINHERIT NOBYPASSRLS',
  :'api_password'
)
WHERE NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'pingo_api')
\gexec

SELECT format(
  'CREATE ROLE pingo_worker LOGIN PASSWORD %L NOSUPERUSER NOCREATEDB NOCREATEROLE NOINHERIT NOBYPASSRLS',
  :'worker_password'
)
WHERE NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'pingo_worker')
\gexec

SELECT format('ALTER ROLE pingo_api WITH LOGIN PASSWORD %L NOSUPERUSER NOCREATEDB NOCREATEROLE NOINHERIT NOBYPASSRLS', :'api_password')
\gexec
SELECT format('ALTER ROLE pingo_worker WITH LOGIN PASSWORD %L NOSUPERUSER NOCREATEDB NOCREATEROLE NOINHERIT NOBYPASSRLS', :'worker_password')
\gexec

GRANT CONNECT ON DATABASE :"database_name" TO pingo_api, pingo_worker;
GRANT USAGE ON SCHEMA public TO pingo_api, pingo_worker;
GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public TO pingo_api;
GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA public TO pingo_api;
ALTER DEFAULT PRIVILEGES FOR ROLE :"admin_role" IN SCHEMA public
  GRANT SELECT, INSERT, UPDATE, DELETE ON TABLES TO pingo_api;
ALTER DEFAULT PRIVILEGES FOR ROLE :"admin_role" IN SCHEMA public
  GRANT USAGE, SELECT ON SEQUENCES TO pingo_api;
SQL
