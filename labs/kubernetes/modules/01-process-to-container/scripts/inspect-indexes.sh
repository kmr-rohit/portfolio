#!/bin/sh
set -eu

SCRIPT_DIR=$(CDPATH= cd "$(dirname "$0")" && pwd)
# shellcheck source=common.sh
. "$SCRIPT_DIR/common.sh"

require_command docker
require_command jq
docker buildx version >/dev/null 2>&1 || fail 'Docker Buildx is required to inspect OCI indexes'
mkdir -p "$MODULE_EVIDENCE_DIR"

inspect_index() {
	index_name=$1
	index_ref=$2
	index_file=$3

	printf 'Inspecting pinned %s OCI index: %s\n' "$index_name" "$index_ref"
	docker buildx imagetools inspect --raw "$index_ref" >"$index_file"

	jq -e '
		(.mediaType | test("image.index|manifest.list")) and
		([.manifests[].platform | select(.os == "linux" and .architecture == "amd64")] | length >= 1) and
		([.manifests[].platform | select(.os == "linux" and .architecture == "arm64")] | length >= 1)
	' "$index_file" >/dev/null || \
		fail "$index_name index does not contain linux/amd64 and linux/arm64 image descriptors"

	jq -r '
		.manifests[] |
		select(.platform.os == "linux" and (.platform.architecture == "amd64" or .platform.architecture == "arm64")) |
		"  \(.platform.os)/\(.platform.architecture) \(.digest)"
	' "$index_file"
	pass "$index_name index publishes linux/amd64 and linux/arm64"
}

inspect_index Python "$PYTHON_IMAGE" "$MODULE_EVIDENCE_DIR/python-oci-index.json"
inspect_index Redis "$REDIS_IMAGE" "$MODULE_EVIDENCE_DIR/redis-oci-index.json"

jq -n \
	--arg python "$PYTHON_IMAGE" \
	--arg redis "$REDIS_IMAGE" \
	'{schema_version:1, python:$python, redis:$redis, required_platforms:["linux/amd64","linux/arm64"]}' \
	>"$MODULE_EVIDENCE_DIR/oci-index-summary.json"

printf '%s\n' 'OCI INDEXES VERIFIED'
