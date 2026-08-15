#!/bin/sh

# Shared POSIX-shell helpers for the kind lab. This file is sourced, not run.
COMMON_DIR=$(CDPATH= cd "$(dirname "$0")" && pwd)
LAB_ROOT=$(CDPATH= cd "$COMMON_DIR/.." && pwd)
# shellcheck source=../versions.env
. "$LAB_ROOT/versions.env"

# The course path is specifically Docker Desktop; do not let kind silently
# select another locally installed provider.
KIND_EXPERIMENTAL_PROVIDER=docker
export KIND_EXPERIMENTAL_PROVIDER

fail() {
	printf 'ERROR: %s\n' "$*" >&2
	exit 1
}

pass() {
	printf 'PASS: %s\n' "$*"
}

require_command() {
	command -v "$1" >/dev/null 2>&1 || fail "required command not found: $1"
}

require_docker_daemon() {
	require_command docker
	docker info >/dev/null 2>&1 || fail 'Docker Desktop is not running. Start it and retry.'
}

cluster_exists() {
	kind get clusters 2>/dev/null | grep -F -x "$CLUSTER_NAME" >/dev/null 2>&1
}

container_value() {
	docker inspect --format "$1" "$2" 2>/dev/null
}

validate_node_identity() {
	node_name=$1
	expected_role=$2

	docker inspect "$node_name" >/dev/null 2>&1 || fail "expected kind node container is missing: $node_name"

	actual_cluster=$(container_value '{{ index .Config.Labels "io.x-k8s.kind.cluster" }}' "$node_name")
	[ "$actual_cluster" = "$CLUSTER_NAME" ] || fail "$node_name belongs to cluster '$actual_cluster', not '$CLUSTER_NAME'"

	actual_role=$(container_value '{{ index .Config.Labels "io.x-k8s.kind.role" }}' "$node_name")
	[ "$actual_role" = "$expected_role" ] || fail "$node_name has role '$actual_role'; expected '$expected_role'"

	actual_image=$(container_value '{{ .Config.Image }}' "$node_name")
	[ "$actual_image" = "$KIND_NODE_IMAGE" ] || fail "$node_name uses '$actual_image'; expected pinned image '$KIND_NODE_IMAGE'"
}

validate_node_container() {
	node_name=$1
	expected_role=$2
	validate_node_identity "$node_name" "$expected_role"

	actual_state=$(container_value '{{ .State.Status }}' "$node_name")
	[ "$actual_state" = running ] || fail "$node_name is '$actual_state'; use 'make cluster-down' before rebuilding"
}

course_node_names() {
	docker ps -a \
		--filter "label=io.x-k8s.kind.cluster=$CLUSTER_NAME" \
		--format '{{.Names}}' | LC_ALL=C sort
}

validate_course_cluster_ownership() {
	owned_node_names=$(course_node_names)
	[ -n "$owned_node_names" ] || fail "kind cluster '$CLUSTER_NAME' has no node containers to identify safely"

	for owned_node_name in $owned_node_names; do
		case $owned_node_name in
			"$CLUSTER_NAME-control-plane")
				validate_node_identity "$owned_node_name" control-plane
				;;
			"$CLUSTER_NAME-worker")
				validate_node_identity "$owned_node_name" worker
				;;
			*)
				fail "refusing to delete cluster '$CLUSTER_NAME': unexpected node container '$owned_node_name'"
				;;
		esac
	done
}

validate_existing_cluster() {
	cluster_exists || fail "kind cluster '$CLUSTER_NAME' does not exist; run 'make cluster-up'"

	node_names=$(course_node_names)
	node_count=$(printf '%s\n' "$node_names" | awk 'NF { count += 1 } END { print count + 0 }')
	[ "$node_count" -eq 2 ] || fail "cluster '$CLUSTER_NAME' has $node_count node containers; expected exactly 2"

	printf '%s\n' "$node_names" | grep -F -x "$CLUSTER_NAME-control-plane" >/dev/null 2>&1 || \
		fail "cluster '$CLUSTER_NAME' is missing its expected control-plane container"
	printf '%s\n' "$node_names" | grep -F -x "$CLUSTER_NAME-worker" >/dev/null 2>&1 || \
		fail "cluster '$CLUSTER_NAME' is missing its expected worker container"

	validate_node_container "$CLUSTER_NAME-control-plane" control-plane
	validate_node_container "$CLUSTER_NAME-worker" worker
}
