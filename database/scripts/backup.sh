#!/usr/bin/env bash
set -euo pipefail

DB_HOST="${DB_HOST:-localhost}"
DB_PORT="${DB_PORT:-5432}"
DB_NAME="${DB_NAME:-prowise}"
DB_USER="${DB_USER:-prowise}"
DB_PASSWORD="${DB_PASSWORD:-}"
BACKUP_DIR="${BACKUP_DIR:-database/backups}"

export PGPASSWORD="$DB_PASSWORD"
mkdir -p "$BACKUP_DIR"
pg_dump --format=custom --file="$BACKUP_DIR/${DB_NAME}-$(date +%Y%m%d%H%M%S).dump" \
  --host="$DB_HOST" --port="$DB_PORT" --username="$DB_USER" "$DB_NAME"
