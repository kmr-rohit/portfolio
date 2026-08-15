#!/bin/sh
set -eu

SCRIPT_DIR=$(CDPATH= cd "$(dirname "$0")" && pwd)
# shellcheck source=common.sh
. "$SCRIPT_DIR/common.sh"

require_runtime
mkdir -p "$MODULE_EVIDENCE_DIR"

api_id=$(api_container_id)
redis_id=$(redis_container_id)
[ -n "$api_id" ] || fail "API container is not running; run 'make module-01-up'"
[ -n "$redis_id" ] || fail "Redis container is not running; run 'make module-01-up'"

api_health=$(docker inspect --format '{{.State.Health.Status}}' "$api_id")
redis_health=$(docker inspect --format '{{.State.Health.Status}}' "$redis_id")
assert_equal 'API container healthcheck is green' healthy "$api_health"
assert_equal 'Redis container healthcheck is green' healthy "$redis_health"

health_url=$(api_url)/healthz
health_json=$(curl --silent --show-error --fail "$health_url")
printf '%s\n' "$health_json" | jq -e \
	'.status == "ok" and .redis == "ok" and .bind_host == "0.0.0.0"' >/dev/null || \
	fail 'published health endpoint did not report API, Redis, and all-interface bind as healthy'
pass "published health endpoint is reachable at $health_url"

first_response=$(curl --silent --show-error --fail \
	--header 'Content-Type: application/json' \
	--data '{"text":"module one proves the Redis boundary"}' \
	"$(api_url)/documents")
second_response=$(curl --silent --show-error --fail \
	--header 'Content-Type: application/json' \
	--data '{"text":"module one proves state crosses requests"}' \
	"$(api_url)/documents")
first_count=$(printf '%s' "$first_response" | jq -r '.redis_request_count')
second_count=$(printf '%s' "$second_response" | jq -r '.redis_request_count')
case $first_count:$second_count in
	*[!0-9:]*|:*) fail 'API did not return numeric Redis request counters' ;;
esac
[ "$second_count" -eq $((first_count + 1)) ] || \
	fail "Redis request counter was not monotonic ($first_count then $second_count)"
pass "Redis-backed request counter advanced from $first_count to $second_count"
printf '%s\n' "$second_response" >"$MODULE_EVIDENCE_DIR/redis-response.json"

api_user=$(docker inspect --format '{{.Config.User}}' "$api_id")
assert_equal 'API container config uses uid/gid 10001' '10001:10001' "$api_user"
runtime_identity=$(compose exec -T api sh -c 'printf "%s:%s" "$(id -u)" "$(id -g)"')
assert_equal 'API process runs as uid/gid 10001' '10001:10001' "$runtime_identity"

redis_identity=$(compose exec -T redis sh -c 'printf "%s:%s" "$(id -u)" "$(id -g)"')
assert_equal 'Redis process runs without root' '999:1000' "$redis_identity"

api_read_only=$(docker inspect --format '{{.HostConfig.ReadonlyRootfs}}' "$api_id")
redis_read_only=$(docker inspect --format '{{.HostConfig.ReadonlyRootfs}}' "$redis_id")
assert_equal 'API root filesystem is read-only' true "$api_read_only"
assert_equal 'Redis root filesystem is read-only' true "$redis_read_only"

for service_id in "$api_id" "$redis_id"; do
	docker inspect "$service_id" | jq -e \
		'.[0].HostConfig.CapDrop | any(. == "ALL")' >/dev/null || \
		fail "$service_id does not drop all Linux capabilities"
	docker inspect "$service_id" | jq -e \
		'.[0].HostConfig.SecurityOpt | any(startswith("no-new-privileges"))' >/dev/null || \
		fail "$service_id does not set no-new-privileges"
	memory=$(docker inspect --format '{{.HostConfig.Memory}}' "$service_id")
	nano_cpus=$(docker inspect --format '{{.HostConfig.NanoCpus}}' "$service_id")
	pids=$(docker inspect --format '{{.HostConfig.PidsLimit}}' "$service_id")
	[ "$memory" -eq 134217728 ] || fail "$service_id memory limit is $memory, expected 134217728"
	[ "$nano_cpus" -eq 500000000 ] || fail "$service_id CPU limit is $nano_cpus NanoCPUs, expected 500000000"
	[ "$pids" -eq 100 ] || fail "$service_id PID limit is $pids, expected 100"
done
pass 'both services drop capabilities, forbid privilege gain, and enforce CPU/memory/PID limits'

compose exec -T api python -c \
	'import socket; addresses=socket.getaddrinfo("redis", 6379); assert addresses' >/dev/null
pass 'Compose DNS resolves the redis service name inside the API container'

compose exec -T api python -c \
	'import pathlib; command=pathlib.Path("/proc/1/cmdline").read_bytes(); assert b"python" in command and b"server.py" in command' >/dev/null
pass 'the Python server owns PID 1 in the API container'

LOG_FILE=$(mktemp "${TMPDIR:-/tmp}/workbench-api-logs.XXXXXX")
trap 'rm -f "$LOG_FILE"' EXIT HUP INT TERM
docker logs "$api_id" >"$LOG_FILE" 2>&1
jq -e -s \
	'length > 0 and all(.[]; type == "object" and has("timestamp") and has("level") and has("event") and .service == "workbench-api")' \
	"$LOG_FILE" >/dev/null || fail 'API logs are not exclusively structured JSON objects'
jq -e -s 'any(.[]; .event == "request_completed")' "$LOG_FILE" >/dev/null || \
	fail 'structured logs do not contain request_completed'
pass 'API stdout contains structured JSON lifecycle and request logs'
cp "$LOG_FILE" "$MODULE_EVIDENCE_DIR/api-structured.log"

docker inspect "$api_id" "$redis_id" >"$MODULE_EVIDENCE_DIR/runtime-inspect.json"
compose ps --format json | jq -s \
	'if length == 1 and (.[0] | type) == "array" then .[0] else . end' \
	>"$MODULE_EVIDENCE_DIR/compose-ps.json"

printf '%s\n' 'MODULE 1 RUNTIME VERIFIED'
