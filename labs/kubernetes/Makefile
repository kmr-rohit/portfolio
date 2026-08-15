SHELL := /bin/sh
.DEFAULT_GOAL := help

.PHONY: help static-check \
	preflight cluster-up verify evidence cluster-down \
	module-00-preflight module-00-up module-00-verify module-00-evidence module-00-down \
	module-01-build module-01-up module-01-verify module-01-break module-01-repair \
	module-01-down module-01-runtime-verify module-01-architectures module-01-drain \
	module-01-evidence module-01-inspect

help:
	@printf '%s\n' \
		'Kubernetes learning labs' \
		'' \
		'Module 0 — disposable kind cluster' \
		'  make preflight       Check the pinned macOS/Docker Desktop toolchain' \
		'  make cluster-up      Safely create or reuse k8s-learning' \
		'  make verify          Verify topology, Kubernetes, DNS, and API health' \
		'  make evidence        Collect machine-readable Module 0 evidence' \
		'  make cluster-down    Explicitly remove only k8s-learning' \
		'' \
		'Module 1 — process to container' \
		'  make module-01-up       Build and start Workbench at 127.0.0.1:18080' \
		'  make module-01-verify   Prove runtime, OCI index, and drain contracts' \
		'  make module-01-break    Recreate the loopback-only bind fault' \
		'  make module-01-repair   Restore the all-interface bind and verify it' \
		'  make module-01-down     Explicitly remove the Compose stack' \
		'' \
		'Maintainers' \
		'  make static-check     Parse shell, Python, Compose, and kind config'

# The five short names are the stable Module 0 article contract.
preflight:
	@./scripts/preflight.sh --report ./evidence/module-00/preflight.json

cluster-up:
	@./scripts/cluster-up.sh

verify:
	@./scripts/cluster-verify.sh --report ./evidence/module-00/verification.txt

evidence:
	@./scripts/collect-evidence.sh

cluster-down:
	@./scripts/cluster-down.sh

module-00-preflight: preflight
module-00-up: cluster-up
module-00-verify: verify
module-00-evidence: evidence
module-00-down: cluster-down

# The zero-padded names are the stable Module 1 article contract.
module-01-build:
	@./modules/01-process-to-container/scripts/up.sh --build-only

module-01-up:
	@./modules/01-process-to-container/scripts/up.sh

module-01-verify:
	@./modules/01-process-to-container/scripts/verify-all.sh

module-01-break:
	@./modules/01-process-to-container/scripts/break-loopback.sh

module-01-repair:
	@./modules/01-process-to-container/scripts/repair.sh

module-01-down:
	@./modules/01-process-to-container/scripts/down.sh

module-01-runtime-verify:
	@./modules/01-process-to-container/scripts/verify-runtime.sh

module-01-architectures:
	@./modules/01-process-to-container/scripts/inspect-indexes.sh

module-01-drain:
	@./modules/01-process-to-container/scripts/verify-drain.sh

module-01-evidence: module-01-verify
	@printf '%s\n' 'Evidence: evidence/module-01/'

module-01-inspect:
	@./modules/01-process-to-container/scripts/inspect.sh

static-check:
	@./scripts/static-check.sh
