#!/bin/sh
set -eu

SCRIPT_DIR=$(CDPATH= cd "$(dirname "$0")" && pwd)
# shellcheck source=common.sh
. "$SCRIPT_DIR/common.sh"

require_runtime
api_id=$(api_container_id)
redis_id=$(redis_container_id)
[ -n "$api_id" ] && [ -n "$redis_id" ] || fail "stack is not running; run 'make module-01-up'"

compose ps
printf '\nAPI process and interfaces\n'
compose exec -T api python -c '
import os
import pathlib
import socket
print(f"pid={os.getpid()} uid={os.getuid()} gid={os.getgid()}")
print("pid1=" + pathlib.Path("/proc/1/cmdline").read_bytes().replace(b"\0", b" ").decode())
print("hostname=" + socket.gethostname())
print("addresses=" + ",".join(sorted({item[4][0] for item in socket.getaddrinfo(socket.gethostname(), 8080)})))
print("redis=" + socket.gethostbyname("redis"))
'
printf '\nRuntime restrictions\n'
docker inspect --format \
	'{{.Name}} user={{.Config.User}} readonly={{.HostConfig.ReadonlyRootfs}} memory={{.HostConfig.Memory}} nanocpus={{.HostConfig.NanoCpus}} pids={{.HostConfig.PidsLimit}}' \
	"$api_id" "$redis_id"
printf '\nMounts\n'
docker inspect "$api_id" "$redis_id" | jq \
	'.[] | {name:.Name, mounts:.Mounts, tmpfs:.HostConfig.Tmpfs}'
