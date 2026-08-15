#!/bin/sh
set -eu

SCRIPT_DIR=$(CDPATH= cd "$(dirname "$0")" && pwd)
LAB_ROOT=$(CDPATH= cd "$SCRIPT_DIR/.." && pwd)
MODULE_DIR=$LAB_ROOT/modules/01-process-to-container
# shellcheck source=../versions.env
. "$LAB_ROOT/versions.env"

fail() {
	printf 'ERROR: %s\n' "$*" >&2
	exit 1
}

command -v python3 >/dev/null 2>&1 || fail 'python3 is required for the static Python compile check'
command -v ruby >/dev/null 2>&1 || fail 'the macOS Ruby YAML parser is required for static YAML checks'
command -v make >/dev/null 2>&1 || fail 'make is required for the Makefile parse check'

find "$LAB_ROOT" -type f -name '*.sh' -print | LC_ALL=C sort | while IFS= read -r script; do
	sh -n "$script"
	if command -v dash >/dev/null 2>&1; then
		dash -n "$script"
	fi
done
printf '%s\n' 'PASS: every lab shell script parses with POSIX sh'

if find "$LAB_ROOT" -type f -name '*.sh' ! -name 'static-check.sh' \
	-exec grep -nE '\[\[|(^|[[:space:]])function[[:space:]]|declare[[:space:]]+-a' {} +; then
	fail 'a shell script contains a Bash-only construct'
fi
printf '%s\n' 'PASS: no known Bash-only constructs are present'

python3 -c 'from pathlib import Path; import sys; source=Path(sys.argv[1]).read_text(); compile(source, "server.py", "exec")' \
	"$MODULE_DIR/app/server.py"
printf '%s\n' 'PASS: Workbench Python source compiles in memory'

ruby -e '
require "yaml"
ARGV.each { |path| YAML.load_file(path) }
' "$LAB_ROOT/cluster/core/kind.yaml" "$MODULE_DIR/compose.yaml" "$MODULE_DIR/compose.loopback.yaml"
printf '%s\n' 'PASS: kind and Compose files are valid YAML'

ruby -e '
require "yaml"
config = YAML.load_file(ARGV.fetch(0))
abort "unexpected kind apiVersion" unless config["apiVersion"] == "kind.x-k8s.io/v1alpha4"
roles = config.fetch("nodes").map { |node| node["role"] }
abort "expected one control-plane and one worker" unless roles == ["control-plane", "worker"]
' "$LAB_ROOT/cluster/core/kind.yaml"
printf '%s\n' 'PASS: kind config declares one control-plane and one worker'

if command -v docker >/dev/null 2>&1 && docker compose version >/dev/null 2>&1; then
	docker compose --project-name workbench-m01 --file "$MODULE_DIR/compose.yaml" config --quiet
	docker compose --project-name workbench-m01 --file "$MODULE_DIR/compose.yaml" \
		--file "$MODULE_DIR/compose.loopback.yaml" config --quiet
	printf '%s\n' 'PASS: Docker Compose accepts healthy and fault-overlay models without a daemon'
else
	printf '%s\n' 'SKIP: Docker Compose semantic render (CLI/plugin unavailable; YAML was parsed)'
fi

grep -F "$KIND_NODE_IMAGE" "$LAB_ROOT/versions.env" >/dev/null
grep -F "$PYTHON_IMAGE" "$MODULE_DIR/Dockerfile" >/dev/null
grep -F "$PYTHON_IMAGE" "$MODULE_DIR/compose.yaml" >/dev/null
grep -F "$PYTHON_IMAGE" "$MODULE_DIR/assignment/Dockerfile.insecure" >/dev/null
grep -F "$REDIS_IMAGE" "$MODULE_DIR/compose.yaml" >/dev/null
printf '%s\n' 'PASS: required runtime image pins are present'

make -C "$LAB_ROOT" --dry-run help >/dev/null
for target in preflight cluster-up verify evidence cluster-down \
	module-01-up module-01-verify module-01-break module-01-repair module-01-down; do
	make -C "$LAB_ROOT" --dry-run "$target" >/dev/null
done
printf '%s\n' 'PASS: Makefile parses and exposes every public article target'

printf '%s\n' 'STATIC CHECKS PASSED (runtime verification pending Docker Desktop)'
