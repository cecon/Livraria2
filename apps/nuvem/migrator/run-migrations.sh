#!/usr/bin/env bash
set -euo pipefail

PROJECT_REF="${SUPABASE_PROJECT_REF:-fiqzcnnibwzthhjatxvq}"
POOLER_HOST="${SUPABASE_POOLER_HOST:-aws-0-ca-central-1.pooler.supabase.com}"
POOLER_PORT="${SUPABASE_POOLER_PORT:-6543}"
BASELINE_UP_TO="${MIGRATION_BASELINE_UP_TO:-}"
SLEEP_SECONDS="${MIGRATOR_SLEEP_SECONDS:-31536000}"

if [[ -z "${SUPABASE_DB_PASSWORD:-}" ]]; then
  echo "SUPABASE_DB_PASSWORD is required" >&2
  exit 1
fi

export PGPASSWORD="${SUPABASE_DB_PASSWORD}"
PSQL=(
  psql
  -h "${POOLER_HOST}"
  -p "${POOLER_PORT}"
  -U "postgres.${PROJECT_REF}"
  -d postgres
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

version_le() {
  [[ "$(printf '%s\n%s\n' "$1" "$2" | sort -V | head -n 1)" == "$1" ]]
}

echo "Connecting to Supabase project ${PROJECT_REF}"
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
  local prefix="$2"
  local allow_baseline="$3"
  local filename version hash version_sql filename_sql hash_sql
  local current_row current baseline
  filename="$(basename "$file")"
  version="${prefix}${filename%.sql}"
  hash="$(sha256sum "$file" | awk '{print $1}')"
  version_sql="$(sql_escape "$version")"
  filename_sql="$(sql_escape "$filename")"
  hash_sql="$(sql_escape "$hash")"

  current_row="$(scalar_sql "select concat_ws('|', sha256, baseline::text)
    from public.livraria_schema_migrations
    where version='${version_sql}';")"

  if [[ -n "$current_row" ]]; then
    current="${current_row%%|*}"
    baseline="${current_row##*|}"
    if [[ "$current" != "$hash" ]]; then
      if [[ "$baseline" == "true" ]]; then
        echo "Skipping ${filename}; already recorded as production baseline"
        return
      fi
      echo "Hash mismatch for ${filename}; refusing to continue" >&2
      exit 1
    fi
    echo "Skipping ${filename}; already recorded"
    return
  fi

  if [[ "$allow_baseline" == "true" && -n "$BASELINE_UP_TO" ]] && version_le "$version" "$BASELINE_UP_TO"; then
    echo "Recording baseline ${filename}"
    run_sql "insert into public.livraria_schema_migrations (version, filename, sha256, baseline)
             values ('${version_sql}', '${filename_sql}', '${hash_sql}', true);"
    return
  fi

  echo "Applying ${filename}"
  "${PSQL[@]}" -f "$file" >/dev/null
  run_sql "insert into public.livraria_schema_migrations (version, filename, sha256, baseline)
           values ('${version_sql}', '${filename_sql}', '${hash_sql}', false);"
}

for file in migrations/*.sql; do
  apply_migration "$file" "" "true"
done

if [[ "${APPLY_API_MIGRATIONS:-false}" == "true" ]]; then
  for file in api-migrations/*.sql; do
    apply_migration "$file" "api_" "false"
  done
else
  echo "API migrations disabled; set APPLY_API_MIGRATIONS=true after validation"
fi

echo "Migrations are up to date. Sleeping for watchtower monitoring."
sleep "${SLEEP_SECONDS}"
