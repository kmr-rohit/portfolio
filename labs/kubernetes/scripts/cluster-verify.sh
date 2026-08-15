#!/bin/sh
set -eu

SCRIPT_DIR=$(CDPATH= cd "$(dirname "$0")" && pwd)
# shellcheck source=common.sh
. "$SCRIPT_DIR/common.sh"

REPORT_PATH=$LAB_ROOT/evidence/module-00/verification.txt

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
		*) usage >&2; exit 2 ;;
	esac
done

require_command kind
require_command kubectl
require_command jq
require_docker_daemon
mkdir -p "$(dirname "$REPORT_PATH")"
: >"$REPORT_PATH"

log() {
	printf '%s\n' "$*" | tee -a "$REPORT_PATH"
}

assert() {
	assert_message=$1
	shift
	if "$@"; then
		log "PASS: $assert_message"
	else
		log "FAIL: $assert_message"
		exit 1
	fi
}

validate_existing_cluster
log "PASS: Docker has exactly the pinned control-plane and worker containers"

assert "kubeconfig contains context $KUBE_CONTEXT" \
	sh -c 'kubectl config get-contexts -o name | grep -F -x "$1" >/dev/null' sh "$KUBE_CONTEXT"

kubectl --context "$KUBE_CONTEXT" wait \
	--for=condition=Ready node --all --timeout=180s >>"$REPORT_PATH" 2>&1
log 'PASS: all nodes report Ready'

server_version=$(kubectl --context "$KUBE_CONTEXT" version -o json | jq -r '.serverVersion.gitVersion')
assert "API server is pinned to $KUBERNETES_VERSION (found $server_version)" \
	test "$server_version" = "$KUBERNETES_VERSION"

nodes_json=$(kubectl --context "$KUBE_CONTEXT" get nodes -o json)
node_count=$(printf '%s' "$nodes_json" | jq '.items | length')
assert "API contains exactly two nodes" test "$node_count" -eq 2

assert 'control-plane node has the control-plane role label' \
	sh -c 'printf "%s" "$1" | jq -e --arg node "$2" '\''any(.items[]; .metadata.name == $node and (.metadata.labels["node-role.kubernetes.io/control-plane"] != null))'\'' >/dev/null' \
		sh "$nodes_json" "$CLUSTER_NAME-control-plane"

assert 'worker node is present and is not labeled as a control plane' \
	sh -c 'printf "%s" "$1" | jq -e --arg node "$2" '\''any(.items[]; .metadata.name == $node and (.metadata.labels["node-role.kubernetes.io/control-plane"] == null))'\'' >/dev/null' \
		sh "$nodes_json" "$CLUSTER_NAME-worker"

assert 'control-plane remains tainted NoSchedule' \
	sh -c 'printf "%s" "$1" | jq -e --arg node "$2" '\''any(.items[] | select(.metadata.name == $node) | .spec.taints[]?; .key == "node-role.kubernetes.io/control-plane" and .effect == "NoSchedule")'\'' >/dev/null' \
		sh "$nodes_json" "$CLUSTER_NAME-control-plane"

kubectl --context "$KUBE_CONTEXT" -n kube-system wait \
	--for=condition=Available deployment/coredns --timeout=180s >>"$REPORT_PATH" 2>&1
log 'PASS: CoreDNS deployment is Available'

dns_addresses=$(kubectl --context "$KUBE_CONTEXT" -n kube-system get endpointslice \
	-l kubernetes.io/service-name=kube-dns -o json | \
	jq '[.items[].endpoints[]? | select((.conditions.ready // true) == true) | .addresses[]?] | length')
assert 'kube-dns has at least one ready endpoint address' test "$dns_addresses" -gt 0

readyz=$(kubectl --context "$KUBE_CONTEXT" get --raw='/readyz' 2>/dev/null)
assert 'API server /readyz returns ok' test "$readyz" = ok

log "Verification report: $REPORT_PATH"
log 'MODULE 0 VERIFIED'
