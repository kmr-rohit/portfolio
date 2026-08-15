# Kubernetes learning labs

These are the runnable companion labs for Modules 0 and 1 of the Kubernetes
learning series. They target macOS on Apple Silicon or Intel, Docker Desktop,
and POSIX `/bin/sh`. Docker Desktop supplies the Linux VM; the host Mac is not a
Kubernetes node.

All important inputs are pinned in [`versions.env`](./versions.env). In
particular, the cluster is always named `k8s-learning`; scripts never operate
on whichever kubectl context happens to be current.

## Module 0: the disposable lab

```sh
make preflight
make cluster-up
make verify
make evidence
make cluster-down
```

`cluster-up` is intentionally conservative. If a cluster named
`k8s-learning` already exists, it is reused only when its two node containers,
roles, and pinned images match this lab. A mismatch stops with an explanation;
the script never replaces a cluster implicitly. `cluster-down` is the only
command that deletes it.

The generated preflight report is
`evidence/module-00/preflight.json`. Cluster observations—including whatever
StorageClasses the pinned kind bootstrap exposes—are written beneath
`evidence/module-00/cluster/`. Module 0 does not promise or install a storage
provisioner; storage is introduced as an explicit bundle later in the course.

## Module 1: from process to container

```sh
make module-01-up
curl --fail http://127.0.0.1:18080/healthz
make module-01-verify
make module-01-break
make module-01-repair
make module-01-down
```

The API is Python standard library only. It speaks Redis' RESP protocol
directly, emits one JSON object per log line, runs as uid/gid `10001`, uses a
read-only root filesystem, and drains in-flight work on `SIGTERM`. Compose also
applies CPU, memory, PID, capability, and privilege limits to both services.

`module-01-break` changes only the API bind address to `127.0.0.1` inside the
container. Its internal healthcheck remains green while the Docker bridge and
the published host port become unreachable. `module-01-repair` restores
`0.0.0.0` deterministically.

`module-01-verify` performs the complete proof: published health, Redis-backed
state, runtime identity and restrictions, structured logs, both `linux/amd64`
and `linux/arm64` descriptors in the pinned base-image indexes, and completion
of an in-flight slow request while Compose sends `SIGTERM`. Evidence is written
beneath `evidence/module-01/`.

## Static validation

`make static-check` does not contact the Docker daemon or a registry. It parses
the POSIX shell scripts, compiles the Python source in memory, parses the YAML,
asserts the kind topology, and renders the Compose models when the Compose
plugin is installed. Runtime verification still requires Docker Desktop to be
running.
