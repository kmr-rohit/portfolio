#!/bin/sh
set -eu

SCRIPT_DIR=$(CDPATH= cd "$(dirname "$0")" && pwd)
LAB_ROOT=$(CDPATH= cd "$SCRIPT_DIR/.." && pwd)
# shellcheck source=../versions.env
. "$LAB_ROOT/versions.env"

REPORT_PATH=$LAB_ROOT/evidence/module-00/preflight.json

usage() {
	printf '%s\n' "usage: $0 [--report PATH]"
}

while [ "$#" -gt 0 ]; do
	case $1 in
		--report)
			[ "$#" -ge 2 ] || { usage >&2; exit 2; }
			REPORT_PATH=$2
			shift 2
			;;
		-h|--help)
			usage
			exit 0
			;;
		*)
			usage >&2
			exit 2
			;;
	esac
done

mkdir -p "$(dirname "$REPORT_PATH")"
CHECKS_FILE=$(mktemp "${TMPDIR:-/tmp}/k8s-preflight-checks.XXXXXX")
REPORT_TMP=$(mktemp "${TMPDIR:-/tmp}/k8s-preflight-report.XXXXXX")
trap 'rm -f "$CHECKS_FILE" "$REPORT_TMP"' EXIT HUP INT TERM

failures=0
check_count=0

json_escape() {
	printf '%s' "$1" | sed 's/\\/\\\\/g; s/"/\\"/g' | tr '\r\n\t' '   '
}

record() {
	check_name=$1
	check_status=$2
	check_detail=$3
	if [ "$check_status" = fail ]; then
		failures=$((failures + 1))
	fi
	if [ "$check_count" -gt 0 ]; then
		printf ',' >>"$CHECKS_FILE"
	fi
	check_count=$((check_count + 1))
	printf '\n    {"name":"%s","status":"%s","detail":"%s"}' \
		"$(json_escape "$check_name")" \
		"$(json_escape "$check_status")" \
		"$(json_escape "$check_detail")" >>"$CHECKS_FILE"
	printf '%-5s %s — %s\n' "$check_status" "$check_name" "$check_detail"
}

check_cli() {
	cli_name=$1
	if command -v "$cli_name" >/dev/null 2>&1; then
		record "$cli_name command" pass "$(command -v "$cli_name")"
	else
		record "$cli_name command" fail 'not found on PATH'
	fi
}

version_at_least() {
	version_value=$1
	minimum_major=$2
	minimum_minor=$3
	version_major=$(printf '%s' "$version_value" | awk -F. '{ print $1 }')
	version_minor=$(printf '%s' "$version_value" | awk -F. '{ print $2 }')
	case $version_major:$version_minor in
		*[!0-9:]*|:*|*:) return 1 ;;
	esac
	[ "$version_major" -gt "$minimum_major" ] || {
		[ "$version_major" -eq "$minimum_major" ] && [ "$version_minor" -ge "$minimum_minor" ]
	}
}

host_os=$(uname -s 2>/dev/null || printf unknown)
if [ "$host_os" = Darwin ]; then
	record 'macOS host' pass "$host_os"
else
	record 'macOS host' fail "found $host_os; this required path targets Docker Desktop on macOS"
fi

host_arch=$(uname -m 2>/dev/null || printf unknown)
case $host_arch in
	arm64|x86_64) record 'host architecture' pass "$host_arch" ;;
	*) record 'host architecture' fail "unsupported architecture: $host_arch" ;;
esac

host_cpus=$(getconf _NPROCESSORS_ONLN 2>/dev/null || printf unknown)
case $host_cpus in
	*[!0-9]*|'') record 'host CPU' fail 'could not read the online processor count' ;;
	*)
		if [ "$host_cpus" -ge 4 ]; then
			record 'host CPU' pass "$host_cpus logical CPUs"
		else
			record 'host CPU' fail "$host_cpus logical CPUs; at least 4 are required"
		fi
		;;
esac

host_memory=unknown
if [ "$host_os" = Darwin ] && command -v sysctl >/dev/null 2>&1; then
	host_memory=$(sysctl -n hw.memsize 2>/dev/null || printf unknown)
