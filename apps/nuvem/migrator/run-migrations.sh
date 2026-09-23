#!/usr/bin/env bash
set -euo pipefail

SLEEP_SECONDS="${MIGRATOR_SLEEP_SECONDS:-31536000}"

if [[ -z "${DATABASE_URL:-}" ]]; then
  echo "DATABASE_URL is required" >&2
  exit 1
fi

PSQL=(
  psql
  "${DATABASE_URL}"
  -v ON_ERROR_STOP=1
  -X
  -q
)

run_sql() {
  "${PSQL[@]}" -c "$1" >/dev/null
}

scalar_sql() {
  "${PSQL[@]}" -t -A -c "$1" | tr -d '\r' | head -n 1
}

sql_escape() {
  printf "%s" "$1" | sed "s/'/''/g"
}

run_sql "create schema if not exists extensions;"
run_sql "create extension if not exists pgcrypto with schema extensions;"
run_sql "alter extension pgcrypto set schema extensions;"
run_sql "create extension if not exists unaccent with schema extensions;"
run_sql "alter extension unaccent set schema extensions;"
run_sql "do \$\$ begin
  if not exists (select 1 from pg_roles where rolname='anon') then
    create role anon nologin;
  end if;
  if not exists (select 1 from pg_roles where rolname='authenticated') then
    create role authenticated nologin;
  end if;
  if not exists (select 1 from pg_roles where rolname='service_role') then
    create role service_role nologin bypassrls;
  end if;
end \$\$;"
run_sql "create table if not exists public.livraria_schema_migrations (
  version text primary key,
  filename text not null,
  sha256 text not null,
  applied_at timestamptz not null default now(),
  baseline boolean not null default false
);"

shopt -s nullglob
apply_migration() {
  local file="$1"
  local filename version hash version_sql filename_sql hash_sql
  local current_hash
  filename="$(basename "$file")"
  version="${filename%.sql}"
  hash="$(sha256sum "$file" | awk '{print $1}')"
  version_sql="$(sql_escape "$version")"
  filename_sql="$(sql_escape "$filename")"
  hash_sql="$(sql_escape "$hash")"

  current_hash="$(scalar_sql "select sha256 from public.livraria_schema_migrations where version='${version_sql}';")"

  if [[ -n "$current_hash" ]]; then
    if [[ "$current_hash" != "$hash" ]]; then
      echo "Hash mismatch for ${filename}; refusing to continue" >&2
      exit 1
    fi
    echo "Skipping ${filename}; already recorded"
    return
  fi

  echo "Applying ${filename}"
  "${PSQL[@]}" -f "$file" >/dev/null
  run_sql "insert into public.livraria_schema_migrations (version, filename, sha256, baseline)
           values ('${version_sql}', '${filename_sql}', '${hash_sql}', false);"
}

for file in migrations/*.sql; do
  apply_migration "$file"
done

echo "Migrations are up to date. Sleeping for watchtower monitoring."
sleep "${SLEEP_SECONDS}"
