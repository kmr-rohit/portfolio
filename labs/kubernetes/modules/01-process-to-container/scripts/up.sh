#!/bin/sh
set -eu

SCRIPT_DIR=$(CDPATH= cd "$(dirname "$0")" && pwd)
# shellcheck source=common.sh
. "$SCRIPT_DIR/common.sh"

build_only=false
case ${1:-} in
	'') ;;
	--build-only) build_only=true ;;
	*) printf 'usage: %s [--build-only]\n' "$0" >&2; exit 2 ;;
esac

require_runtime
compose config --quiet

printf 'Building %s from the pinned Python base image.\n' "$WORKBENCH_IMAGE"
compose build api

image_user=$(docker image inspect --format '{{.Config.User}}' "$WORKBENCH_IMAGE")
assert_equal 'built image declares uid/gid 10001' '10001:10001' "$image_user"

if [ "$build_only" = true ]; then
	printf '%s\n' 'MODULE 1 IMAGE BUILT'
	exit 0
fi

compose up --detach --wait --wait-timeout 120

health_url=$(api_url)/healthz
wait_for_http "$health_url" 60 || fail "API did not become reachable at $health_url"
bind_host=$(curl --silent --show-error --fail "$health_url" | jq -r '.bind_host')
assert_equal 'API listens on every container interface' '0.0.0.0' "$bind_host"

printf 'MODULE 1 READY: %s\n' "$(api_url)"
