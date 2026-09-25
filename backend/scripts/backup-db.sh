#!/usr/bin/env bash
set -euo pipefail
umask 077
BACKUP_DIR="${BACKUP_DIR:-./backups}"
ENV_FILE="${ENV_FILE:-.env.production}"
COMPOSE_FILE="${COMPOSE_FILE:-docker-compose.prod.yml}"
PROJECT_NAME="${PROJECT_NAME:-mandemarket-prod}"
DB_SERVICE="${DB_SERVICE:-mandemarket-db}"
mkdir -p "$BACKUP_DIR"
backup="$BACKUP_DIR/mandemarket_$(date -u +%Y%m%dT%H%M%SZ).dump"
tmp="$backup.partial"
trap 'rm -f "$tmp"' EXIT
compose=(docker compose --env-file "$ENV_FILE" -p "$PROJECT_NAME" -f "$COMPOSE_FILE")
"${compose[@]}" exec -T "$DB_SERVICE" sh -c 'exec pg_dump --format=custom --no-owner --no-acl --username="$POSTGRES_USER" --dbname="$POSTGRES_DB"' > "$tmp"
"${compose[@]}" exec -T "$DB_SERVICE" pg_restore --list < "$tmp" > /dev/null
mv "$tmp" "$backup"
(cd "$BACKUP_DIR" && sha256sum "$(basename "$backup")" > "$(basename "$backup").sha256")
echo "Backup verified: $backup (off-host replication must be configured separately)"
