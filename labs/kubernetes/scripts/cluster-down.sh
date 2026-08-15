#!/bin/sh
set -eu

SCRIPT_DIR=$(CDPATH= cd "$(dirname "$0")" && pwd)
# shellcheck source=common.sh
. "$SCRIPT_DIR/common.sh"

require_command kind
require_docker_daemon

if ! cluster_exists && [ -z "$(course_node_names)" ]; then
	printf "Cluster '%s' is already absent.\n" "$CLUSTER_NAME"
	printf '%s\n' 'MODULE 0 CLUSTER REMOVED'
	exit 0
fi

validate_course_cluster_ownership
printf "Deleting only kind cluster '%s'.\n" "$CLUSTER_NAME"
kind delete cluster --name "$CLUSTER_NAME"

if cluster_exists; then
	fail "kind still reports cluster '$CLUSTER_NAME' after deletion"
fi

printf '%s\n' 'MODULE 0 CLUSTER REMOVED'
