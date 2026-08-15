#!/bin/sh
set -eu

SCRIPT_DIR=$(CDPATH= cd "$(dirname "$0")" && pwd)
# shellcheck source=common.sh
. "$SCRIPT_DIR/common.sh"

require_runtime
mkdir -p "$MODULE_EVIDENCE_DIR"
compose_fault config --quiet
compose_fault up --build --detach --wait --wait-timeout 120

internal_health=$(compose_fault exec -T api python -c \
	'import urllib.request; print(urllib.request.urlopen("http://127.0.0.1:8080/healthz", timeout=2).read().decode())')
printf '%s' "$internal_health" | jq -e \
	'.status == "ok" and .bind_host == "127.0.0.1"' >/dev/null || \
	fail 'fault overlay did not create an internally healthy loopback-only listener'
pass 'container-local healthcheck remains green on loopback'

if compose_fault exec -T api python -c '
import socket
import urllib.request
address = socket.gethostbyname(socket.gethostname())
urllib.request.urlopen(f"http://{address}:8080/healthz", timeout=2).read()
' >/dev/null 2>&1; then
	fail 'API unexpectedly accepted traffic on its container bridge address'
fi
pass 'container bridge address cannot reach the loopback-only listener'

if curl --silent --show-error --fail --max-time 3 "$(api_url)/healthz" >/dev/null 2>&1; then
	fail 'published host port unexpectedly reached the loopback-only listener'
fi
pass "published host port $(api_url) cannot reach the loopback-only listener"

api_id=$(compose_fault ps --quiet api)
docker inspect "$api_id" >"$MODULE_EVIDENCE_DIR/loopback-fault-inspect.json"
docker logs "$api_id" >"$MODULE_EVIDENCE_DIR/loopback-fault.log" 2>&1
printf '%s\n' "$internal_health" >"$MODULE_EVIDENCE_DIR/loopback-internal-health.json"

printf '%s\n' 'LOOPBACK FAULT REPRODUCED'