fi
if [ "$host_memory" = unknown ] && command -v system_profiler >/dev/null 2>&1; then
	host_memory_human=$(LC_ALL=C system_profiler SPHardwareDataType 2>/dev/null | awk -F': ' '/Memory: / { print $2; exit }')
	host_memory=$(printf '%s\n' "$host_memory_human" | awk '
		$2 == "GB" { printf "%.0f", $1 * 1073741824; found = 1 }
		$2 == "TB" { printf "%.0f", $1 * 1099511627776; found = 1 }
		END { if (!found) print "unknown" }
	')
fi
case $host_memory in
	*[!0-9]*|'') record 'host memory' fail 'could not read hw.memsize' ;;
	*)
		if [ "$host_memory" -ge 17179869184 ]; then
			record 'host memory' pass "$host_memory bytes"
		else
			record 'host memory' fail "$host_memory bytes; at least 16 GiB is required"
		fi
		;;
esac

for cli in docker kind kubectl curl jq git make; do
	check_cli "$cli"
done

if command -v kind >/dev/null 2>&1; then
	kind_output=$(kind version 2>&1 | tr '\r\n' '  ' || true)
	case " $kind_output " in
		*" $KIND_VERSION "*) record 'kind version pin' pass "$kind_output" ;;
		*) record 'kind version pin' fail "found '$kind_output'; expected $KIND_VERSION" ;;
	esac
fi

if command -v kubectl >/dev/null 2>&1; then
	kubectl_output=$(kubectl version --client=true --output=json 2>&1 | tr '\r\n' '  ' || true)
	if printf '%s' "$kubectl_output" | grep -F 'clientVersion' >/dev/null 2>&1; then
		record 'kubectl client version' pass "$kubectl_output"
		if command -v jq >/dev/null 2>&1; then
			client_minor=$(printf '%s' "$kubectl_output" | jq -r '.clientVersion.minor' | sed 's/[^0-9].*$//')
			server_minor=$(printf '%s' "$KUBERNETES_VERSION" | sed 's/^v[0-9]*\.\([0-9]*\)\..*$/\1/')
			case $client_minor:$server_minor in
				*[!0-9:]*|:*|*:) record 'kubectl version skew' fail 'could not parse client or server minor version' ;;
				*)
					minimum_minor=$((server_minor - 1))
					maximum_minor=$((server_minor + 1))
					if [ "$client_minor" -ge "$minimum_minor" ] && [ "$client_minor" -le "$maximum_minor" ]; then
						record 'kubectl version skew' pass "client minor $client_minor is within $minimum_minor-$maximum_minor for server minor $server_minor"
					else
						record 'kubectl version skew' fail "client minor $client_minor is outside $minimum_minor-$maximum_minor for server minor $server_minor"
					fi
					;;
			esac
		else
			record 'kubectl version skew' fail 'jq is required to parse kubectl client metadata'
		fi
	else
		record 'kubectl client version' fail "$kubectl_output"
	fi
fi

