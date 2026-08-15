#!/bin/sh
set -eu

SCRIPT_DIR=$(CDPATH= cd "$(dirname "$0")" && pwd)
# shellcheck source=common.sh
. "$SCRIPT_DIR/common.sh"

require_command docker
docker compose version >/dev/null 2>&1 || fail 'Docker Compose v2 is required'
docker info >/dev/null 2>&1 || fail 'Docker Desktop is not running. Start it and retry.'
validate_compose_project_ownership

compose down --remove-orphans

remaining=$(docker ps -a \
	--filter "label=com.docker.compose.project=$COMPOSE_PROJECT_NAME" \
	--format '{{.ID}}' | awk 'NF { count += 1 } END { print count + 0 }')
[ "$remaining" -eq 0 ] || fail "$remaining containers remain in Compose project $COMPOSE_PROJECT_NAME"

printf '%s\n' 'MODULE 1 STACK REMOVED'
