---
title: "Kubernetes 01: A container is a process with boundaries"
description: "Run an API and Redis in two containers, break their connection, repair it, and stop the API without dropping a request."
date: "2026-08-15"
tags:
  - Kubernetes
  - Containers
  - Docker
draft: false
series: kubernetes
seriesTitle: Kubernetes from first principles
module: 1
season: 1
tracks: [shared]
difficulty: foundation
resourceTier: LOCAL-CORE
labRuntime: docker
labTime: 60
prerequisites: [kubernetes-00-disposable-lab]
labPath: labs/kubernetes/modules/01-process-to-container
lastVerified: "2026-08-15"
---

An application begins as a **process**: a program that is currently running. It has memory, open files, and an identifying number. We will first package the program's files and defaults into an **image**, then start a running copy of that image as a **container**: an ordinary process with configured boundaries.

Keep this chain in mind: **source files → image → running container → network connection → safe shutdown**. You will build the Workbench application programming interface (API)—a small web service—and connect it to Redis, a separate service that stores a counter in memory. You will inspect the boundaries, break one connection setting, repair it, and prove that a request already in progress survives shutdown. The goal is not to memorize Docker syntax. It is to understand what Docker can control and what the application must do correctly itself.

## Start with one ordinary process

Complete [Module 0](/writing/kubernetes-00-disposable-lab) first. It shows how to download the lab files and checks your tools. For this module you only need Docker running; the Kubernetes cluster can stay deleted. Allow about 60 minutes. The `LOCAL-CORE` laptop profile expects 4 processor cores and 8 gigabytes allocated to Docker; 16 gigabytes of host memory is recommended. The supplied files fix the Python and Redis versions so everyone starts from the same inputs.

When the API starts, the operating system gives its process an identifier, or **PID**. A process can listen for network traffic at a **port**, a numbered door such as 8080. Its **bind address** chooses which of the container's network addresses may reach that door.

The operating system can also send a process a **signal**, a small control notification. `SIGTERM` is the conventional request to terminate. A **graceful shutdown** means the process reacts by refusing new work, finishing work it already accepted, writing its final logs, and exiting within the allowed time.

Together, those choices form a **runtime contract**: the promises an application must keep while it is running. Here the API must be reachable from the Mac, find Redis by name, run without the all-powerful Linux `root` user, write only to allowed folders, stay within resource limits, produce readable records, and finish an accepted slow request after `SIGTERM`.

There is no Kubernetes cluster in this module, so `kubectl` stays idle. Kubernetes can later place and replace workloads, but it cannot invent a correct bind address or shutdown protocol for an application.

## Package its files in an image

A **Dockerfile** is a recipe for building an image. The image is a saved package containing files and startup defaults. It does not run by itself; a container is the running copy.

The final argument to `docker build` is the **build context**: the set of files available to `COPY` and `ADD`. A narrow context and a deliberate `.dockerignore` keep unrelated source, credentials, and large dependency trees away from the builder. Docker's [build-context documentation](https://docs.docker.com/build/concepts/context/) explains the boundary.

Workbench uses one build stage because there is no compiler or dependency cache to discard:

```dockerfile
FROM python:3.13.14-alpine
RUN addgroup -S -g 10001 workbench \
    && adduser -S -D -H -u 10001 -G workbench workbench
WORKDIR /app
COPY --chown=10001:10001 app/server.py /app/server.py
USER 10001:10001
EXPOSE 8080
ENTRYPOINT ["python", "/app/server.py"]
```

The complete lab Dockerfile uses the release's pinned image reference; the tag above keeps the example readable. `USER 10001:10001` supplies a numeric, non-root default. The JSON form of `ENTRYPOINT` starts Python directly, which will matter when the runtime sends `SIGTERM`. [`EXPOSE 8080`](https://docs.docker.com/reference/dockerfile/#expose) is only metadata documenting an intended port. It neither starts a listener nor makes the port reachable from the host.

