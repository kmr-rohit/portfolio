#!/bin/sh
set -eu

SCRIPT_DIR=$(CDPATH= cd "$(dirname "$0")" && pwd)
# shellcheck source=common.sh
. "$SCRIPT_DIR/common.sh"

"$SCRIPT_DIR/preflight.sh" --report "$LAB_ROOT/evidence/module-00/preflight.json"
require_command kind
require_command kubectl
require_docker_daemon

previous_context=$(kubectl config current-context 2>/dev/null || true)
restore_context() {
	if [ -n "$previous_context" ] && [ "$previous_context" != "$KUBE_CONTEXT" ]; then
		kubectl config use-context "$previous_context" >/dev/null 2>&1 || true
	fi
}
trap restore_context EXIT HUP INT TERM

if cluster_exists; then
	printf "Cluster '%s' already exists; validating it before reuse.\n" "$CLUSTER_NAME"
	validate_existing_cluster
	kind export kubeconfig --name "$CLUSTER_NAME" >/dev/null
	pass 'existing kind node containers match the pinned topology and image'
else
	printf "Creating cluster '%s' from %s.\n" "$CLUSTER_NAME" "$LAB_ROOT/cluster/core/kind.yaml"
	kind create cluster \
		--name "$CLUSTER_NAME" \
		--config "$LAB_ROOT/cluster/core/kind.yaml" \
		--image "$KIND_NODE_IMAGE" \
		--wait 180s
	validate_existing_cluster
fi

kubectl --context "$KUBE_CONTEXT" wait \
	--for=condition=Ready node --all --timeout=180s

node_count=$(kubectl --context "$KUBE_CONTEXT" get nodes --no-headers | awk 'NF { count += 1 } END { print count + 0 }')
[ "$node_count" -eq 2 ] || fail "API reports $node_count nodes; expected 2"

pass "cluster API reports two Ready nodes through context $KUBE_CONTEXT"
printf '%s\n' 'MODULE 0 CLUSTER READY'
