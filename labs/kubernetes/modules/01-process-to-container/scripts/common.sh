#!/bin/sh

# Shared POSIX-shell helpers. This file is sourced by the Module 1 scripts.
MODULE_SCRIPT_DIR=$(CDPATH= cd "$(dirname "$0")" && pwd)
MODULE_DIR=$(CDPATH= cd "$MODULE_SCRIPT_DIR/.." && pwd)
LAB_ROOT=$(CDPATH= cd "$MODULE_DIR/../.." && pwd)
# shellcheck source=../../../versions.env
. "$LAB_ROOT/versions.env"

COMPOSE_FILE=$MODULE_DIR/compose.yaml
FAULT_FILE=$MODULE_DIR/compose.loopback.yaml
MODULE_EVIDENCE_DIR=$LAB_ROOT/evidence/module-01

fail() {
	printf 'ERROR: %s\n' "$*" >&2
	exit 1
}

pass() {
	printf 'PASS: %s\n' "$*"
}

require_command() {
	command -v "$1" >/dev/null 2>&1 || fail "required command not found: $1"
}

validate_compose_project_ownership() {
	project_ids=$(docker ps -a \
		--filter "label=com.docker.compose.project=$COMPOSE_PROJECT_NAME" \
		--format '{{.ID}}')
	[ -n "$project_ids" ] || return 0

	for project_id in $project_ids; do
		project_working_dir=$(docker inspect --format \
			'{{ index .Config.Labels "com.docker.compose.project.working_dir" }}' "$project_id")
		[ "$project_working_dir" = "$MODULE_DIR" ] || \
			fail "refusing to change Compose project '$COMPOSE_PROJECT_NAME': container $project_id belongs to '$project_working_dir'"
	done
}

require_runtime() {
	require_command docker
	require_command curl
	require_command jq
	docker compose version >/dev/null 2>&1 || fail 'Docker Compose v2 is required'
	docker info >/dev/null 2>&1 || fail 'Docker Desktop is not running. Start it and retry.'
	validate_compose_project_ownership
}

compose() {
	docker compose \
		--project-name "$COMPOSE_PROJECT_NAME" \
		--file "$COMPOSE_FILE" "$@"
}

compose_fault() {
	docker compose \
		--project-name "$COMPOSE_PROJECT_NAME" \
		--file "$COMPOSE_FILE" \
		--file "$FAULT_FILE" "$@"
}

api_url() {
	printf 'http://%s:%s' "$WORKBENCH_HOST" "$WORKBENCH_HOST_PORT"
}

wait_for_http() {
	wait_url=$1
	wait_attempts=${2:-60}
	wait_count=0
	while [ "$wait_count" -lt "$wait_attempts" ]; do
		if curl --silent --show-error --fail --max-time 2 "$wait_url" >/dev/null 2>&1; then
			return 0
		fi
		wait_count=$((wait_count + 1))
		sleep 1
	done
	return 1
}

api_container_id() {
	compose ps --quiet api
}

redis_container_id() {
	compose ps --quiet redis
}

assert_equal() {
	assert_description=$1
	assert_expected=$2
	assert_actual=$3
	if [ "$assert_actual" != "$assert_expected" ]; then
		fail "$assert_description: expected '$assert_expected', found '$assert_actual'"
	fi
	pass "$assert_description"
}
