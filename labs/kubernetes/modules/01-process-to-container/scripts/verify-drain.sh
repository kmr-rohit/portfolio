#!/bin/sh
set -eu

SCRIPT_DIR=$(CDPATH= cd "$(dirname "$0")" && pwd)
# shellcheck source=common.sh
. "$SCRIPT_DIR/common.sh"

require_runtime
mkdir -p "$MODULE_EVIDENCE_DIR"

api_id=$(api_container_id)
[ -n "$api_id" ] || fail "API container is not running; run 'make module-01-up'"

request_id=drain-proof-$$
response_file=$(mktemp "${TMPDIR:-/tmp}/workbench-drain-response.XXXXXX")
curl_error=$(mktemp "${TMPDIR:-/tmp}/workbench-drain-curl.XXXXXX")
slow_pid=
cleanup() {
	if [ -n "$slow_pid" ]; then
		kill "$slow_pid" >/dev/null 2>&1 || true
	fi
	rm -f "$response_file" "$curl_error"
}
trap cleanup EXIT HUP INT TERM

curl --silent --show-error --fail --max-time 12 \
	"$(api_url)/slow?seconds=3&request_id=$request_id" \
	>"$response_file" 2>"$curl_error" &
slow_pid=$!

observed=false
attempt=0
while [ "$attempt" -lt 20 ]; do
	if docker logs "$api_id" 2>&1 | grep -F "$request_id" >/dev/null 2>&1; then
		observed=true
		break
	fi
	attempt=$((attempt + 1))
	sleep 1
done
[ "$observed" = true ] || fail 'slow request did not enter the API before the drain deadline'
pass 'slow request is in flight before SIGTERM'

compose stop --timeout 12 api

if wait "$slow_pid"; then
	slow_pid=
else
	cat "$curl_error" >&2
	fail 'in-flight request disconnected during SIGTERM drain'
fi

jq -e --arg request_id "$request_id" \
	'.status == "completed" and .request_id == $request_id and .slept_seconds == 3' \
	"$response_file" >/dev/null || fail 'slow request response did not prove completion'
pass 'in-flight slow request completed while Compose delivered SIGTERM'

docker logs "$api_id" >"$MODULE_EVIDENCE_DIR/sigterm-drain.log" 2>&1
jq -e -s 'any(.[]; .event == "drain_started" and .signal == "SIGTERM")' \
	"$MODULE_EVIDENCE_DIR/sigterm-drain.log" >/dev/null || \
	fail 'structured logs do not contain drain_started for SIGTERM'
jq -e -s 'any(.[]; .event == "drain_complete" and .inflight == 0)' \
	"$MODULE_EVIDENCE_DIR/sigterm-drain.log" >/dev/null || \
	fail 'structured logs do not contain drain_complete at zero in-flight requests'
exit_code=$(docker inspect --format '{{.State.ExitCode}}' "$api_id")
assert_equal 'API exited cleanly after the drain' 0 "$exit_code"
cp "$response_file" "$MODULE_EVIDENCE_DIR/sigterm-response.json"

compose up --detach --wait --wait-timeout 120 api
wait_for_http "$(api_url)/healthz" 60 || fail 'API did not return after the drain proof'

printf '%s\n' 'SIGTERM DRAIN VERIFIED'