docker_daemon_ready=false
docker_desktop_memory=unknown
docker_desktop_cpus=unknown
docker_platform=unknown
if command -v docker >/dev/null 2>&1; then
	compose_output=$(docker compose version 2>&1 | tr '\r\n' '  ' || true)
	if docker compose version >/dev/null 2>&1; then
		record 'Docker Compose plugin' pass "$compose_output"
		compose_version=$(docker compose version --short 2>/dev/null | sed 's/^[^0-9]*//; s/[^0-9.].*$//')
		if version_at_least "$compose_version" 2 20; then
			record 'Docker Compose feature level' pass "$compose_version (minimum 2.20)"
		else
			record 'Docker Compose feature level' fail "found '$compose_version'; version 2.20 or newer is required"
		fi
	else
		record 'Docker Compose plugin' fail "$compose_output"
	fi

	buildx_output=$(docker buildx version 2>&1 | tr '\r\n' '  ' || true)
	if docker buildx version >/dev/null 2>&1; then
		record 'Docker Buildx plugin' pass "$buildx_output"
		buildx_version=$(printf '%s' "$buildx_output" | sed -n 's/.* v\([0-9][0-9.]*\).*/\1/p')
		if version_at_least "$buildx_version" 0 11; then
			record 'Docker Buildx feature level' pass "$buildx_version (minimum 0.11)"
		else
			record 'Docker Buildx feature level' fail "found '$buildx_version'; version 0.11 or newer is required"
		fi
	else
		record 'Docker Buildx plugin' fail "$buildx_output"
	fi

	if docker info >/dev/null 2>&1; then
		docker_daemon_ready=true
		docker_platform=$(docker info --format '{{.OperatingSystem}}|{{.OSType}}|{{.Architecture}}' 2>/dev/null || printf unknown)
		docker_desktop_memory=$(docker info --format '{{.MemTotal}}' 2>/dev/null || printf unknown)
		docker_desktop_cpus=$(docker info --format '{{.NCPU}}' 2>/dev/null || printf unknown)
		case $docker_platform in
			*Docker\ Desktop*'|linux|'*) record 'Docker Desktop Linux VM' pass "$docker_platform" ;;
			*) record 'Docker Desktop Linux VM' fail "found '$docker_platform'; Docker Desktop Linux containers are required" ;;
		esac
		case $docker_desktop_memory in
			*[!0-9]*|'') record 'Docker Desktop memory' fail 'could not read daemon MemTotal' ;;
			*)
				# An 8 GiB Docker Desktop allocation reports slightly less usable
				# memory from inside its Linux VM because the VM reserves overhead.
				if [ "$docker_desktop_memory" -ge 8053063680 ]; then
					record 'Docker Desktop memory' pass "$docker_desktop_memory usable bytes (8 GiB allocation)"
				else
					record 'Docker Desktop memory' fail "$docker_desktop_memory bytes; allocate at least 8 GiB (7.5 GiB usable)"
				fi
				;;
		esac
		case $docker_desktop_cpus in
			*[!0-9]*|'') record 'Docker Desktop CPU' fail 'could not read daemon NCPU' ;;
			*)
				if [ "$docker_desktop_cpus" -ge 4 ]; then
					record 'Docker Desktop CPU' pass "$docker_desktop_cpus logical CPUs"
				else
					record 'Docker Desktop CPU' fail "$docker_desktop_cpus logical CPUs; allocate at least 4"
				fi
				;;
		esac
	else
		record 'Docker Desktop daemon' fail 'not reachable; start Docker Desktop'
	fi
fi

if [ "$failures" -eq 0 ]; then
	overall_status=pass
else
	overall_status=fail
fi

checked_at=$(date -u '+%Y-%m-%dT%H:%M:%SZ')
{
	printf '{\n'
	printf '  "schema_version":1,\n'
	printf '  "status":"%s",\n' "$overall_status"
	printf '  "checked_at":"%s",\n' "$checked_at"
	printf '  "host":{"os":"%s","architecture":"%s","cpus":"%s","memory_bytes":"%s"},\n' \
		"$(json_escape "$host_os")" "$(json_escape "$host_arch")" "$(json_escape "$host_cpus")" "$(json_escape "$host_memory")"
	printf '  "docker":{"daemon_ready":%s,"platform":"%s","cpus":"%s","memory_bytes":"%s"},\n' \
		"$docker_daemon_ready" "$(json_escape "$docker_platform")" "$(json_escape "$docker_desktop_cpus")" "$(json_escape "$docker_desktop_memory")"
	printf '  "pins":{"cluster":"%s","context":"%s","kind":"%s","kubernetes":"%s","node_image":"%s"},\n' \
		"$CLUSTER_NAME" "$KUBE_CONTEXT" "$KIND_VERSION" "$KUBERNETES_VERSION" "$(json_escape "$KIND_NODE_IMAGE")"
	printf '  "checks":['
	cat "$CHECKS_FILE"
	printf '\n  ]\n}\n'
} >"$REPORT_TMP"
mv "$REPORT_TMP" "$REPORT_PATH"

printf 'Preflight report: %s\n' "$REPORT_PATH"
if [ "$failures" -ne 0 ]; then
	printf 'MODULE 0 PREFLIGHT FAILED (%s failed checks)\n' "$failures" >&2
	exit 1
fi

printf '%s\n' 'MODULE 0 PREFLIGHT PASSED'
