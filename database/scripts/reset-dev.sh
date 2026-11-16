#!/usr/bin/env bash
set -euo pipefail

DB_HOST="${DB_HOST:-localhost}"
DB_PORT="${DB_PORT:-5432}"
DB_NAME="${DB_NAME:-prowise}"
DB_USER="${DB_USER:-prowise}"
DB_PASSWORD="${DB_PASSWORD:-}"
ROOT_DIR="$(CDPATH= cd -- "$(dirname -- "$0")/../.." && pwd)"

export PGPASSWORD="$DB_PASSWORD"
dropdb --if-exists --host="$DB_HOST" --port="$DB_PORT" --username="$DB_USER" "$DB_NAME"
createdb --host="$DB_HOST" --port="$DB_PORT" --username="$DB_USER" "$DB_NAME"

for migration in "$ROOT_DIR"/database/migrations/*.sql; do
  psql --host="$DB_HOST" --port="$DB_PORT" --username="$DB_USER" \
    --dbname="$DB_NAME" --file="$migration"
done