**Optional depth — layers.** An image is an ordered stack of filesystem changes, defined by the Open Container Initiative [layer specification](https://github.com/opencontainers/image-spec/blob/v1.1.1/layer.md). A running container adds a temporary writable layer. Deleting the container deletes that layer, so durable state belongs in a volume or external service. A secret copied in one build step can remain in image history even if a later step deletes it.

If a future service compiles code, a [multi-stage build](https://docs.docker.com/build/building/multi-stage/) can leave compilers and caches out of the runtime stage. Use that pattern when there is a real artifact boundary. An empty extra stage adds no protection, and a smaller image is not automatically a safer image.

## Start it as a bounded container

Starting the image creates a container process. A container shares the host's Linux kernel; it does not boot a guest kernel like a virtual machine. On macOS, Docker Desktop runs the Linux processes inside a Linux virtual machine. The containers share that virtual machine's kernel, not the macOS kernel.

Linux supplies two important kinds of boundary:

- A **namespace** changes what a process can see. A PID namespace provides a private process-numbering view. A network namespace provides interfaces, routes, and a loopback device of its own.
- A **control group**, usually called a **cgroup**, accounts for and limits resources such as CPU, memory, and process count.

These mechanisms are independent. A private view does not create a memory limit, and a memory limit does not create a private network.

Inside its PID namespace, the image command becomes **PID 1**, the first process in that view. PID 1 receives the container's stop signal and must handle child processes correctly. Because Workbench uses the JSON `ENTRYPOINT`, Python owns PID 1 instead of sitting behind a shell that might mishandle signals.

Docker adds settings that are not baked into the image: configuration values, the Mac port to forward, read-only files with a small writable temporary area, CPU and memory limits, and how long to wait during shutdown. The lab also removes extra Linux administrator powers and prevents the process from gaining new ones. Docker can override the image's user or command, so `USER 10001:10001` is a default, not proof. The lab checks the real user after startup.

A container is not the same security boundary as a virtual machine because containers share a Linux kernel. A production setup still needs a non-root user, very few administrator powers, read-only files where possible, blocked kernel actions the app does not need, carefully chosen mounted folders, and an updated host. A numbered container user is not automatically a separate user on the host.

## Give the API and Redis a private network

A **network** is the path and addressing system processes use to exchange data. **Redis** is the separate in-memory data service that stores this lab's request counter. **Loopback**, commonly named `localhost` and addressed as `127.0.0.1`, always points back into the network namespace where the caller is running.

Docker Compose creates a private **bridge network**, a software connection between the two containers. The API and Redis each get an address on that bridge.

Use the diagram as the map for the lab:

![Docker forwards the Mac's loopback port to the API's bridge interface; a container-local loopback listener can stay healthy while that published path fails.](/sketches/container-network-boundaries.svg)

Read the upper path from left to right:

1. A host client calls `127.0.0.1:18080`. This is host loopback, so the first hop is available only from the laptop.
2. Docker's published-port rule forwards host port 18080 to port 8080 on the API container's bridge-facing interface.
3. The API listens on `0.0.0.0:8080`. Here `0.0.0.0` means every Internet Protocol version 4 (IPv4) interface inside the API's network namespace, including the bridge interface.
4. The API calls `redis:6379`. On the [user-defined bridge](https://docs.docker.com/engine/network/drivers/bridge/), Docker's Domain Name System (DNS) resolver maps the stable service name `redis` to the Redis container's current bridge address.

Redis is not published to the host. Also, `localhost` inside the API means the API container itself—not the laptop and not Redis. Keep two controls separate: port publication decides how host traffic enters; the process bind address decides which container interfaces accept it.

**Docker Compose** is the tool that reads `compose.yaml` and starts this two-container application. It starts Redis first and waits for its health check before starting the API. Startup order alone would not prove readiness; a running Redis process may not yet be ready to answer.

## Bring up the lab and inspect the evidence

From the portfolio repository root, run:

```bash
make -C labs/kubernetes module-01-up
```

Compose progress varies by version. Wait for the stable final marker:

```bash
MODULE 1 READY: http://127.0.0.1:18080
```

The target builds `workbench-api:module-01`, creates a project-scoped bridge, starts Redis, waits for Redis, starts the API, and waits for the API health endpoint. Re-running it converges on the same named project rather than accumulating containers.

Before continuing, connect each observation to a claim:

- **Process:** Python is PID 1, and its effective user identifier (UID) and group identifier (GID) are 10001.
- **Network:** the host reaches port 18080, while the API reaches unpublished Redis at `redis:6379`.
- **State:** two successful API requests return an increasing Redis-backed counter. This proves DNS resolution, transport, and state mutation—not only two Hypertext Transfer Protocol (HTTP) responses.
- **Filesystem and resources:** the root filesystem is read-only, declared temporary space remains writable, and cgroups impose finite processor, memory, and process limits.
- **Logs:** the API writes one JavaScript Object Notation (JSON) record per event to its normal terminal output. A completed request includes `event`, `level`, `service`, `timestamp`, `method`, `path`, `request_id`, `duration_ms`, and `inflight`; values such as timestamps and durations vary.

The image command, arguments, identity, bind address, ports, dependency address, environment, writable paths, limits, logs, stop signal, grace period, and exit code are all parts of one runtime contract. Changing any of them can change the result without changing application source.

## Break loopback, then repair it

Replace the API with a deliberately wrong bind address:

```bash
make -C labs/kubernetes module-01-break
```

The target ends with:

```bash
LOOPBACK FAULT REPRODUCED
```

It sets `WORKBENCH_BIND_HOST=127.0.0.1`. The process still starts, and a health check inside the same container can reach its private loopback address. Yet the Mac's published path and the container's network address both fail. In the diagram, the listener has moved from the upper path to the lower fault.

Nothing else changed: not the image, port forwarding, Docker name lookup, Redis, or process identity. Docker forwards traffic toward the container's network address, but a listener attached only to the container's private loopback address does not accept it. `EXPOSE 8080` cannot repair the fault because it neither starts a listener nor forwards a port.

Restore the all-interface bind:

```bash
make -C labs/kubernetes module-01-repair
```

Expected final output:

```bash
MODULE 1 REPAIRED
```

The target sets `WORKBENCH_BIND_HOST=0.0.0.0` and proves the published path works again. This does not publish the API to the world: the separate host mapping remains restricted to `127.0.0.1:18080`.

## Verify platform metadata and graceful shutdown

Run the full proof:

```bash
make -C labs/kubernetes module-01-verify
```

Its stable evidence ends with these claims:

```bash
PASS: published health endpoint is reachable at http://127.0.0.1:18080/healthz
PASS: Redis-backed request counter advanced from <n> to <n+1>
PASS: API process runs as uid/gid 10001
PASS: API root filesystem is read-only
PASS: Python index publishes linux/amd64 and linux/arm64
PASS: Redis index publishes linux/amd64 and linux/arm64
PASS: in-flight slow request completed while Compose delivered SIGTERM
PASS: API exited cleanly after the drain
MODULE 1 VERIFIED
```

The termination proof begins a bounded slow request and waits until the API has accepted it. Compose then delivers `SIGTERM` to PID 1. The API stops accepting new work, lets the in-flight request complete, records structured `drain_started` and `drain_complete` events, and exits with code zero within the grace period. That is evidence of graceful shutdown under load.

[`docker stop`](https://docs.docker.com/reference/cli/docker/container/stop/) first sends the configured stop signal. If the process outlives the grace period, Docker sends `SIGKILL`, which cannot be caught; cleanup code will not run. “The container eventually stopped” is therefore weaker evidence than a completed request, zero in-flight work, a shutdown log, and exit code zero.

**Optional depth — multi-platform images.** The Open Container Initiative, or **OCI**, defines an [image index](https://github.com/opencontainers/image-spec/blob/v1.1.1/image-index.md): a document whose descriptors point to separate platform manifests. A multi-platform tag can therefore offer `linux/arm64` to Apple Silicon and `linux/amd64` to x86-64 Linux.

A tag is a mutable registry name. A digest is a hash-derived content identity. An index digest fixes the entire index; a platform-manifest digest fixes one platform variant. The verifier inspects the pinned Python and Redis indexes and confirms that both required descriptors exist. It does not try to make an amd64 binary fail on arm64, because Docker Desktop may emulate foreign architectures. Metadata is the deterministic proof here.

## Complete the assignment and know the proof's limits

This lab proves a runtime contract inside one Docker Desktop environment. It does not prove production security or availability. Everything runs on one Mac; Redis is one copy without a production storage plan; and the host connection has no encrypted web traffic, login, request limit, or network access rule. Compose does not move work to another machine, keep spare copies, or update a service without downtime.

A production pipeline should also scan for known vulnerable software, record where the image came from, list the software inside it, verify signatures, restrict kernel actions, and test data recovery. Continuous integration (CI)—automatic checks run for each code change—should build and test the `linux/amd64` and `linux/arm64` variants on matching computers, then release a fixed digest instead of a tag that can move. Docker's [multi-platform build guide](https://docs.docker.com/build/building/multi-platform/) describes that shape.

Your assignment starts at `labs/kubernetes/modules/01-process-to-container/assignment/Dockerfile.insecure`. Improve that deliberately poor file, compare it with the runnable lab Dockerfile, and submit the generated evidence bundle plus a short explanation of each change. Do not optimize for line count or add an empty build stage. Make the runtime promises verifiable by another person.

| Evidence                | Points | Full-credit standard                                                                                                               |
| ----------------------- | -----: | ---------------------------------------------------------------------------------------------------------------------------------- |
| Build and size          |      2 | Reproducible build; measured final size and layer changes are explained honestly against the supplied baseline                     |
| Identity and filesystem |      2 | Effective UID and GID are non-root; only declared paths are writable                                                               |
| Platform metadata       |      2 | OCI index evidence identifies both `linux/amd64` and `linux/arm64` manifests and distinguishes their digests from the index digest |
| Health and dependency   |      2 | Published health endpoint works and a Redis-backed counter increases                                                               |
| Termination             |      2 | An accepted slow request completes after `SIGTERM`, shutdown is logged, and the process exits within the grace period              |

A screenshot is not enough for changing runtime claims. Prefer command output, structured evidence, byte sizes, digests, exit codes, and timestamps. Full credit requires all five properties; a tiny image that runs as root or drops an in-flight request is not hardened.

## Clean up and retrieve the model

Remove only this Compose project and its project network:

```bash
make -C labs/kubernetes module-01-down
```

Expected final output:

```bash
MODULE 1 STACK REMOVED
```

The target does not prune unrelated images, volumes, networks, or Docker Desktop data. To repeat the fault, begin again with `module-01-up`; it recreates the same declared state.

Close the terminal and answer from memory:

1. Which mechanism limits memory, and which changes the view of PIDs or network interfaces?
2. Why can an in-container loopback health check pass while the published host port fails?
3. What does an OCI image index digest identify, and how does it differ from a platform-manifest digest?
4. After `SIGTERM`, what evidence distinguishes a graceful drain from a process that was eventually killed?

Then diagnose this artifact without running it:

```yaml
services:
  api:
    environment:
      WORKBENCH_BIND_HOST: 127.0.0.1
      REDIS_HOST: localhost
    ports:
      - "127.0.0.1:18080:8080"
```

There are two loopback mistakes. Name the network namespace each `localhost` refers to, predict which paths fail, and propose the smallest repair.

**Takeaway:** an image packages files and defaults; a container is the process created from that image under an explicit boundary and runtime contract.
