#!/bin/sh
set -eu

SCRIPT_DIR=$(CDPATH= cd "$(dirname "$0")" && pwd)
# shellcheck source=common.sh
. "$SCRIPT_DIR/common.sh"

mkdir -p "$MODULE_EVIDENCE_DIR"

run_step() {
	step_name=$1
	step_script=$2
	step_log=$MODULE_EVIDENCE_DIR/$step_name.txt
	step_tmp=$(mktemp "${TMPDIR:-/tmp}/workbench-$step_name.XXXXXX")
	if "$step_script" >"$step_tmp" 2>&1; then
		cp "$step_tmp" "$step_log"
		cat "$step_tmp"
		rm -f "$step_tmp"
	else
		step_status=$?
		cp "$step_tmp" "$step_log"
		cat "$step_tmp" >&2
		rm -f "$step_tmp"
		exit "$step_status"
	fi
}

run_step up "$SCRIPT_DIR/up.sh"
run_step runtime "$SCRIPT_DIR/verify-runtime.sh"
run_step architectures "$SCRIPT_DIR/inspect-indexes.sh"
run_step drain "$SCRIPT_DIR/verify-drain.sh"
run_step runtime-after-drain "$SCRIPT_DIR/verify-runtime.sh"

collected_at=$(date -u '+%Y-%m-%dT%H:%M:%SZ')
jq -n \
	--arg collected_at "$collected_at" \
	--arg project "$COMPOSE_PROJECT_NAME" \
	--arg endpoint "$(api_url)" \
	--arg api_image "$WORKBENCH_IMAGE" \
	--arg python_image "$PYTHON_IMAGE" \
	--arg redis_image "$REDIS_IMAGE" \
	'{
		schema_version:1,
		status:"pass",
		collected_at:$collected_at,
		project:$project,
		endpoint:$endpoint,
		images:{api:$api_image,python_base:$python_image,redis:$redis_image},
		proofs:["runtime","oci-indexes","sigterm-drain"]
	}' >"$MODULE_EVIDENCE_DIR/verification-summary.json"

printf 'Evidence: %s\n' "$MODULE_EVIDENCE_DIR"
printf '%s\n' 'MODULE 1 VERIFIED'
