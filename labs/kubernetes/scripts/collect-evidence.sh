#!/bin/sh
set -eu

SCRIPT_DIR=$(CDPATH= cd "$(dirname "$0")" && pwd)
# shellcheck source=common.sh
. "$SCRIPT_DIR/common.sh"

require_command kubectl
require_command jq
require_command shasum
require_docker_daemon
validate_existing_cluster

EVIDENCE_DIR=$LAB_ROOT/evidence/module-00/cluster
mkdir -p "$EVIDENCE_DIR"
# Remove filenames used by an earlier, overly broad inventory so a rerun cannot
# carry unrelated local cluster/context names into a submitted packet.
rm -f "$EVIDENCE_DIR/kind-clusters.txt" "$EVIDENCE_DIR/kubectl-contexts.txt"

"$SCRIPT_DIR/cluster-verify.sh" --report "$LAB_ROOT/evidence/module-00/verification.txt"

kind get clusters | grep -F -x "$CLUSTER_NAME" >"$EVIDENCE_DIR/kind-cluster.txt"
docker ps -a \
	--filter "label=io.x-k8s.kind.cluster=$CLUSTER_NAME" \
	--format 'table {{.Names}}\t{{.Image}}\t{{.Status}}' >"$EVIDENCE_DIR/docker-nodes.txt"
docker inspect "$CLUSTER_NAME-control-plane" "$CLUSTER_NAME-worker" >"$EVIDENCE_DIR/docker-node-inspect.json"
kubectl config get-contexts "$KUBE_CONTEXT" >"$EVIDENCE_DIR/kubectl-context.txt"
kubectl --context "$KUBE_CONTEXT" cluster-info >"$EVIDENCE_DIR/cluster-info.txt"
kubectl --context "$KUBE_CONTEXT" version -o json >"$EVIDENCE_DIR/kubernetes-version.json"
kubectl --context "$KUBE_CONTEXT" get nodes -o wide >"$EVIDENCE_DIR/nodes-wide.txt"
kubectl --context "$KUBE_CONTEXT" get nodes -o json >"$EVIDENCE_DIR/nodes.json"
kubectl --context "$KUBE_CONTEXT" -n kube-system get pods -o wide >"$EVIDENCE_DIR/kube-system-pods.txt"
kubectl --context "$KUBE_CONTEXT" -n kube-system get endpointslice \
	-l kubernetes.io/service-name=kube-dns -o yaml >"$EVIDENCE_DIR/kube-dns-endpoints.yaml"
kubectl --context "$KUBE_CONTEXT" get storageclass -o yaml >"$EVIDENCE_DIR/storageclasses.yaml"
kubectl --context "$KUBE_CONTEXT" get events -A \
	--sort-by='.metadata.creationTimestamp' >"$EVIDENCE_DIR/events.txt"
kubectl --context "$KUBE_CONTEXT" get --raw='/readyz?verbose' >"$EVIDENCE_DIR/apiserver-readyz.txt"
cp "$LAB_ROOT/versions.env" "$EVIDENCE_DIR/versions.env"
cp "$LAB_ROOT/cluster/core/kind.yaml" "$EVIDENCE_DIR/kind.yaml"

checked_at=$(date -u '+%Y-%m-%dT%H:%M:%SZ')
cat >"$EVIDENCE_DIR/metadata.json" <<EOF
{
  "schema_version": 1,
  "collected_at": "$checked_at",
  "cluster": "$CLUSTER_NAME",
  "context": "$KUBE_CONTEXT",
  "kind": "$KIND_VERSION",
  "kubernetes": "$KUBERNETES_VERSION",
  "node_image": "$KIND_NODE_IMAGE"
}
EOF

(
	cd "$EVIDENCE_DIR"
	shasum -a 256 \
		apiserver-readyz.txt cluster-info.txt docker-node-inspect.json docker-nodes.txt \
			events.txt kind-cluster.txt kind.yaml kube-dns-endpoints.yaml kube-system-pods.txt \
			kubectl-context.txt kubernetes-version.json metadata.json nodes-wide.txt nodes.json \
		storageclasses.yaml versions.env >SHA256SUMS
)

printf 'Evidence: %s\n' "$EVIDENCE_DIR"
printf '%s\n' 'MODULE 0 EVIDENCE COLLECTED'
