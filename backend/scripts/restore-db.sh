#!/usr/bin/env bash
set -euo pipefail
umask 077
: "${RESTORE_DATABASE:?Set an explicit target database, preferably an isolated restore-test database}"
: "${RESTORE_CONFIRM:?Set RESTORE_CONFIRM=I_UNDERSTAND_DATA_LOSS after putting the target in maintenance}"
[ "$RESTORE_CONFIRM" = I_UNDERSTAND_DATA_LOSS ] || exit 2
backup="${1:?Usage: restore-db.sh backup.dump}"
[ -f "$backup" ] && [ -f "$backup.sha256" ]
(cd "$(dirname "$backup")" && sha256sum -c "$(basename "$backup").sha256")
compose=(docker compose --env-file "${ENV_FILE:-.env.production}" -p "${PROJECT_NAME:-mandemarket-prod}" -f "${COMPOSE_FILE:-docker-compose.prod.yml}")
"${compose[@]}" exec -T -e RESTORE_DATABASE="$RESTORE_DATABASE" "${DB_SERVICE:-mandemarket-db}" sh -c 'exec pg_restore --exit-on-error --single-transaction --clean --if-exists --no-owner --no-acl --username="$POSTGRES_USER" --dbname="$RESTORE_DATABASE"' < "$backup"
echo "Restore completed without SQL errors. Run reconciliation and smoke tests before reopening."
