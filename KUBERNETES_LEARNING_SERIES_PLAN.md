# Kubernetes from first principles to distributed inference

Curriculum, lab, and editorial plan

Research checked: 2026-08-15

## Executive recommendation

Build this as a 27-module learning path in four seasons. Each module is one
publishable article plus one runnable lab, not a chapter full of disconnected
Kubernetes nouns.

- **Season 1 — Why the platform exists (Modules 0–6):** processes, containers,
  orchestration, the API, Pods, workload controllers, configuration, and
  workload identity.
- **Season 2 — How applications actually run (Modules 7–10):** service
  discovery, packet flow, Gateway API, network policy, storage, resources, and
  scheduling.
- **Season 3 — How applications survive production (Modules 11–17):**
  security, observability, delivery, reliability, autoscaling, incident
  response, distributed-application correctness, and operators.
- **Season 4 — How inference changes the system (Modules 18–26):** inference
  request anatomy, model artifacts, accelerators, serving frameworks, batching,
  distributed inference, model-aware routing, nested autoscaling loops,
  inference operations, and two capstones.

The common path is Modules 0–16. Module 17 is required for platform developers
and strongly recommended before KServe. Software developers can then complete
the software capstone; AI developers continue through Modules 18–25 and complete
the inference capstone.

Use five visibly different effort classes:

- article reading: normally 12–18 minutes;
- required guided lab: normally 30–60 minutes; the explicitly labeled
  multi-session labs run 75–180 minutes;
- optional per-module portfolio assignment: 45–120 minutes;
- required route checkpoint: 60–120 minutes, except the Module 25 game day;
- final capstone: realistically 20–40 hours for the listed evidence.

Publish route-specific totals rather than one misleading number:

| Route | Guided path with checkpoints/capstone | With most portfolio assignments/electives |
|---|---:|---:|
| Shared core, Modules 0–16 | 22–40 hours | 35–75 hours |
| Software route plus Capstone A | 45–85 hours | 60–120 hours |
| AI route plus Capstone B | 60–110 hours | 85–165 hours |
| Platform route, both capstones and heavy/GPU electives | 95–170+ hours | self-paced |

Module 25's game day is 2–3 hours. Times are planning ranges to remeasure in
the pilot, not promises that a failure lab will finish on a schedule.

The series should not be a certification cram guide. Its promise is:

> By the end, a reader can deploy, secure, observe, debug, scale, and explain a
> multi-service application on Kubernetes, and can design a credible path from
> a local CPU inference service to a topology-aware distributed GPU deployment.

## The teaching thesis

The two supplied references use the right structure for this subject.

1. Recreate the manual or older infrastructure pattern.
2. Make its operational cost and failure mode visible.
3. Introduce the Kubernetes primitive that automates that work.
4. Observe the controller through spec, status, conditions, events, and watches.
5. Break the system deliberately.
6. Repair it from evidence.
7. State what Kubernetes still does not solve.

The iximiuz article moves from one container to sidecars, replicas, a load
balancer, recovery, and rollouts before mapping those needs to Pods,
Deployments, and Services. The PlanetScale article lets the reader invent an
idempotent watchdog around Postgres before naming reconciliation, then expands
that loop into stores, watches, queues, caches, retries, spec, and status.

That structure fits the site's recent voice: begin with one load-bearing
observation or failure, derive the architecture from it, and finish with a
durable mental model. Do not begin an article with “A ConfigMap is…” or “A
Service is…”. Begin with stale configuration or disappearing backend IPs.

Every module uses this loop:

```text
Predict -> Deploy -> Observe -> Break -> Explain -> Repair -> Prove -> Clean up
```

The assessment tests causal reasoning, not YAML recall. A successful answer
includes the condition, event, log line, metric, trace, or packet observation
that supports the diagnosis.

## Audience and routes

### Shared core

Everyone completes Modules 0–16. This gives both software and AI developers the
same vocabulary for lifecycle, networking, state, identity, resources,
telemetry, delivery, scaling, and failure.

### Software developer route

Complete Modules 0–16, optionally Module 17, then Capstone A in Module 26.
Emphasize API contracts, queues, data migrations, graceful shutdown, release
safety, SLOs, and incident response.

### AI developer route

Complete Modules 0–17 and 18–25, then Capstone B in Module 26. Emphasize model
artifacts, cold starts, batching, KV cache, accelerators, topology, routing,
goodput, and cost per useful token.

### Platform developer route

Complete the full sequence. Add the optional controller implementation, GPU
cluster, Kueue, and production GitOps extensions.

Use two recurring sidebars without splitting the main explanation:

- **Software developer lens:** lifecycle, API behavior, release, data, and
  user-visible reliability.
- **AI developer lens:** model shape, memory, batching, parallelism, latency,
  quality, and accelerator economics.

## Scope and explicit non-goals

The required path covers application operation on Kubernetes. It does not:

- build a production control plane from scratch;
- make a Mac pretend to be a GPU Kubernetes node;
- teach every CNI, CSI, service mesh, GitOps engine, or cloud provider;
- treat a StatefulSet as a database high-availability solution;
- promise that Kubernetes gives an application consensus, transactions, or
  exactly-once processing;
- cover distributed model training in depth;
- use alpha built-in Kubernetes APIs in mandatory labs; a mature, required
  ecosystem project whose served CRD version still says `v1alpha1` must be
  pinned, labeled `VERSION-SENSITIVE`, and covered by a compatibility test;
- teach retired Ingress NGINX as the default ingress implementation.

Ingress remains useful legacy vocabulary, but Gateway API is the primary
north–south API. Ingress NGINX was retired in March 2026. Service mesh,
multi-cluster, native workload-aware scheduling, and scale-to-zero for large
models are decision-oriented extensions, not defaults.

## Canonical local environment

### Required tools

- macOS on Apple Silicon or Intel;
- 16 GB host RAM for the required core path;
- Docker Desktop;
- the kind CLI;
- kubectl;
- curl;
- jq;
- git and `make` (with direct script entry points if Command Line Tools are not
  installed);
- Helm only from the first module that needs it.

Run certificate generation, packet tools, Trivy, cosign, and benchmark/report
utilities from pinned multi-architecture course images where practical. If a
host binary is required, the module declares its exact version and installs it
at first use; do not silently depend on macOS's Bash or LibreSSL behavior.

Use kind on Docker Desktop as the canonical cluster manager. kind runs Linux
Kubernetes nodes as Docker containers, supports disposable multi-node clusters,
allows pinned Kubernetes node images, and can run the same lab in CI. Docker
Desktop's built-in Kubernetes is an optional quick-start, not the reference
path.

Publish three cluster profiles:

```text
core       1 control-plane + 1 worker
networked  1 control-plane + 2 workers + policy-capable CNI
inference  1 control-plane + 3 lightweight workers + policy-capable CNI
```

The control-plane remains tainted in all profiles and is never counted as
application capacity. The networked profile also supplies the two schedulable
workers needed by Modules 10 and 14. The inference profile is used only when
Module 23 needs three distinct worker identities. Use `kubectl drain`, `docker
pause`, or `docker stop` for controlled node experiments; do not teach live
kind node removal and re-add as though it were a normal cluster operation.

The networked and inference profiles disable kind's default CNI and install one
pinned, policy-capable implementation. Calico has a current official
kind/Docker Desktop quickstart and is a good default for the course. Teach the
portable Kubernetes NetworkPolicy API in the article; keep
implementation-specific policy features in an extension.

Use a pinned Envoy Gateway release as the course's reference Gateway API
implementation. On macOS, reach its data-plane Service through a deterministic
port-forward in the required lab; do not assume the Docker bridge or a
`LoadBalancer` address is directly routable from the host. MetalLB,
cloud-provider-kind, and real cloud load balancers belong in clearly labeled
extensions. Teach portable Gateway API resources first and keep Envoy-specific
policy in optional sections.

Publish named, independently bootstrappable environment bundles:

| Bundle | Cluster profile | Required add-ons |
|---|---|---|
| `core` | core | pinned local-path provisioner and StorageClass |
| `app-networked` | networked | core storage add-on, Calico, Envoy Gateway |
| `observed-app` | networked | app-networked plus Metrics Server, Prometheus, OTel Collector, Jaeger, Grafana |
| `inference-system` | inference | observed-app equivalents plus KEDA |

Checkpoint 2 uses `app-networked`; Checkpoints 3–4 use `observed-app`;
Module 23 uses the inference cluster with core storage only; Module 24's guided
lab uses `observed-app` and Checkpoint 7 switches to `inference-system`;
Checkpoint 8 in Module 25 and the inference capstone use `inference-system`. A lab never asks
the reader to guess which prior add-ons happen to remain installed.

### Honest Mac boundary

Docker Desktop runs Linux containers inside a Linux VM. macOS is not a
Kubernetes node. Linux namespace, interface, routing, iptables, and conntrack
inspection therefore happens inside a kind node or debug container, not in the
macOS host shell.

Docker Desktop's documented local GPU container support is Windows/WSL2-only.
Required inference labs must be CPU-based. Real NVIDIA device-plugin, DRA,
vLLM, Triton, multi-GPU, NCCL, RDMA, and MIG labs are optional remote-cluster
extensions.

All kind nodes also share one Docker Desktop VM and one physical laptop.
Multi-node labs can prove scheduling, topology constraints, controller
behavior, and simulated node loss; they cannot prove independent hardware,
zone, network, or power failure.

### Resource profiles

Cluster topology and laptop budget are orthogonal. Every lab declares a cluster
profile, a resource tier, and required add-ons before the first command:

| Resource tier | Expected environment |
|---|---|
| `LOCAL-CORE` | 4 CPU, 8 GB Docker memory; required; 16 GB host minimum |
| `LOCAL-HEAVY` | 6–8 CPU, 10–12 GB Docker memory; required for Module 23, Checkpoints 7–8, and both capstones, optional elsewhere; 24 GB host recommended or use a remote cluster |

Orthogonal execution/status labels:

| Label | Meaning |
|---|---|
| `GPU-CLOUD` | Linux NVIDIA node or remote cluster |
| `PRODUCTION-ONLY` | architecture or operations exercise |
| `VERSION-SENSITIVE` | exact API/CRD versions and feature gates are pinned |
| `ARCH-GATED` | optional component runs only on CPU architectures it publishes |

Also display tested CPU architecture, Kubernetes version, component versions,
last verification date, and expected runtime.

### Reproducibility contract

- Pin the kind release, Kubernetes node image, add-on versions, and application
  image digests in a version file.
- Never use the `latest` tag.
- Publish every course-owned image for linux/arm64 and linux/amd64.
- Declare the upstream image architecture matrix for every optional ecosystem
  lab; skip unsupported Apple Silicon or Intel paths explicitly rather than
  relying on slow, invisible emulation.
- Use kubectl wait and assertions, not arbitrary sleep calls.
- Give every lab preflight, verification, reset, and cleanup commands.
- Reset a namespace when possible; rebuild the cluster only for CNI,
  feature-gate, or control-plane labs.
- Run required labs in CI on every lab-repository change.
- Retest stable modules at least twice a year and version-sensitive AI modules
  quarterly.

## The evolving reference application

Use one small application for the entire series. Working name: **Workbench**.

```text
browser/client
      |
   gateway
      |
     API ------> PostgreSQL
      |
    Redis queue
      |
    workers ----> processor / model server

all components ----> logs, metrics, traces
load generator ----> gateway/API
```

The app processes a submitted text document. Early workers perform a
deterministic transform such as hashing, counting, or extracting metadata. In
the AI season the processor can be replaced with an inference simulator or an
optional tiny real model. The contract stays the same, so the course does not
fork into two unrelated applications.

Implementation guidance:

- FastAPI for the API, worker, and simulator; a tiny static HTML/JavaScript
  client;
- Redis Streams consumer groups for explicit at-least-once behavior:
  `XREADGROUP`, pending-entry inspection, `XACK`, idle-message reclaim, bounded
  delivery attempts, and a dead-letter stream;
- stable job IDs plus a PostgreSQL uniqueness constraint/idempotency record at
  the externally visible commit boundary;
- PostgreSQL for state, migrations, backup, and restore;
- a load generator with open-loop and closed-loop modes;
- OpenTelemetry propagation and Prometheus-format metrics;
- feature flags for deterministic fault injection;
- minimal code so infrastructure, not framework ceremony, remains the lesson.

The course-owned inference simulator is essential. It should expose a
documented, minimal OpenAI-style JSON/SSE subset (without claiming complete API
compatibility), build on ARM64 and AMD64, and simulate:

- model-load and warmup delay;
- queue capacity and admission rejection;
- prefill and per-token decode delay;
- dynamic batching;
- cache hits and misses;
- slow, failed, and disappearing workers;
- shard coordination;
- TTFT, TPOT, queue depth, running requests, output tokens, batch size, cache
  hit, and load-duration metrics.

It models serving-system behavior, not GPU performance. Every article must say
that plainly.

### Application evolution by module

| Modules | Workbench state added or changed |
|---:|---|
| 0–1 | API plus Redis on a Docker bridge; container contract established |
| 2–5 | API moved to Pods/Deployment; finite document Job added |
| 6 | configuration, scoped credential fixture, and ServiceAccount |
| 7 | processor Service and stable discovery |
| 8 | Envoy Gateway, TLS, canary route, and default-deny policy |
| 9–10 | PostgreSQL, persistent records, asynchronous workers, resources, placement |
| 11–15 | hardening, immutable delivery, telemetry, SLO, rollout, scale, incident drills |
| 16 | Redis Streams acknowledgement/reclaim, idempotency record, dead-letter flow |
| 17 | optional `DocumentRun` API/controller around the finite workflow |
| 18–19 | processor replaced by CPU inference simulator and versioned model artifact |
| 20–25 | simulated devices/topology, serving-layer choices, batching, shard groups, routing/scaling, game day |

Every module's opening diagram grays out future components and highlights only
the new boundary. A lab never assumes a service that has not appeared in this
table.

## Companion lab repository

Keep full manifests and application source outside article bodies in a
dedicated repository:

```text
kubernetes-workbench/
  versions.env
  Makefile
  scripts/
    preflight.sh
    collect-evidence.sh
  app/
  cluster/
    core/
    networked/
  modules/
    00-lab/
    01-containers/
    ...
    26-capstone/
```

Each module folder contains:

```text
README.md
starter/
solution/
manifests/
scripts/
tests/
evidence.example/
```

Standard targets:

```text
make preflight
make up
make verify
make break-<scenario>
make reset
make evidence
make down
```

The article shows only the 10–30 lines needed for the current idea, preferably
as a focused YAML or code diff. The lab repository carries complete pinned
files and automated assertions.

## Article contract

Treat this as an authoring and QA checklist, not fourteen mandatory visible
headings. A finished article should normally keep the site's essay rhythm with
roughly six to nine H2 sections. “Predict → build → observe → break → repair”
usually reads as one narrative lab passage; semantic components carry setup,
proof, version, and production-delta metadata.

1. **The operational question** — one sentence.
2. **What you need first** — prerequisites, lab label, resources, tested
   versions, time.
3. **Before Kubernetes** — the manual mechanism or familiar developer problem.
4. **The mental model** — one small diagram.
5. **The mechanism** — object relationships and control/data paths.
6. **Predict** — ask what the reader expects before a mutation.
7. **Build it** — focused commands and manifest fragments.
8. **Observe it** — status, conditions, events, logs, packets, metrics, or
   traces.
9. **Break it** — one deliberate failure.
10. **Repair and prove** — an automated assertion, not “looks healthy.”
11. **Production delta** — what the local lab omits.
12. **Assignment** — an artifact with a rubric.
13. **Cleanup** — deterministic and safe.
14. **One-sentence takeaway** — the durable mental model.

Content rules:

- Practice at most three new Kubernetes kinds in one module. Additional kinds
  may appear only as labeled previews and must receive their own later lab.
- Show relationships before full YAML.
- Reveal manifests in semantic slices: identity, selection, lifecycle,
  resources, security.
- Put expected output immediately after important commands.
- Use “what changed in the cluster?” after every mutation.
- Mark ecosystem-provided, stable, beta, alpha, deprecated, and retired
  features.
- Use stable built-in Kubernetes APIs in the required path. For a mature
  ecosystem dependency whose served CRD is still named `v1alpha1`, explain that
  the version string is not a Kubernetes-wide maturity guarantee, pin the
  implementation, label it `VERSION-SENSITIVE`, and run an upgrade/compatibility
  smoke test.
- Put version-sensitive internals in a visibly dated section.
- End with two to four retrieval or prediction prompts and one broken artifact
  only when it serves the concept; keep larger practice sets in the lab
  repository or course hub.

## Roadmap at a glance

| Module | Title | Primary outcome |
|---:|---|---|
| 0 | Orientation and the disposable lab | Recreate and inspect a pinned local cluster |
| 1 | From process to container | Build a portable, correctly terminating image |
| 2 | Why Kubernetes: feedback loops | Explain desired state and observed convergence |
| 3 | The Kubernetes API and kubectl | Read and repair unfamiliar API objects |
| 4 | Pods and multi-container design | Choose correct Pod boundaries and lifecycle |
| 5 | Workload controllers | Operate Deployments and finite Jobs; preview the controller choice tree |
| 6 | Configuration, Secrets, and identity | Separate config, confidential data, and workload credentials |
| 7 | Service discovery and packet flow | Trace and debug Pod-to-Service traffic |
| 8 | Gateway API and NetworkPolicy | Expose and restrict an application deliberately |
| 9 | Storage and stateful systems | Persist, back up, restore, and explain state |
| 10 | Resources and scheduling | Predict placement, throttling, OOM, and eviction |
| 11 | Security from image to API | Enforce least privilege and Restricted Pod Security |
| 12 | Observability and SLOs | Correlate objects, events, logs, metrics, and traces |
| 13 | Packaging, CI/CD, and GitOps | Deliver immutable artifacts and detect drift |
| 14 | Reliability, disruption, and autoscaling | Survive rollout, overload, and node disruption |
| 15 | Systematic debugging | Diagnose layered failures and write a postmortem |
| 16 | Distributed application patterns | Make retries, queues, workers, and coordination safe |
| 17 | CRDs, controllers, and operators | Understand and design a robust reconcile loop |
| 18 | Inference is a service | Define the serving request path and inference SLOs |
| 19 | Model-serving containers and artifacts | Make loading, caching, streaming, and drain explicit |
| 20 | Accelerators and topology-aware scheduling | Map device needs to scheduling and DRA |
| 21 | Serving frameworks without logo soup | Select raw Kubernetes, KServe, Ray, vLLM, or Triton |
| 22 | Batching, KV cache, and performance | Measure the latency-throughput frontier |
| 23 | Distributed inference and group scheduling | Design sharded, coordinated serving groups |
| 24 | Model-aware routing and nested autoscaling | Route and scale from the right signals and timescales |
| 25 | Inference operations, security, and cost | Run game days and measure useful-token economics |
| 26 | Capstones and the production bridge | Prove a complete system and name every production gap |

## Season 1 — Why the platform exists

### Module 0 — Orientation and the disposable lab

**Question:** Where is Kubernetes actually running when the laptop is a Mac?

**Learning objectives**

- Decide whether Kubernetes is appropriate for a workload.
- Distinguish the macOS host, Docker Desktop VM, kind node containers, cluster,
  context, and namespace.
- Create, inspect, reset, and remove a version-pinned cluster safely.

**Sections and subsections**

1. What Kubernetes solves
   - process supervision versus orchestration;
   - managed application platforms versus raw Kubernetes;
   - application-owner and platform-owner responsibilities;
   - cases where Compose, a PaaS, or a managed inference API is simpler.
2. The local stack
   - Docker Desktop's Linux VM;
   - kind nodes as Docker containers;
   - control-plane and worker roles;
   - kubeconfig, context, cluster, user, and namespace.
3. Tool literacy
   - docker, kind, and kubectl version checks;
   - kubectl API compatibility;
   - `cluster-info`, `get nodes`, and control-plane Pods;
   - avoiding aliases until the underlying command is understood.
4. Lab hygiene
   - resource budget and architecture preflight;
   - idempotent setup;
   - evidence collection;
   - namespace reset versus cluster rebuild.

**LOCAL-CORE lab**

- Run the preflight script on Intel or Apple Silicon.
- Create the core cluster from the pinned config.
- Find the kind node containers with Docker.
- Inspect cluster versions, contexts, nodes, control-plane Pods, DNS, and
  StorageClass.
- delete and recreate the cluster; prove that the same bootstrap reaches the
  same assertions.

**Assignment**

Submit a machine-readable preflight report and a one-page layer diagram from
terminal to application process. Label where the Linux kernel, container
runtime, kubelet, API server, and kubectl live.

**Misconception to break:** Docker Desktop, the Kubernetes cluster, and macOS
are not one operating environment.

---

### Module 1 — From process to container

**Question:** What does a container add to an ordinary application process?

**Learning objectives**

- Explain images, containers, namespaces, cgroups, and the writable layer
  without calling a container a tiny VM.
- Build small multi-architecture images that run as non-root and terminate
  gracefully.
- Connect the first two services with Docker networking before Kubernetes hides
  the plumbing.

**Sections and subsections**

1. Process, VM, and container
   - process tree and PID 1;
   - namespaces and cgroups at an intuitive level;
   - root filesystem and image layers;
   - isolation limits and the shared kernel.
2. Building images
   - Dockerfile lifecycle and build context;
   - multi-stage builds and cache;
   - non-root runtime user;
   - Apple Silicon, Intel, and multi-platform manifests;
   - mutable tags versus immutable digests.
3. Runtime contract
   - command and arguments;
   - listening on all interfaces;
   - signals, graceful shutdown, and exit codes;
   - stdout/stderr;
   - environment, files, ports, mounts, and resource constraints.
4. Networking and Compose baseline
   - user-defined bridge and container DNS;
   - listening port, `EXPOSE`, and published port;
   - API plus Redis;
   - dependency start order is not application readiness;
   - what Compose gives and what it does not.

**LOCAL-CORE lab**

- Build the Workbench API image.
- Run the API and Redis on a Docker bridge.
- Inspect their processes, interfaces, DNS, mounts, logs, and limits.
- Send traffic while delivering SIGTERM and measure graceful drain.
- Break the system with a loopback-only bind address. Inspect a supplied OCI
  index and prove which ARM64/AMD64 manifests exist; do not depend on
  Docker Desktop's best-effort cross-architecture emulation as a failure.

**Assignment**

Harden a deliberately poor Dockerfile. Prove smaller image size,
non-root execution, correct ARM64/AMD64 metadata, a working health endpoint,
and graceful termination under load.

**Misconceptions to break:** `EXPOSE` does not publish a port; stopping a
container is not automatically graceful; a container is not a VM security
boundary.

---

### Module 2 — Why Kubernetes: desired state and feedback loops

**Question:** Which repetitive operations turn a set of containers into a
platform?

**Learning objectives**

- Derive reconciliation from a manual watchdog.
- Trace the request from declared intent to a running container.
- Explain eventual convergence and the limits of “self-healing.”

**Sections and subsections**

1. Run it by hand
   - choose a host;
   - keep a process running;
   - maintain three replicas;
   - discover changing endpoints;
   - update a load balancer;
   - replace a version without dropping traffic.
2. Invent the controller
   - desired and observed state;
   - compare, act, repeat;
   - idempotency and retry;
   - closed-loop versus open-loop control;
   - edge notifications with level-based decisions.
3. Kubernetes architecture
   - API server and etcd;
   - scheduler and binding;
   - controller manager;
   - kubelet, container runtime, and runtime interface;
   - network and storage implementations.
4. Object anatomy
   - metadata, spec, status, and conditions;
   - records of intent;
   - asynchronous ownership;
   - why applying YAML does not synchronously execute it.
5. What the platform cannot infer
   - business correctness;
   - safe retries and idempotency;
   - application data consistency;
   - meaningful health;
   - capacity that does not exist.

**LOCAL-CORE lab**

- Deploy three API replicas.
- Watch Deployment, ReplicaSet, Pod, and events in parallel.
- Delete one Pod and record each controller-visible transition.
- set an invalid image, compare spec and status, and repair it.
- Record the node and Pod capacity assumptions that make replacement possible;
  defer a real worker-stop exercise until the topology profile.

**Assignment**

Draw the complete write path from `kubectl apply` to a running process. Name the
component that owns validation, persistence, placement, Pod count, and
container creation. Attach watch output as evidence.

**One-sentence takeaway:** Kubernetes stores intent; cooperating controllers
continuously move reality toward it.

---

### Module 3 — The Kubernetes API and kubectl literacy

**Question:** How can a developer understand an unfamiliar Kubernetes object
without copying a random manifest?

**Learning objectives**

- Read Kubernetes resource identity and scope.
- Discover and validate schemas from the API.
- Use declarative operations safely and query the raw evidence behind kubectl.

**Sections and subsections**

1. API identity
   - group, version, kind, resource, name, and namespace;
   - names versus UIDs;
   - namespaced versus cluster-scoped resources;
   - stable, beta, alpha, and removed versions.
2. Change and concurrency
   - generation and observed generation;
   - resourceVersion;
   - status conditions;
   - optimistic concurrency;
   - list and watch.
3. Metadata as behavior
   - labels and selectors;
   - annotations;
   - recommended application labels;
   - owner references and garbage collection;
   - deletion timestamps and finalizers.
4. Command workflow
   - `api-resources` and `api-versions`;
   - `explain`;
   - `get`, `describe`, and sorted events;
   - YAML, JSONPath, and custom columns;
   - server-side dry-run;
   - `diff` and `apply`;
   - raw API requests.
5. Imperative and declarative work
   - imperative commands for exploration;
   - manifests as the durable source;
   - why accidental live edits and mixed field ownership hurt;
   - safe deletion and why force is exceptional.

**LOCAL-CORE lab**

- Construct a manifest using API discovery and `kubectl explain`.
- Validate it with server-side dry-run before creating it.
- Query the same resource through normal output and the raw API.
- Select objects by label and follow owner references to Pods.
- Inspect supplied `deletionTimestamp`, owner-reference, and finalizer examples
  read-only. Defer the hands-on, controller-owned finalizer and deterministic
  cleanup lab to Module 17.

**Assignment**

Repair a directory containing a removed API version, unknown field, immutable
selector change, namespace mistake, and label mismatch. For each repair, cite
the API discovery or validation evidence.

**Misconceptions to break:** annotations do not select objects; `apply` does
not mean restart; a stuck finalizer is not an invitation to delete safeguards
without understanding cleanup.

---

### Module 4 — Pods and multi-container design

**Question:** Which processes belong in one Pod, and which only happen to be
part of the same application?

**Learning objectives**

- Treat the Pod as a scheduling, isolation, networking, storage, and lifecycle
  unit.
- Choose init containers, native sidecars, and ephemeral debug containers
  intentionally.
- Design startup, readiness, liveness, and termination behavior.

**Sections and subsections**

1. Why the Pod exists
   - one scheduling decision and one fate;
   - shared network namespace and localhost;
   - shared volumes;
   - container isolation inside a Pod;
   - ephemeral identity.
2. Lifecycle
   - Pending, Running, Succeeded, and Failed phases;
   - waiting, running, and terminated container states;
   - restart policy and crash backoff;
   - deletion, SIGTERM, grace period, and SIGKILL;
   - why a replaced Pod is a new object.
3. Container roles
   - main application container;
   - regular init container;
   - native sidecar lifecycle;
   - adapter and ambassador patterns;
   - ephemeral debug container.
4. Health semantics
   - startup probe for slow initialization;
   - readiness as traffic eligibility;
   - liveness as a narrow restart signal;
   - self-health versus downstream dependency health;
   - cascading restart failures.
5. Boundary decision
   - shared lifecycle, scale, security, deployment ownership, and data;
   - why client, API, Redis, database, and worker are separate Pods;
   - when a local proxy or telemetry adapter belongs beside the app.

**LOCAL-CORE lab**

- Run an API Pod with a regular init container, a native metrics sidecar
  expressed as a restartable init container, and `emptyDir`.
- Prove localhost and shared-volume behavior.
- Create a slow startup loop with the wrong liveness probe, then repair it with
  startup and readiness probes.
- Add an ephemeral debug container to a minimal image.
- Delete the Pod during a request and inspect native-sidecar termination after
  the main container. Contrast this with ordinary co-containers, whose TERM
  delivery order is not guaranteed.

**Assignment**

Convert the Compose topology into a proposed Pod topology. Defend every
colocation or separation choice using lifecycle, scaling, security, ownership,
and failure-domain evidence.

**Misconceptions to break:** one Pod is not one container, a Pod is not a
durable machine, and liveness should not restart an app merely because its
database is slow.

---

### Module 5 — Workload controllers

**Question:** What behavior should own a set of Pods?

**Learning objectives**

- Choose Deployment or Job from application behavior.
- Observe and control a rollout and rollback.
- Recognize stateful identity, node-local agents, finite work, and schedules,
  while deferring their full labs to the required networking, storage, and
  scheduling modules.

**Sections and subsections**

1. Deployment and ReplicaSet
   - Pod templates and immutable selectors;
   - replica ownership;
   - rollout revisions;
   - maxSurge and maxUnavailable preview;
   - pause, resume, rollback, and rollout status.
2. Job
   - completion, retries, and idempotency;
   - backoff, success/failure policy, and TTL cleanup;
   - a retried Job can repeat a side effect.
3. CronJob extension
   - schedule and starting deadline;
   - concurrency policy;
   - missed and duplicate work;
   - application-level idempotency.
4. Controller selection preview
   - long-running interchangeable replicas;
   - finite task;
   - scheduled task.
   - StatefulSet and headless discovery deferred to Modules 7 and 9;
   - DaemonSet and node eligibility deferred to Module 10;
   - database migration deferred to Modules 9 and 13.

**LOCAL-CORE lab**

- Roll Workbench API v1 to v2 and roll back an injected bad release.
- Run a finite document-processing Job, inject a failure, and inspect retry,
  completion, and owner evidence.
- Optional: schedule a cleanup CronJob, then demonstrate why overlapping or
  repeated executions require application idempotency.

**Checkpoint 1**

Containerize and deploy a small service with probes, a Deployment, controlled
rollout, rollback evidence, and a one-off Job. Explain its complete owner chain
from Deployment to container.

**Misconceptions to break:** a Deployment owns Pods through ReplicaSets rather
than directly; Job retry does not make a side effect idempotent; StatefulSet
and DaemonSet names are not enough to teach their networking, storage, and
placement contracts.

---

### Module 6 — Configuration, Secrets, and workload identity

**Question:** How does an immutable image receive environment-specific
configuration and only the credentials it needs?

**Learning objectives**

- Separate code, non-secret configuration, confidential material, runtime
  metadata, and identity.
- Predict configuration propagation and restart behavior.
- Limit each workload and container to the data and API access it needs.

**Sections and subsections**

1. Application configuration contract
   - defaults and required values;
   - validation and fail-fast behavior;
   - environment-specific values;
   - reload versus restart.
2. ConfigMaps
   - environment variables, arguments, and mounted files;
   - update propagation;
   - subPath caveat;
   - immutable objects;
   - versioned names and rollout triggers.
3. Secrets
   - `data` and `stringData`;
   - base64 is encoding, not encryption;
   - volume versus environment exposure;
   - etcd encryption and external secret stores as production concerns;
   - rotation and never committing clear credentials.
4. Runtime metadata
   - Downward API;
   - Pod name, namespace, labels, and resource values;
   - config without API access.
5. ServiceAccounts
   - workload identity, not human identity;
   - projected short-lived tokens;
   - automatic token mounting;
   - one identity per responsibility;
   - cloud workload identity production bridge.
6. Multi-container least exposure
   - mounting a Secret into one container only;
   - sidecar trust;
   - configuration ownership and checksum annotations.

**LOCAL-CORE lab**

- Inject one value as an environment variable and another as a mounted file.
- Edit the ConfigMap and compare what changes without restarting.
- Mount a processor API credential only into the API container, not its metrics
  sidecar.
- Disable unnecessary service-account token mounting.
- Expose safe Pod metadata through the API.
- Rotate config and perform a controlled rollout.

**Assignment**

Diagnose a stale-configuration incident and redesign the Pod so an unrelated
sidecar cannot read the processor credential. Include the before/after process
environment, mounts, and rollout evidence.

**Misconceptions to break:** base64 does not secure a Secret, a ConfigMap edit
does not automatically restart Pods, and ServiceAccounts are not human users.

---

## Season 2 — How applications actually run

### Module 7 — Service discovery and packet flow

**Question:** How does a client reach interchangeable Pods whose addresses keep
changing?

**Learning objectives**

- Follow a connection from client Pod to ready backend.
- Distinguish Pod networking, discovery state, and Service data plane.
- Debug DNS, Service, EndpointSlice, Pod, port, and process layers in order.

**Sections and subsections**

1. Minimum networking refresher
   - interface, IP, route, port, socket, and DNS;
   - L3, L4, and L7 in practical terms;
   - NAT and connection tracking;
   - timeout and connection reuse.
2. Kubernetes network model
   - one network namespace per Pod;
   - container-to-container over localhost;
   - Pod-to-Pod across nodes;
   - node, Pod, and Service CIDRs;
   - CNI as a runtime boundary, not a built-in network.
3. Discovery control plane
   - labels and Service selectors;
   - EndpointSlice creation and readiness;
   - CoreDNS short and fully qualified names;
   - headless Services and direct member discovery.
4. Service data plane
   - ClusterIP virtual address;
   - kube-proxy or alternate implementation;
   - NodePort and LoadBalancer orientation;
   - traffic policy and topology preference;
   - Service is an API object, not a proxy process.
5. Port vocabulary
   - application listen port;
   - `containerPort` documents a port and supplies a name that Services, probes,
     and policies can reference, but does not open a socket or publish traffic;
   - Service port and targetPort;
   - host/node port;
   - bind address.
6. Client behavior
   - DNS caches and long-lived connections;
   - backend churn;
   - bounded timeouts and retries;
   - why a stable Service does not make the dependency reliable.

**LOCAL-CORE lab**

- Scale the API and call it from an in-cluster client.
- Resolve short and full DNS names.
- Watch EndpointSlices change with replica readiness.
- Inspect a connection from a course-pinned ARM64/AMD64 toolbox Pod and from
  inside a kind node; do not assume the node image contains packet tools.
- Break the selector, target port, bind address, readiness, and DNS name one at
  a time; repair each with the debugging ladder.

**Assignment**

Diagnose a request failure with cluster read access. Record a hypothesis before
each command, do not edit until the failing layer is named, and prove the fix
with an automated request assertion.

**Misconceptions to break:** Service is not an application process,
`containerPort` does not make a process listen or expose it outside the Pod,
and Pod IPs are not durable config.

---

### Module 8 — Gateway API and NetworkPolicy

**Question:** How should traffic enter the cluster, and which internal
connections should be possible at all?

**Learning objectives**

- Separate local tunnels, L4 exposure, and L7 routing.
- Use the current Gateway API ownership model.
- Build default-deny connectivity safely on an enforcing CNI.

**Sections and subsections**

1. Exposure choices
   - port-forward as a development tunnel;
   - NodePort;
   - LoadBalancer and cloud integration;
   - Ingress history and frozen API;
   - why a resource still needs a controller/data plane.
2. Gateway API
   - GatewayClass as infrastructure implementation;
   - Gateway listeners and ownership;
   - HTTPRoute and GRPCRoute;
   - host, path, header, redirect, rewrite, and TLS;
   - cross-namespace attachment and ReferenceGrant;
   - weighted traffic splitting.
3. 2026 direction
   - Gateway API as the primary teaching path;
   - Ingress as legacy interoperability knowledge;
   - retired Ingress NGINX must not be the course default.
4. NetworkPolicy mental model
   - default allow;
   - isolation begins when a policy selects a Pod;
   - ingress and egress independently;
   - additive allowed traffic, not ordered firewall rules;
   - Pod, namespace, port, and CIDR selectors;
   - portable policy is additive L3/L4 policy and does not select a Service or
     an arbitrary DNS/FQDN destination;
   - named-port and implementation behavior must be verified on the pinned CNI;
   - DNS egress;
   - CNI enforcement dependency.
5. Service mesh decision
   - identity, mTLS, L7 policy, telemetry, and traffic controls;
   - operational cost;
   - why it is an optional extension.

**LOCAL-CORE lab on the networked profile**

- Install the pinned Envoy Gateway controller and inspect its GatewayClass and
  generated data-plane Service.
- Reach the Gateway through the course port-forward and explain why this is a
  development tunnel rather than a production load balancer.
- Route `/api` and `/processor` to different Services.
- Route a header-selected canary and then verify a weighted split with a
  sufficiently large sample and documented tolerance; one SSE connection makes
  one routing choice, not one choice per event.
- Terminate TLS with a course-generated local certificate and verify the
  hostname; compare it with automated production certificate issuance.
- Verify a long-lived streaming response through configured timeouts.
- Apply namespace default-deny.
- Restore only DNS, client-to-Gateway, Gateway-data-plane-to-API, and
  API-to-processor flows. Observe and document how the pinned CNI treats
  node-originated probe traffic and any controller/webhook path needed by the
  chosen Gateway implementation.
- Prove permitted and denied connections.

**Assignment**

Produce a connectivity matrix from the architecture diagram, implement it with
portable Kubernetes NetworkPolicy, and attach positive and negative tests.

**Misconceptions to break:** creating a Gateway does not install a Gateway
controller; NetworkPolicy is not enforced by the API server; namespaces do not
block network traffic by themselves.

---

### Module 9 — Storage and stateful systems

**Question:** Which data should survive a container, a Pod, a node, or an entire
cluster failure?

**Learning objectives**

- Choose ephemeral, Pod-scoped, or persistent storage deliberately.
- Explain the PV, PVC, StorageClass, and CSI contract.
- Separate persistence, replication, backup, restore, and disaster recovery.

**Sections and subsections**

1. State inventory
   - image and writable layer;
   - `emptyDir`;
   - projected configuration;
   - model/cache scratch data;
   - durable application records.
2. Persistent storage contract
   - PersistentVolume and PersistentVolumeClaim;
   - StorageClass and dynamic provisioning;
   - binding and WaitForFirstConsumer;
   - access modes versus real storage capabilities;
   - capacity and expansion.
3. Lifecycle
   - reclaim policy;
   - deletion protection and finalizers;
   - StatefulSet claim retention;
   - local volume and node affinity;
   - snapshots as CSI-dependent resources.
4. StatefulSet storage and discovery
   - volumeClaimTemplates;
   - stable ordinal, DNS, and storage;
   - ordered lifecycle;
   - headless Service;
   - application-level replication remains separate.
5. Database decision
   - single instance for learning;
   - operator-managed database;
   - managed external database;
   - logical and physical backup;
   - explicit RPO and RTO.

**LOCAL-CORE lab**

- Run PostgreSQL with a PVC.
- Write data, delete the Pod, and prove persistence.
- Recreate the StatefulSet while retaining the claim.
- Inspect binding, node placement, reclaim, and finalizer behavior.
- Write a logical backup outside the database data PVC, intentionally destroy
  application data, and restore it. Prove deleting the data claim would not
  delete the only backup.
- Discuss why deleting the kind cluster still destroys the lab's storage.

**Assignment**

Classify every Workbench datum by required lifetime. Submit a tested
backup/restore procedure and state its RPO, RTO, single-node assumptions, and
production storage delta.

**Misconceptions to break:** a PVC is a claim, not the physical disk; a
persistent volume is not a backup; a StatefulSet is not consensus.

---

### Module 10 — Resource management, scheduling, and shared clusters

**Question:** Why is a Pod Pending, throttled, evicted, or killed even when the
cluster looks idle?

**Learning objectives**

- Predict placement from requests and node capacity.
- Distinguish CPU throttling, memory OOM, node pressure, and eviction.
- Express placement and shared-cluster safeguards without treating them as
  security boundaries.

**Sections and subsections**

1. Resource model
   - CPU, memory, and ephemeral storage;
   - requests and limits;
   - compressible versus incompressible resources;
   - units and common mistakes;
   - container-level accounting in the stable path;
   - Pod-level resource declarations as a pinned, `VERSION-SENSITIVE` extension
     because feature and resource-manager integration maturity differ.
2. Scheduler path
   - capacity and allocatable;
   - queue, filter, score, reserve, and bind;
   - request-based fit, not live-utilization placement;
   - scheduling events and Pending diagnosis.
3. Runtime outcomes
   - CPU cgroup throttling;
   - OOMKilled;
   - QoS classes;
   - node pressure;
   - eviction order and ephemeral storage.
4. Placement
   - node labels and nodeSelector;
   - required and preferred node affinity;
   - Pod affinity/anti-affinity;
   - topology spread;
   - taints and tolerations;
   - PriorityClass and preemption.
   - DaemonSet as the node-local workload pattern.
5. Shared-cluster safeguards
   - namespace scope;
   - LimitRange defaults and constraints;
   - ResourceQuota;
   - fair capacity is a policy, not automatic;
   - GPU and device preview.

**LOCAL-CORE lab on the networked profile**

- Label and taint two kind workers.
- Make a worker Pod unschedulable, diagnose its events, and repair placement.
- Trigger CPU throttling and memory OOM separately.
- Spread API replicas across worker nodes.
- Deploy a node-info DaemonSet and prove it runs once on every eligible worker.
- Apply LimitRange and ResourceQuota and observe admission failures.
- Drain and stop a designated stateless worker, then compare placement with and
  without topology rules.

**Checkpoint 2**

Deploy API, queue, workers, and database with justified requests, limits,
placement, storage, Services, Gateway route, and NetworkPolicy. Loss of a
designated stateless worker must preserve the request path without manual Pod
assignment. Loss of the single stateful node should produce the explicitly
predicted degraded condition and invoke the tested restore/recovery plan; this
local checkpoint does not claim database or queue high availability.

**Misconceptions to break:** limits do not reserve capacity, the scheduler does
not normally use current CPU usage, a toleration does not force placement, and
node labels are not a hard tenant security boundary.

---

## Season 3 — How applications survive production

### Module 11 — Security from image to API

**Question:** Which boundary actually stopped the attack, and which one merely
made the manifest look safer?

**Learning objectives**

- Trace a request through authentication, authorization, and admission.
- Apply least privilege to workloads, identities, images, and network paths.
- Explain why namespace and container isolation are useful but incomplete.

**Sections and subsections**

1. A layered threat model
   - source and dependency;
   - image and registry;
   - API and admission;
   - Pod and runtime;
   - node, network, data, and application;
   - trust boundaries for a shared cluster.
2. Kubernetes API access
   - TLS and credentials;
   - authentication versus authorization;
   - RBAC Roles, ClusterRoles, bindings, verbs, resources, and subresources;
   - `kubectl auth can-i`;
   - escalation through bind, impersonate, secrets, or workload creation;
   - admission and audit.
3. Application access boundary
   - end-user authentication and authorization are not Kubernetes RBAC;
   - tenant identity, object/job ownership, and request budgets;
   - Gateway authentication may establish identity, while the application
     still enforces domain authorization.
4. Workload identity
   - ServiceAccounts;
   - projected, rotating tokens;
   - disable automount when unused;
   - external workload identity as the production direction;
   - do not pass long-lived cloud keys through a Secret.
5. Pod hardening
   - Pod Security Standards and namespace admission labels;
   - pin enforce/warn/audit policy versions to the course Kubernetes minor
     rather than the moving `latest`;
   - `runAsNonRoot`, seccomp, dropped capabilities, read-only root filesystem,
     and `allowPrivilegeEscalation: false`;
   - privileged mode, host paths, host network, and host PID;
   - policy exceptions as reviewed, expiring decisions.
6. Supply-chain and secret hygiene
   - minimal, non-root, multi-architecture images;
   - scanning, SBOM, provenance, signing, and digest pinning;
   - private-registry authentication, `imagePullSecrets`, and short-lived
     workload identity where the registry supports it;
   - encryption at rest and least-privilege Secret access;
   - external secret stores;
   - never log or commit secret material.
7. Multi-tenancy reality
   - soft versus hard tenancy;
   - quotas, policies, and RBAC are layered controls;
   - node and cluster isolation for stronger boundaries.

**LOCAL-CORE lab on the app-networked bundle — 75–105 minutes**

- Deploy an intentionally overprivileged Workbench worker.
- Use `kubectl auth can-i --as=system:serviceaccount:...` to enumerate its
  permissions.
- Prove that Secret read or Pod create permissions can become escalation paths.
- Replace the broad binding with a namespace Role and dedicated ServiceAccount.
- Wire a supplied local identity fixture that issues short-lived tenant claims
  into the Workbench API. Prove that tenant A cannot read tenant B's job, that a
  missing or modified token is denied, and that a tenant request budget is
  enforced. The course supplies authentication plumbing; the learner owns the
  application-authorization policy and negative tests. Map the fixture to a
  production identity provider without presenting it as one.
- Label only the Workbench namespace for the Restricted Pod Security profile,
  observe the rejected Pod, and harden it until admitted. Do not apply it
  blindly to third-party controller namespaces.
- Scan the course image with pinned Trivy, verify its cosign signature, pin its
  digest, and verify the running image ID. The version file supplies both tools.
- Apply the Module 8 default-deny policy and rerun the application smoke test.

**Assignment**

Submit a one-page threat model for Workbench: assets, actors, trust boundaries,
five plausible abuse paths, preventive controls, and evidence for two blocked
attacks. Include every temporary exception and its removal condition.

**Misconceptions to break:** a base64-encoded Secret is not encrypted; RBAC is
not an application authorization system; a non-root UID alone does not make a
container safe; namespace isolation is not a virtual machine boundary.

---

### Module 12 — Observability, SLOs, and evidence

**Question:** What evidence would distinguish a slow application from a slow
dependency, a saturated node, and a broken control loop?

**Learning objectives**

- Correlate Kubernetes status and events with logs, metrics, and traces.
- Choose signals that answer a question rather than collect everything.
- Turn user-visible behavior into an SLI, SLO, dashboard, and alert.

**Sections and subsections**

1. Five evidence surfaces
   - desired and observed state;
   - conditions and events;
   - application and container logs;
   - metrics;
   - distributed traces and profiles.
2. Logging
   - stdout/stderr and structured fields;
   - request, job, and trace correlation IDs;
   - current versus `--previous` container logs;
   - collection, retention, redaction, and cost;
   - why `kubectl logs` is not a logging architecture.
3. Metrics
   - Metrics API and metrics-server;
   - Prometheus exposition and scraping;
   - kube-state versus application and runtime metrics;
   - RED for requests, USE for resources;
   - counters, gauges, histograms, percentiles, and cardinality;
   - recording rules and scrape failure.
4. Tracing
   - spans, context propagation, baggage, and sampling;
   - asynchronous queue context;
   - locating queue wait, service time, and dependency time;
   - OpenTelemetry as the instrumentation boundary.
5. From reliability claim to SLO
   - user journey and service boundary;
   - availability and latency SLIs;
   - windows, targets, and error budgets;
   - symptoms versus causes;
   - actionable multi-window alerting.
6. Kubernetes control-plane clues
   - resource generation and observed generation;
   - controller status;
   - scheduling events;
   - rollout and endpoint conditions;
   - when an event disappeared before the incident review.

**LOCAL-CORE lab that bootstraps the observed-app bundle — 120–180 minutes**

- Install the pinned, resource-capped course stack: Metrics Server,
  Prometheus, OpenTelemetry Collector, Jaeger all-in-one, and Grafana.
- Apply the tested kind kubelet-certificate configuration, then prove both
  `kubectl top` and a direct `metrics.k8s.io` query work.
- Instrument one document request through API, Redis, and worker with a shared
  trace and job ID.
- Add request-rate, error, duration, queue-age, and worker-utilization metrics.
- Inject a slow worker and then a slow database; distinguish them using the
  trace and metrics.
- Restart a crashing worker and recover its previous logs.
- Build one small Grafana dashboard and an availability/latency SLO; find the
  same request in Jaeger.

Keep retention short and resource limits low enough for the `LOCAL-CORE`
profile. The purpose is queryable evidence, not a miniature production
observability platform. A `LOCAL-HEAVY` extension replaces Jaeger all-in-one
with separate durable backends and examines retention and sampling.

**Assignment**

Given a silent dashboard, determine whether the application has zero traffic,
the scrape target is down, labels changed, or the collector is broken. Submit
the query, event, trace, or target evidence that rules out each alternative.

**Misconceptions to break:** green CPU does not imply a healthy service;
percentiles cannot be safely averaged; high-cardinality request IDs do not
belong in metric labels; telemetry loss must not look like application health.

---

### Module 13 — Packaging, delivery, and GitOps

**Question:** How can the same tested artifact move through environments
without copy-pasted YAML or a second build?

**Learning objectives**

- Separate application artifacts, configuration, and environment policy.
- Use Kustomize to produce reviewable environment-specific manifests.
- Explain the build, promote, and GitOps feedback loops without requiring a
  reader-owned registry or CI account.

**Sections and subsections**

1. The release unit
   - immutable image digest;
   - configuration and schema compatibility;
   - manifest or chart version;
   - release metadata and rollback limits.
2. Repository design
   - base resources and environment overlays;
   - ownership boundaries;
   - secrets out of Git;
   - generated output versus source.
3. Kustomize
   - resources, patches, images, labels, and generators;
   - base/overlay composition;
   - name hashes and rollout behavior;
   - render before apply.
4. Helm comparison
   - chart structure, values schema, helpers, and dependencies;
   - lifecycle and release records;
   - avoid arbitrary programming in templates;
   - test and lint rendered manifests;
   - pin the course's Helm major and chart APIs;
   - optional unless a later elective explicitly consumes a chart.
5. CI pipeline
   - build once for ARM64 and AMD64;
   - test, scan, SBOM, sign, and attest;
   - render, schema validate, policy check, server-side dry run;
   - ephemeral kind smoke test;
   - promote a digest rather than rebuild it.
6. GitOps feedback loop
   - declarative, versioned, pulled, continuously reconciled;
   - desired-state repository and runtime status;
   - drift, prune, health, sync waves, and rollback;
   - Argo CD as the optional concrete implementation;
   - Git revert cannot undo an incompatible database migration.
7. Safe application evolution
   - backward-compatible contracts;
   - expand/migrate/contract;
   - feature flags;
   - pre-deploy versus application-owned migration Jobs.

**LOCAL-CORE lab**

- Package Workbench as a Kustomize base with local and test overlays.
- Render and inspect the exact change before applying it.
- Build the laptop's native architecture locally, scan it with the pinned
  course tool, load it into kind, and deploy the verified digest.
- Introduce an invalid or disallowed field and fail before deployment.
- Run an idempotent schema-migration Job and demonstrate a change for which
  image rollback alone is unsafe.
- Inspect a supplied CI run that produces ARM64/AMD64 artifacts, SBOM,
  signature, attestation, and kind smoke-test evidence; the reader need not own
  an external account or registry.
- `LOCAL-HEAVY`: compare a small pinned Helm chart with the Kustomize output.
- `LOCAL-HEAVY`: install pinned Argo CD, make manual drift, observe
  reconciliation, and recover through Git.

**Assignment**

Design a promotion flow from commit to production. Every gate must name its
input, evidence, owner, and failure action. Include one reversible application
change and one database change that needs forward recovery.

**Misconceptions to break:** Helm is not GitOps; GitOps is not merely storing
YAML in Git; rollback does not reverse data; templating more fields is not
automatically reusable design.

---

### Module 14 — Reliability, disruption, and autoscaling

**Question:** Which loop should react when demand rises, a Pod becomes
unhealthy, or a node is drained?

**Learning objectives**

- Design startup, readiness, liveness, and shutdown as one lifecycle.
- Predict rolling-update and disruption behavior from explicit budgets.
- Choose an autoscaling signal tied to demand and bottleneck.

**Sections and subsections**

1. Availability as a chain
   - replicas, independent failure domains, dependency availability, and
     capacity;
   - redundancy versus recoverability;
   - graceful degradation.
2. Lifecycle correctness
   - startup, readiness, and liveness probes;
   - readiness gates;
   - EndpointSlice removal;
   - SIGTERM, preStop, grace period, connection drain, and queue drain;
   - probe budgets derived from real startup distributions.
3. Safe rollout
   - Deployment strategy;
   - maxSurge, maxUnavailable, minReadySeconds, and progress deadline;
   - canary and blue/green as delivery patterns;
   - readiness failure versus rollout failure.
4. Disruption
   - voluntary and involuntary failure;
   - PodDisruptionBudget;
   - eviction API and node drain;
   - topology spread and anti-affinity;
   - PDB governs voluntary disruptions that use the Eviction API;
   - PDB cannot protect against node loss, direct Pod deletion, or a
     Deployment's own rollout, and cannot guarantee spare capacity.
5. Autoscaling loops
   - HPA resource, custom, and external metrics;
   - target math, missing metrics, readiness delay, tolerance, and
     stabilization;
   - vertical recommendations and restart implications;
   - KEDA for event demand;
   - node autoscaling as a slower, separate loop.
6. Load and resilience tests
   - baseline, load, stress, spike, and soak;
   - retries with backoff and jitter;
   - retry amplification and load shedding;
   - validate SLOs, not merely replica counts.

**LOCAL-CORE lab on the observed-app bundle — 90–120 minutes**

- Configure a deliberately slow-starting worker with incorrect probes and
  observe the restart loop; repair it from measured startup time.
- Generate CPU load, observe HPA decisions, then repeat with a queue-length
  signal in the optional KEDA extension.
- Before the CPU experiment, require a passing `kubectl top` and
  `metrics.k8s.io` assertion; Prometheus is not the resource-metrics provider
  for the standard CPU HPA.
- Roll out a bad API version and inspect progress conditions.
- On the networked profile, drain one stateless worker with and without a PDB and
  adequate spare capacity.
- Trigger a retry storm, add bounded backoff/jitter and admission limits, and
  compare successful throughput.

**Checkpoint 3**

Operate Workbench against a published SLO during a rollout, traffic spike, and
worker-node drain. The submission must include load profile, HPA decisions,
rollout evidence, PDB behavior, user-visible impact, and the smallest justified
repair. It must also prove least-privilege RBAC, Restricted Pod Security,
digest-pinned promotion with scan/signature evidence, and one request
correlated across trace, metric, dashboard, and alert.

**Misconceptions to break:** liveness is not traffic readiness; more replicas
cannot repair a saturated database; an HPA does not create nodes; a PDB is not
a replication mechanism.

---

### Module 15 — Systematic debugging and incident response

**Question:** At which layer did the system stop making progress?

**Learning objectives**

- Debug from symptom to failed contract without random restarts.
- Use a compact evidence path for common workload, network, and storage states.
- Convert an incident into a tested guardrail.

**Sections and subsections**

1. The diagnostic ladder
   - client and local context;
   - API object and admission;
   - controller and rollout;
   - scheduler;
   - image pull and container process;
   - lifecycle and health;
   - Service, EndpointSlice, DNS, and policy;
   - Gateway;
   - storage;
   - node and runtime.
2. A repeatable evidence bundle
   - timestamp, cluster, namespace, resource, generation, and image digest;
   - `get`, `describe`, events, logs, metrics, traces, endpoints, and packet
     tests;
   - ephemeral debug containers and node debug;
   - collect before repair;
   - redact credentials and user data.
3. Symptom playbooks
   - Pending;
   - ImagePullBackOff;
   - CrashLoopBackOff;
   - OOMKilled;
   - not Ready;
   - Service with no endpoints;
   - DNS failure;
   - denied policy path;
   - Pending PVC;
   - stuck Terminating;
   - slow but apparently healthy.
4. Incident practice
   - impact, detection, mitigation, diagnosis, recovery, and follow-up;
   - hypothesis log;
   - blameless timeline;
   - contributing conditions rather than one “root cause”;
   - action item with owner and verification.

**LOCAL-CORE lab on the observed-app bundle: the Workbench escape room**

The repository applies six hidden but deterministic faults: wrong context,
quota-blocked Pod, invalid image digest/no matching manifest chosen by
preflight, bad selector, denied network path, and stale configuration. Readers
receive only user symptoms and an SLO alert. A validation script scores
recovery without revealing the fault.

**Assignment**

Resolve four scenarios selected by a recorded seed under a time box. Reveal the
seed and fault IDs after submission so CI, grading, reset, and the answer key
can replay them. Submit a minimal evidence bundle, hypothesis log, repaired
diff, regression test, and a short incident review. Extra credit is awarded for
avoiding changes unrelated to the failed contract.

**Misconceptions to break:** restart is a mitigation, not a diagnosis; an
empty log is evidence only after the logging path is verified; a healthy Pod
does not prove a healthy request path.

---

### Module 16 — Distributed-application patterns Kubernetes does not provide

**Question:** What happens when a worker completes the work but dies before it
acknowledges the message?

**Learning objectives**

- Design retries, idempotency, backpressure, and graceful drain at the
  application layer.
- Distinguish Kubernetes availability primitives from distributed-systems
  correctness.
- Use Kubernetes identity and coordination primitives without inventing
  fragile consensus.

**Sections and subsections**

1. Boundaries and failure
   - synchronous and asynchronous calls;
   - timeout budgets;
   - partial failure and ambiguous outcomes;
   - circuit breakers and bulkheads;
   - bounded queues and admission control.
2. Delivery semantics
   - at-most-once and at-least-once;
   - Redis Streams consumer group, pending-entry list, acknowledgement, and
     idle-message reclaim as the course's concrete protocol;
   - idempotency keys and deduplication;
   - transactional outbox;
   - dead-letter handling;
   - checkpoint and resume;
   - why “exactly once” is normally a composed property.
3. Retry design
   - which layer owns the retry;
   - bounded exponential backoff and jitter;
   - retry budget;
   - poison messages;
   - overload feedback.
4. Coordination
   - stable StatefulSet identity and headless discovery;
   - Leases for leader election;
   - fencing and stale leaders;
   - split brain;
   - use a proven consensus system instead of building one from a ConfigMap.
5. Parallel work
   - Jobs, parallelism, completions, and Indexed Jobs;
   - work queues;
   - per-item status and checkpointing;
   - scale on backlog and age, not only worker CPU.
6. Graceful change
   - stop accepting;
   - drain in-flight work;
   - acknowledge safely;
   - terminate within the budget;
   - maintain compatibility across mixed versions.

**LOCAL-CORE lab on the observed-app bundle — 90–120 minutes**

- Consume through a Redis Streams consumer group and inspect its pending-entry
  state.
- Kill a worker after PostgreSQL commit but before `XACK`; reclaim the idle
  message and observe duplicate execution.
- Add a stable job ID and database uniqueness/idempotency record, then prove
  one externally visible result across the same crash boundary.
- Inject a poison job, cap delivery attempts, route it to a dead-letter stream,
  and drain a worker during rollout.
- Challenge: implement Lease-based leadership with a monotonically increasing
  fencing token enforced at the side-effect boundary.
- Challenge: run an Indexed Job with resumable per-index output.

**Assignment**

Write the failure contract for one Workbench job: accepted, in progress,
committed, acknowledged, retried, and abandoned. Then prove behavior at every
crash boundary with automated fault injection.

**Misconceptions to break:** Kubernetes does not provide distributed
transactions, consensus, or exactly-once execution; a restart can repeat side
effects; leader election without fencing does not make stale leaders harmless.

---

### Module 17 — CRDs, controllers, and operators

**Question:** What changes when an API object exists but no controller acts on
it?

**Learning objectives**

- Model intent and observation as a versioned custom API.
- Explain the list/watch/work-queue/reconcile loop and its failure modes.
- Decide when an operator is justified and when ordinary application code is
  simpler.

**Sections and subsections**

1. From feedback loop to controller
   - desired state, observed state, and eventual convergence;
   - level-driven versus edge-driven logic;
   - idempotent reconciliation;
   - retry and exponential rate limiting;
   - caches can be stale.
2. CustomResourceDefinition
   - group, version, kind, and resource;
   - structural OpenAPI schema;
   - defaulting and validation;
   - spec, status, conditions, and observed generation;
   - version conversion and compatibility.
3. Controller mechanics
   - list and watch;
   - informer cache;
   - keyed work queue;
   - optimistic concurrency and resourceVersion;
   - requeue versus event trigger;
   - leader election.
4. Ownership and deletion
   - owner references and garbage collection;
   - finalizers;
   - deletion timestamp;
   - stuck termination;
   - never depend on one successful finalizer attempt.
5. Operator boundaries
   - domain lifecycle knowledge;
   - backups, upgrades, failover, and status;
   - controller versus admission webhook;
   - CNI, CSI, device plugin, and scheduler extension points;
   - operational cost, API stewardship, and upgrade burden.
6. Testing and operability
   - pure reconciliation tests;
   - fake-client limits;
   - envtest and real-cluster tests;
   - metrics, events, conditions, and runbooks;
   - deletion and restart tests.

**LOCAL-CORE lab on the observed-app bundle — 90–150 minutes**

- Install a `DocumentRun` CRD without a controller and prove that the object
  persists but nothing happens.
- Run a supplied, digest-pinned ARM64/AMD64 controller that creates a Job,
  records status, and owns its child. Controller implementation is readable,
  but a local Go toolchain is not required.
- Kill the controller mid-reconcile and prove idempotent recovery.
- Create an update conflict and inspect the retry.
- Delete a resource, observe its finalizer, simulate failed cleanup, then
  let the recovered controller finish cleanup safely; manual finalizer removal
  is an emergency decision, not the normal solution.

**Checkpoint 4**

Extend `DocumentRun` with one field and one status condition. Submit the schema,
compatibility decision, reconciliation state machine, failure-injection test,
metrics, and a short “should this be an operator?” decision record. Pair it
with Module 16's crash-after-commit/before-ack proof so both the application
idempotency boundary and controller restart boundary are demonstrated.

**Misconceptions to break:** a CRD has no behavior by itself; a controller is
not a one-shot script; watches can close and events can be missed; `status` is
not user intent; finalizers do not run code inside the API server.

---

## Season 4 — Inference systems on Kubernetes

This season preserves the same first-principles method. It starts with the
request lifecycle and only introduces a serving framework after readers can
operate a raw Deployment. Mandatory labs use the course CPU simulator. Each
module marks real-accelerator exercises as `GPU-CLOUD` and experimental APIs as
`VERSION-SENSITIVE`; stable APIs with fast-moving implementations are also
version-pinned.

### Module 18 — Inference is a service, not a Pod

**Question:** Why can a healthy replica still give a user terrible
time-to-first-token?

**Learning objectives**

- Trace online inference through admission, queueing, prefill, decode, and
  streaming.
- Define service-level signals for predictive and generative inference.
- Separate Kubernetes health and capacity from model-serving health and
  capacity.

**Sections and subsections**

1. Inference workload families
   - offline batch;
   - synchronous predictive inference;
   - embeddings and reranking;
   - streaming generative inference;
   - latency-sensitive versus throughput-oriented work.
2. Request anatomy
   - validation and tokenization;
   - admission;
   - queue wait;
   - prefill;
   - iterative decode;
   - streaming, cancellation, and completion.
3. Replica activation and cold start
   - node supply and scheduling;
   - image pull;
   - artifact fetch and verification;
   - deserialize, allocate, compile, and warm;
   - Ready and only then route;
   - a scale-from-zero request may wait for this path, but model loading is not
     a normal per-request inference phase.
4. Service contract
   - model and tokenizer revision;
   - input and output limits;
   - synchronous JSON and SSE;
   - cancellation and deadline;
   - overload response;
   - deterministic test mode.
5. SLO vocabulary
   - success and rejection;
   - client-observed p50/p95/p99 time to first token versus server queue time;
   - inter-token latency as individual post-first-token gaps;
   - time per output token as the per-request average decode interval, commonly
     `(time-to-last-token - TTFT) / (output_tokens - 1)`;
   - time to last token and end-to-end latency;
   - input and output token throughput reported separately;
   - request goodput and token goodput meeting the complete SLO;
   - predictive, embedding, and reranking requests use ordinary request
     latency rather than TTFT/TPOT;
   - quality and safety stay separate from latency.
6. Kubernetes mapping
   - Deployment, Service, Gateway, probes, disruption, and autoscaling;
   - why replica Ready does not mean model warm;
   - why CPU utilization can miss queue saturation;
   - why streaming changes timeout and drain behavior.

**LOCAL-CORE lab on the app-networked bundle**

- Run the simulator first as a Docker container and establish its API contract.
- Deploy it behind a Service and Gateway route.
- Configure one execution slot with FIFO admission, generate one long request
  followed by short requests, and deterministically observe head-of-line
  blocking.
- Record queue wait, TTFT, TPOT, request throughput, token throughput, and
  goodput from both server and client. Demonstrate that Gateway buffering can
  leave server TTFT healthy while client TTFT is poor.
- Cancel a stream and prove that server-side work stops.
- Add an admission limit and compare bounded rejection with unbounded latency.

**Assignment**

Publish a one-page inference service contract with SLOs and overload behavior.
For three traces, label admission, queue, prefill, decode, and streaming time,
then identify which layer could improve each delay.

**Misconceptions to break:** Pod readiness is not model readiness; request
throughput is not token throughput; average latency hides queue collapse; a
faster kernel cannot fix unbounded admission.

---

### Module 19 — Model-serving containers and model artifacts

**Question:** Is a model part of the image, configuration, or release—and what
must happen before the replica accepts traffic?

**Learning objectives**

- Design a serving container with correct startup, readiness, cancellation,
  and graceful termination.
- Treat weights, tokenizer, configuration, code, and license as one pinned
  model release.
- Choose an artifact-delivery path from measured cold-start and security
  requirements.

**Sections and subsections**

1. Serving process contract
   - validation and bounded inputs;
   - health, readiness, and model-status endpoints;
   - streaming and disconnect propagation;
   - concurrency and admission;
   - graceful drain.
2. Model lifecycle
   - fetch, checksum, deserialize, allocate, compile, warm, and serve;
   - startup probes sized to worst credible load;
   - readiness only after warmup;
   - liveness for deadlock, not slow initialization;
   - unload and replacement.
3. Artifact as a release
   - exact model revision and content hash;
   - weights, tokenizer, generation configuration, adapters, code, and license;
   - compatibility with runtime and accelerator;
   - provenance, scanning, and formats that avoid arbitrary code execution.
4. Delivery choices
   - baked into the image;
   - per-Pod init-container download to `emptyDir`;
   - RWO PVC reused sequentially with its bound-node constraints;
   - RWX/shared filesystem used concurrently by several replicas;
   - object store or OCI artifact;
   - node-local SSD cache coupled to placement;
   - cold-start, duplication, mutability, and egress trade-offs.
5. Container patterns
   - init container for a finite prerequisite;
   - sidecar for telemetry or protocol adaptation;
   - pre/post-processing in-process by default;
   - separate service only when it needs an independent lifecycle or scale
     boundary.
6. Rollout compatibility
   - server image plus model manifest;
   - mixed-version requests;
   - cache invalidation;
   - rollback with retained artifacts;
   - model load failure must not replace healthy capacity.

**LOCAL-CORE lab**

- Add a 20-second simulated model load with a wrong liveness probe, observe the
  restart loop, then repair startup and readiness.
- Download a versioned artifact in an init container, verify a checksum, and
  reject a corrupted artifact.
- Compare a tiny baked artifact, per-Pod `emptyDir` download, and sequential
  reuse of the Module 9 RWO PVC. Record StorageClass, access mode, Pod/node
  placement, cache state, image pull, fetch, load, warmup, and ready time.
- Explain why this kind volume is neither a multi-replica RWX cache nor a
  durable node-local model cache.
- Delete a Pod during an SSE response and implement connection and queue drain.

**Checkpoint 5**

Release simulator version B with a changed model manifest while version A
serves traffic. Demonstrate warm-before-route, checksum failure containment,
graceful stream drain, rollback, and an artifact provenance record.

**Misconceptions to break:** a large image is not the only reproducible
artifact strategy; readiness must not go green before warmup; an init container
does not refresh a model after startup; “same model name” does not establish
compatibility.

---

### Module 20 — Accelerators, topology, and scheduling

**Question:** If a Pod requests four GPUs, what makes those devices visible,
allocatable, isolated, and close enough to communicate?

**Learning objectives**

- Explain device discovery and allocation from node to container.
- Express accelerator, topology, and priority needs without fake resources.
- Distinguish exclusive allocation, partitioning, time-sharing, and dynamic
  resource claims.

**Sections and subsections**

1. Device path
   - host driver and container runtime;
   - node discovery and labels;
   - device plugin discovers devices and reports health to kubelet;
   - kubelet publishes a scalar extended resource in Node allocatable;
   - scheduler chooses a node from the requested count;
   - kubelet device manager selects and prepares concrete devices and invokes
     the plugin's `Allocate` call;
   - device visibility inside the container;
   - health and telemetry.
2. Placement
   - extended GPU resources appear in `limits`, or in equal `requests` and
     `limits`; request-only use and overcommit are not supported;
   - labels, node affinity, taints, tolerations, and priority;
   - zones, racks, hosts, NUMA domains, PCIe, NVLink, and fabric;
   - Topology Manager is kubelet/node admission, not global scheduling; a Pod
     can be scheduled and then rejected by node topology policy;
   - fragmentation and stranded capacity.
3. Sharing and isolation
   - exclusive whole device;
   - hardware partitioning such as MIG;
   - time-sharing;
   - memory and fault isolation differences;
   - quotas and tenant policy.
4. Dynamic Resource Allocation
   - DeviceClass, ResourceSlice, ResourceClaim, and claim templates;
   - structured device attributes and constraints;
   - scheduler allocates a claim against ResourceSlices and the node-side DRA
     driver prepares it;
   - core DRA APIs became GA in Kubernetes 1.34 and are always enabled from
     1.35; optional subfeatures retain separate feature states;
   - prioritized requests, health, partitioning, consumable capacity,
     extended-resource bridging, and workload claims each have their own
     pinned feature state;
   - driver maturity is independent of API maturity and DRA resources
     currently have preemption limitations;
   - use only in the optional pinned lab until the target environment supports
     it.
5. Capacity lifecycle
   - scarce devices and Pending diagnosis;
   - preemption;
   - autoscaled accelerator nodes;
   - driver/runtime compatibility;
   - upgrade and drain.

**LOCAL-CORE lab on the networked profile**

- Give kind workers realistic labels such as zone, rack, accelerator-family,
  and memory-class. Never advertise a fake `nvidia.com/gpu` resource.
- Place simulated workloads with affinity, taints, topology spread, and
  priority.
- Create an impossible topology constraint, diagnose Pending events, and
  repair the requirement.
- Demonstrate that labels express eligibility but do not allocate or isolate a
  device.

**GPU-CLOUD extension**

Install a pinned vendor device plugin or operator, inspect allocatable devices,
schedule one workload, observe device health/telemetry, and compare exclusive,
MIG, or time-sharing behavior where hardware supports it. A second
`VERSION-SENSITIVE` extension evaluates a DRA driver and claim.

**LOCAL-HEAVY, VERSION-SENSITIVE DRA extension**

Use the official example driver on kind to inspect DeviceClass, ResourceSlice,
ResourceClaim allocation, and release without pretending the claimed resource
is an NVIDIA GPU.

**Assignment**

Given three workloads—latency-critical large model, bursty embedding service,
and offline batch—write placement, sharing, disruption, and priority policies.
Include one Pending diagnosis and one fragmentation risk for each.

**Misconceptions to break:** Kubernetes does not make a GPU usable without the
host/runtime/driver path; a node label is not a consumable device; four
arbitrary GPUs are not equivalent to four topology-adjacent GPUs; time-sharing
does not provide hard memory isolation.

---

### Module 21 — Serving frameworks without logo soup

**Question:** Which layer owns model runtime, rollout, routing, cluster
lifecycle, and autoscaling?

**Learning objectives**

- Place vLLM, Triton, KServe, and Ray Serve in distinct layers.
- Establish a raw Kubernetes baseline before adopting a controller.
- Select a serving stack from workload and operational requirements.

**Sections and subsections**

1. The layer model

   ```text
   client and inference-aware routing
              |
   serving API/controller (optional)
              |
   runtime/engine
              |
   Kubernetes workloads and Services
              |
   nodes, devices, storage, and network
   ```

2. Raw Kubernetes
   - maximum visibility;
   - hand-built lifecycle, routing, scaling, and model status;
   - the baseline against which a framework must earn its complexity.
3. Runtime/engine layer
   - vLLM for high-throughput LLM serving;
   - Triton Inference Server for multi-framework model serving and ensembles;
   - simulator and ordinary application servers;
   - engines do not replace Kubernetes controllers or cluster scheduling.
4. Serving control plane
   - KServe `InferenceService`;
   - Standard deployment mode for direct Kubernetes control;
   - Knative mode for serverless predictive use cases;
   - in KServe 0.20 at the research date, `LLMInferenceService` remains
     `serving.kserve.io/v1alpha1` and is not the same maturity as
     `InferenceService`;
   - LLMInferenceService adds a dependency chain that can include Kubernetes
     1.32+, cert-manager, Gateway API, InferencePool support, a compatible
     Gateway implementation, LeaderWorkerSet for multi-node serving, and KEDA
     in its scaling path;
   - versioned CRDs and controller upgrade cost.
5. Distributed application layer
   - KubeRay reconciles RayService/RayCluster and manages Kubernetes Pods;
   - Ray Serve manages deployments and replicas inside that cluster;
   - Ray schedules actors and tasks into resources inside the Pods;
   - Kubernetes schedules Pods and cannot see individual Ray actors;
   - Python-native multi-stage inference;
   - Serve, Ray worker-Pod, and Kubernetes node autoscaling are distinct loops.
6. Decision record
   - workload shape and protocol;
   - supported models and hardware;
   - single versus multi-node;
   - rollout and autoscaling requirements;
   - team skills and operational ownership;
   - maturity and portability;
   - simplest adequate layer set.

**LOCAL-CORE lab**

- Operate the simulator as a raw Deployment first.
- Inspect supplied, version-pinned KServe and RayService manifests, generated
  resources, status, events, and failure bundles. Map ownership at every layer
  and diagnose one controller failure versus one runtime failure.
- Produce a framework decision record. The required path does not install two
  large controller stacks merely to compare their names.

**Independent LOCAL-HEAVY electives**

- `ARCH-GATED`, `VERSION-SENSITIVE`: on a clean cluster, install pinned KServe
  and serve a course-owned multi-architecture CPU predictor in Standard mode.
- `ARCH-GATED`, `VERSION-SENSITIVE`: on a separate clean cluster, run a small
  RayService CPU pipeline and inspect KubeRay, Ray Serve, and Ray scheduling
  loops separately.
- Each elective preflights every upstream image platform and exits with an
  explicit unsupported-architecture result instead of silent emulation.

**GPU-CLOUD extension**

Serve a pinned model with vLLM, then place it behind the chosen serving control
plane. Record its full dependency chain and what each layer owns; installing
KServe around vLLM is not treated as one controller toggle. A Triton extension
serves a non-LLM or ensemble workload.

**Assignment**

Write three architecture decision records: a scikit-learn classifier, a
Python-native multi-stage pipeline, and a multi-GPU LLM. Reject at least one
plausible framework in each record with evidence rather than preference. Mark
the multi-GPU record provisional and revise it after Modules 23–24.

**Misconceptions to break:** KServe and vLLM are not interchangeable
competitors; a serving CRD does not remove engine constraints; another
controller adds another feedback loop to observe and upgrade.

---

### Module 22 — Batching, KV cache, and performance engineering

**Question:** When does waiting a little longer make the service faster, and
when does it destroy the latency SLO?

**Learning objectives**

- Relate batching and queue policy to TTFT, TPOT, throughput, and goodput.
- Build an approximate memory budget for weights, activations, and KV cache.
- Benchmark with a workload model instead of publishing one peak number.

**Sections and subsections**

1. Batching models
   - no batching;
   - fixed and dynamic batching;
   - continuous or iteration-level batching;
   - batch window and maximum size;
   - head-of-line blocking;
   - fairness and starvation.
2. Generative phases
   - compute-heavy prefill;
   - memory-bandwidth-sensitive iterative decode;
   - mixed prompt and output lengths;
   - chunked prefill;
   - preemption and recomputation.
3. Memory budget
   - weights and quantization;
   - runtime workspace and activations;
   - durable first estimate:

     ```text
     KV bytes ≈ live_tokens × layers × 2(K,V)
                × num_kv_heads × head_dim × bytes_per_element
     ```

   - grouped-query and multi-query attention use KV heads, not query-attention
     heads;
   - allocator/page overhead, fragmentation, runtime workspace, and a safety
     margin are added after the estimate;
   - adapters;
   - approximate formulas are hypotheses to validate on the target engine.
4. Cache and engine techniques
   - paged KV management;
   - prefix caching can save repeated prefill compute while retaining pages
     longer; it is not automatically a memory reduction;
   - quantization;
   - speculative decoding;
   - trade latency, quality, memory, and operational complexity;
   - never present a technique as universally faster.
5. Benchmark design
   - representative prompt/output distributions;
   - warm and cold runs;
   - open-loop versus closed-loop load;
   - concurrency, offered load, and achieved throughput;
   - client TTFT, server queue time, inter-token latency, per-request TPOT, time
     to last token, and end-to-end latency retain their Module 18 definitions;
   - input/output throughput and request/token goodput are separate;
   - coordinated omission in closed-loop tests;
   - Pareto frontier rather than one winner.
6. Framework mapping
   - Triton dynamic batching;
   - Triton sequence batching;
   - Ray `@serve.batch`;
   - vLLM continuous/iteration scheduling;
   - related mechanisms with different lifecycle and ordering contracts.

**LOCAL-CORE lab — 90–150 minutes**

- Sweep simulator batch window, maximum batch size, concurrency, prompt length,
  and output length.
- Produce a table and plot for the full metric set using course-owned,
  containerized report tooling so the Mac prerequisite list does not grow.
- Show queue collapse beyond capacity, then restore the SLO using bounded
  admission.
- Add prefix-cache hits and explain which workload distribution benefits.
- Compare open loop at a fixed offered arrival rate with closed loop at fixed
  concurrency chosen to match low-load throughput; show their divergence under
  overload and the coordinated-omission effect.

**GPU-CLOUD extension**

Repeat one representative sweep with a pinned vLLM or Triton version and model.
Record accelerator, precision, engine arguments, tokenizer, dataset
distribution, and warmup so the result is reproducible.

**Checkpoint 6**

Choose a configuration for an explicit latency SLO and traffic distribution.
Submit raw results, a Pareto plot, memory estimate, rejected alternatives, and
a written warning about what the simulator cannot predict. Add one accelerator
topology placement/unschedulable diagnosis and a provisional framework ADR;
revise the ADR after Modules 23–24.

**Misconceptions to break:** maximum throughput is not production goodput;
larger batches do not always improve latency or throughput; KV-cache estimates
do not replace measurement; closed-loop load can hide an overloaded service.

---

### Module 23 — Distributed inference and group scheduling

**Question:** What must fail together when one logical replica spans several
processes, devices, or nodes?

**Learning objectives**

- Choose among replication, data, tensor, pipeline, and expert parallelism.
- Connect model partitioning to topology, startup, rollout, and failure.
- Explain why group-aware controllers and queueing can be necessary.

**Sections and subsections**

1. Scale-up decision tree
   - first optimize and replicate one-device servers;
   - shard only when model memory or target performance requires it;
   - serving “data parallelism” means independent full-model replicas, not
     synchronized training-gradient data parallelism;
   - tensor parallelism;
   - pipeline parallelism;
   - expert parallelism;
   - hybrid layouts.
2. Communication and topology
   - collective communication;
   - bandwidth, latency, and synchronization;
   - intra-host versus cross-host links;
   - rack and zone placement;
   - topology-aware performance is part of the service design.
3. One replica as a group
   - leader and workers;
   - stable identity and discovery;
   - group lifecycle does not by itself reserve capacity for every member;
   - aggregate readiness must be computed by the leader or a supplied
     controller;
   - group restart and rollout;
   - a failed sharded online replica normally loses KV state and aborts
     in-flight streams unless a specific runtime provides recovery.
4. Kubernetes building blocks
   - StatefulSet and headless Service supply identities/endpoints but neither
     aggregate readiness nor atomic group rollout;
   - LeaderWorkerSet supplies group identity, rollout, topology placement,
     scaling by group, and optional all-or-nothing restart behavior;
   - combine LWS with Kueue or a pinned workload/PodGroup scheduler when all
     members need gang capacity admission;
   - Ray for distributed Python applications;
   - Kueue handles workload admission, quota, and topology-aware workload
     placement—not per-request inference queues;
   - standard scheduler limitations.
5. Prefill/decode disaggregation
   - independent phase scaling;
   - KV transfer path;
   - routing and compatibility;
   - added network and failure modes;
   - use only when measurements justify the architecture.
6. Emerging mechanisms
   - the current LeaderWorkerSet v1 baseline and Kueue release are pinned per
     lab;
   - LWS `DisaggregatedSet`, Kueue individual-recovery/topology features, and
     native workload/PodGroup scheduling are tracked separately and marked
     `VERSION-SENSITIVE`;
   - architecture lesson stays stable when the API changes.
7. Runtime plumbing
   - rendezvous and exact model revision on every rank;
   - shared memory, IPC, memlock, and startup timeout;
   - communication-interface and NCCL selection;
   - RDMA device access;
   - collective failure diagnosis.

**LOCAL-HEAVY lab on the inference profile with the core storage add-on**

- Run one simulated logical replica as a leader plus two CPU shard workers on
  three kind nodes.
- Discover shards through a headless Service. A course-supplied leader
  coordinator computes aggregate readiness and exposes the only client-facing
  endpoint.
- Delay one shard, kill another, and observe all-or-nothing request behavior.
- Show that ordinary independent Pods/StatefulSet do not provide atomic group
  rollout, then compare with the supplied coordinator.
- Optional: install pinned LeaderWorkerSet and repeat group lifecycle with fake
  CPU workers; add Kueue only when testing all-member capacity admission.
- Prove a failed fake shard aborts the stream and discards simulated KV state
  rather than claiming transparent recovery.

If the preflight cannot safely allocate 10 GB to Docker, a lower-memory variant
co-locates two fake ranks and is graded only on coordination/readiness, not
physical topology. The three-worker placement proof moves to a remote cluster.

**GPU-CLOUD extension**

Measure tensor parallelism within one host, then a multi-node tensor/pipeline
layout where hardware permits. Record interconnect topology and compare the
communication cost. Add Kueue if several teams or queued workloads share the
cluster.

**Assignment**

For a model that does not fit one device, choose a parallel layout and draw its
physical placement. Specify startup, readiness, failure, rollout, rescheduling,
and degraded-service behavior. Defend why simpler replication is insufficient.

**Misconceptions to break:** more GPUs do not imply linear speedup; a
Deployment does not treat several Pods as one atomic replica; a Service does
not guarantee all shards are ready; network topology is not an implementation
detail.

---

### Module 24 — Model-aware routing and nested autoscaling

**Question:** Why can round-robin routing and CPU-based HPA oscillate even when
there appears to be spare capacity?

**Learning objectives**

- Route inference using capacity, request, model, and cache state.
- Choose autoscaling signals that represent useful work and queue pressure.
- Stabilize interacting loops operating at different time scales.

**Sections and subsections**

1. Streaming network behavior
   - Gateway timeouts;
   - buffering and SSE;
   - disconnect and cancellation propagation;
   - retry may be safe before response bytes; after a stream emits bytes,
     transparent retry is normally unsafe and partial completion must be
     surfaced;
   - weighted, header, shadow, and mirror routes.
2. Why generic balancing fails
   - variable prompt and output length;
   - long-lived connections;
   - replica queue and active-sequence state;
   - prefix and adapter cache locality;
   - model and capability compatibility.
3. Inference-aware policy
   - least queued or least estimated work;
   - queue bounds and admission;
   - cache-aware and adapter-aware routing;
   - fairness between tenants and request sizes;
   - stale endpoint metrics and fallback behavior.
4. Signals for scaling
   - in-flight requests;
   - queue length and oldest-item age;
   - estimated queued token work and arrival rate;
   - output tokens/second is primarily a capacity/result signal;
   - batch occupancy and KV-cache pressure are corroborating saturation
     signals, not automatically monotonic scale targets;
   - GPU utilization as corroborating, not sole, evidence;
   - cold-start and drain cost.
5. Nested loops
   - microseconds/milliseconds: engine scheduler and batcher;
   - microseconds/milliseconds per request: router and admission decision;
   - seconds: endpoint-state and telemetry refresh;
   - tens of seconds/minutes: HPA or KEDA;
   - minutes: node provisioning and model loading;
   - stabilization, rate limits, headroom, and scale-down delay;
   - avoid loops fighting over the same symptom;
   - per-request router owns destination/reject, engine scheduler owns active
     sequences/batches, serving autoscaler owns runtime replicas, KEDA-created
     HPA owns Pod or LWS-group count, Ray autoscaler owns Ray worker Pods, and
     cluster autoscaler owns nodes;
   - only one controller owns a scale target; scale logical LWS groups rather
     than tensor/pipeline ranks, and give disaggregated prefill/decode roles
     separately justified actuators.
6. Gateway API Inference Extension
   - InferencePool and endpoint picker concepts;
   - integration with Gateway routing;
   - the project reports GA and exposes the InferencePool v1 API at the research
     date;
   - verify the selected Gateway implementation's conformance and supported
     inference features;
   - the lightweight endpoint picker is for conformance, not a production
     router; evaluate a maintained scheduler such as llm-d;
   - keep controller/router integration pinned and `VERSION-SENSITIVE` even
     though the API is GA.

**LOCAL-CORE, VERSION-SENSITIVE lab on the observed-app bundle — 120–180 minutes**

- Install pinned KEDA as an explicit prerequisite; Module 12's Prometheus stack
  remains required. KEDA's mature `ScaledObject` is currently served as
  `keda.sh/v1alpha1`, so validate the installed CRD, render/apply the lab against
  the pinned version, and run the compatibility smoke test before continuing.
- Run two simulator versions and perform weighted and header-based routing.
- Compare round-robin with a small router that scores queue depth and cache
  locality.
- Scale workers from an always-on Redis/admission-queue age metric. Teach KEDA
  operator ownership of activation/deactivation at 0↔1 and its generated HPA
  ownership of 1↔N; cooldown controls scale-to-zero while HPA behavior controls
  scaling above zero.
- Keep the latency-sensitive online exercise at `minReplicaCount: 1`. Test
  scale-to-zero separately and measure its cold-start TTFT; worker-only metrics
  cannot activate a target after those workers disappear.
- Introduce a long model-load time and provoke oscillation; add stabilization,
  headroom, and a scale-down delay.
- Break the metrics path and prove an explicitly configured KEDA fallback
  rather than assuming safe behavior.

**Checkpoint 7**

Rerun the final scenario on the `LOCAL-HEAVY` `inference-system` bundle.
Hold an SLO under a bursty, mixed-length workload while one replica is cold and
one metrics source fails. Submit route decisions, scaler decisions, queue
behavior, fallback policy, and a timeline showing each feedback loop. Then fail
one shard and prove aggregate group readiness, group-level restart/rollout
behavior, and safe failure of in-flight work.

**Misconceptions to break:** round robin does not imply equal work; GPU
utilization alone does not express queue demand; scaling Pods is useless when
no nodes can host them; every additional autoscaler can destabilize the system.

---

### Module 25 — Inference operations, security, and cost

**Question:** Can the system remain useful, private, and affordable while a
model loads slowly, a shard fails, and traffic spikes?

**Learning objectives**

- Operate inference using model-aware telemetry and failure drills.
- Threat-model images, model artifacts, requests, caches, and tenant access.
- Connect capacity and cost to goodput rather than provisioned accelerator
  count.

**Sections and subsections**

1. Operational telemetry
   - request rate, errors, saturation, queue age, and rejection;
   - client TTFT, server queue, inter-token latency, per-request TPOT, time to
     last token, end-to-end latency, and request/token goodput using Module 18's
     definitions;
   - input and output token throughput reported separately;
   - prompt/output token distributions;
   - batch occupancy, preemption, and KV-cache pressure;
   - prefix-cache hit;
   - load/warm time;
   - device memory, utilization, health, power, and fabric telemetry;
   - avoid user IDs and prompts as metric labels.
2. Failure readiness
   - slow and failed model load;
   - OOM and device loss;
   - shard and node failure;
   - dependency timeout;
   - drain of streams and queued requests;
   - PDB, topology, spare capacity, and group recovery;
   - bounded retry, load shedding, and degraded models.
3. Release safety
   - image, runtime, model, tokenizer, adapter, and configuration compatibility;
   - warm-before-route;
   - weighted canary and automated SLO guard;
   - retain known-good artifacts;
   - sharded rollout is a group operation.
4. Security and privacy
   - signed, scanned, digest-pinned multi-architecture images;
   - model revision, checksum, provenance, and license;
   - avoid unsafe deserialization and unreviewed remote model code;
   - identity, RBAC, NetworkPolicy, Pod Security, and secret stores;
   - application authentication/authorization and per-tenant request/token
     budgets are separate from Kubernetes RBAC;
   - prefix/KV-cache tenant isolation, eviction, and timing/data side channels;
   - model-fetch workload identity and explicit egress policy;
   - GPU operators and device plugins are privileged node software in the host
     trust boundary;
   - RDMA and direct host-device paths may bypass ordinary CNI NetworkPolicy;
   - prompt/output redaction, encryption, retention, and access audit;
   - tenant quotas, priority, and fairness;
   - model extraction, denial of service, and malicious input.
5. Capacity and economics
   - arrival and token distributions;
   - concurrency and queueing;
   - goodput per replica/device;
   - headroom for failure and rollout;
   - warm versus cold capacity;
   - input-token and output-token cost reported separately within SLO;
   - CPU, RAM, storage, cache, network/egress, idle warm capacity, and
     rollout/failure headroom;
   - partitioning, time-sharing, bin packing, spot capacity, cache, egress, and
     cross-zone cost;
   - cheaper provisioned capacity can be more expensive useful capacity.

**Checkpoint 8 — LOCAL-HEAVY game day on the inference-system bundle — 120–180 minutes**

- Run a mixed-tenant workload against a hardened simulator deployment.
- Inject slow load, one failed shard, memory pressure, metrics loss, long
  requests, and a traffic spike.
- Exercise bounded admission, priority/fairness, canary abort, graceful drain,
  and fallback to a smaller simulated model. The canary abort uses the supplied
  deterministic analysis Job/script, not HTTPRoute by itself.
- Inspect logs for leaked prompt data and remove high-cardinality labels.
- Use a supplied calculator to compare provisioned cost, successful tokens,
  SLO-good input/output tokens, cache behavior, idle headroom, CPU/RAM/storage,
  and network cost.

**Assignment**

Deliver an inference production-readiness review containing an SLO, dashboard,
alerts, threat model, canary policy, failure matrix, capacity model, cost per
useful token, and rollback/runbook. Every claim needs a measurement or an
explicit assumption.

**Misconceptions to break:** highest utilization is not the cheapest reliable
system; a model file is not trusted merely because it came from a popular hub;
retrying a failed long generation can multiply load; encryption does not solve
retention or access-control mistakes.

---

### Module 26 — Capstones and the production bridge

Readers choose one capstone; platform developers can complete both. The local
artifact must work on a clean Mac with the pinned toolchain, while the design
document explains what changes in a real multi-node or GPU environment. Budget
20–40 hours per capstone; the ten deliverables and failure defense are not a
weekend-hour lab.

#### Taught production bridge

Before the capstone, teach and test the boundary the local lab has deliberately
hidden:

1. **Responsibility model**
   - managed versus self-managed control plane;
   - highly available API/etcd and etcd backup responsibility;
   - provider, platform, and application owner boundaries.
2. **Infrastructure integrations**
   - cloud controller and load balancer;
   - CNI, CSI, DNS, and certificate controller;
   - node pools, zones, upgrade domains, and autoscaling;
   - external state and managed data services.
3. **Identity and supply chain**
   - cloud workload identity and external secret manager;
   - authenticated registry and `imagePullSecrets`;
   - image/model provenance and admission verification;
   - audit ownership and retention.
4. **Lifecycle**
   - Kubernetes version skew and API removal;
   - control-plane, node, CNI/CSI, controller, and workload upgrade order;
   - DNS/TLS certificate issuance and rotation;
   - backup/restore, disaster recovery, RPO/RTO;
   - capacity, reservation, egress, and support cost.

**LOCAL-CORE production-bridge lab on the app-networked bundle**

- Use a course-owned authenticated local-registry fixture, observe failed image
  pull with missing credentials, then recover with scoped registry auth.
- Rotate the Module 8 local TLS certificate and prove the old trust path fails
  before updating it.
- Render the application against a second pinned Kubernetes minor version in a
  disposable kind cluster; surface removed/deprecated APIs before upgrade.
- Submit a managed/self-managed responsibility matrix and a production
  substitution record for every local component.

#### Capstone A — Production-shaped multi-service containerized application

Run on `LOCAL-HEAVY`, the `networked` cluster profile, and the `observed-app`
bundle. On a 16 GB host, use the supplied capped telemetry profile and smaller
database/queue limits, or move the capstone to a remote cluster.

Build and operate a multi-tenant asynchronous document-processing service:

- Gateway API route and stable application API;
- end-user authentication, application authorization, tenant-scoped data and
  job access, and per-tenant request/queue budgets; Kubernetes RBAC is not the
  product authorization layer;
- PostgreSQL, Redis queue, idempotent workers, and dead-letter handling;
- configuration, ServiceAccounts, least-privilege RBAC, Restricted Pod
  Security, NetworkPolicy, quotas, and image digest pinning;
- graceful lifecycle, requests/limits, topology spread, PDB, HPA or KEDA;
- logs, metrics, traces, SLO, dashboard, and alert;
- Kustomize or Helm packaging plus a tested CI/GitOps path;
- backup/restore, safe migration, canary, designated-stateless-node drain and
  dependency-failure drills;
- an explicit degraded-and-restore contract for loss of the single local
  stateful node; no false local database-HA claim.

#### Capstone B — Production-shaped distributed-inference service simulator

Run on `LOCAL-HEAVY`, the `inference` cluster profile, and the
`inference-system` bundle, or use a remote cluster.

Build and operate the CPU inference simulator as a production-shaped service:

- OpenAI-style JSON and SSE contract with cancellation;
- versioned model manifest, init fetch, checksum, warmup, and readiness;
- admission, dynamic batching, queue bounds, and cache simulation;
- two versions with weighted canary and a course-supplied deterministic
  analysis Job/script that changes or reverts route weights on explicit SLO
  criteria; HTTPRoute alone is not a rollout-analysis controller;
- queue/cache-aware routing and event-driven scaling;
- one logical leader/two-shard replica with all-or-nothing readiness;
- TTFT, TPOT, goodput, queue, batch, cache, and load telemetry;
- hardening, tenant fairness, failure game day, capacity plan, and cost model;
- a mandatory document selecting one production stack and mapping each
  simulated layer to it.

Fake shards reproduce coordination, readiness, rollout, admission, and failure
behavior. They do not reproduce tensor collectives, GPU memory, NCCL/RDMA,
physical topology performance, engine kernels, or real tokens/second.

#### Required deliverables

1. architecture, request-path, control-loop, and failure diagrams;
2. pinned bootstrap and one-command verification;
3. manifests or chart plus rendered output;
4. automated smoke, fault, and cleanup tests;
5. two architecture decision records;
6. benchmark with raw data and workload definition;
7. SLO, dashboard, alert, and canary policy;
8. threat model and artifact provenance record;
9. game-day timeline, evidence bundle, post-incident actions, and runbook;
10. production-delta and capacity/cost document.

#### Mandatory failures

The assessor chooses at least four through a recorded seed and reveals the seed
and fault IDs after submission so the run is replayable:

- slow or failed startup;
- unschedulable workload;
- wrong selector or denied network path;
- worker or shard crash at a commit boundary;
- designated stateless-node drain;
- corrupt artifact;
- dependency timeout;
- metrics loss;
- canary regression;
- traffic spike or poison job.

The solution must preserve evidence, make the smallest justified repair, run a
regression check, and return the environment to a clean state.

#### Production-substitution table

| Local teaching component | Production decision |
|---|---|
| kind nodes in Docker | managed or self-managed multi-node Kubernetes, zones, upgrade policy |
| local PVC | CSI class, snapshots, replication, backup, restore, RPO/RTO |
| in-cluster PostgreSQL/Redis | operator-managed or external managed service |
| locally built image | registry, signing, SBOM, provenance, admission policy |
| Calico in kind | selected CNI, policy tier, egress/DNS design, support model |
| local Gateway controller | managed load balancer, DNS, TLS, WAF, rate limits |
| static kind capacity | node pools, quotas, priority, autoscaling, reservations |
| CPU inference simulator | chosen runtime, serving control plane, model store, accelerator |
| simulator runtime | one of vLLM, Triton, or a custom runtime |
| raw Deployment/controller | raw Kubernetes, KServe, or RayService |
| fake shard group | runtime TP/PP plus LeaderWorkerSet or KubeRay |
| custom router | InferencePool plus a maintained inference scheduler/EPP |
| fixed worker count | workload/group scaler plus node autoscaler |
| local artifact/PVC | object store plus an explicitly designed node/shared cache |
| fake topology/device labels | trusted discovery plus device plugin extended resources or DRA |
| local Prometheus/OTel | durable telemetry, retention, privacy, cost, on-call integration |

#### Capstone rubric

| Dimension | Weight |
|---|---:|
| Working behavior and automated verification | 30% |
| Failure handling and causal diagnosis | 20% |
| Architecture and Kubernetes resource choices | 15% |
| Reliability and observability | 15% |
| Security and supply chain | 10% |
| Reproducibility, documentation, and cleanup | 10% |

Passing requires at least 70% overall and no zero in security, failure handling,
or cleanup. An excellent submission explains trade-offs and uncertainty; it
does not merely contain more YAML.

---

## Visual and diagram system

Use the site's existing hand-drawn Rough.js/Excalidraw visual language, but make
the grammar consistent enough that readers can decode a diagram before reading
its labels.

### Visual grammar

| Meaning | Treatment |
|---|---|
| Kubernetes/API/control-plane object | blue outline or pale blue fill |
| host, node, runtime, or external infrastructure | gray |
| queue, database, volume, or artifact store | amber |
| model, cache, or accelerator | purple |
| health, status, metrics, logs, or traces | green |
| failure, denial, overload, or stale state | red plus an icon/label |
| data/request path | solid arrow |
| control/reconciliation path | dashed arrow |
| telemetry path | dotted arrow |
| desired state | document/tab shape |
| observed runtime state | rounded box |

Never encode meaning with color alone. Pair color with line style, labels,
icons, or fill patterns. Keep normal text and lines at accessible contrast.
Every figure needs a useful alt description and a caption that states the
takeaway, not “architecture diagram.”

### Composition rules

- One argument per plate and normally no more than seven labeled nodes.
- Prefer two or three progressive panels over one crowded “everything” image.
- Draw control and data planes separately before combining them.
- Place time left-to-right and containment outside-to-inside.
- Use consistent object silhouettes across the series.
- Show an initial state, the failure overlay in red, and recovery in green for
  break/fix labs.
- Do not use product-logo clouds. Module 21 uses layers and ownership labels.
- Use wide, zoomable figures for packet paths and physical topology because the
  current article column is narrow.
- Keep labels in HTML/SVG text where practical, not rasterized inside an image.
- Store source, exported SVG, alt text, and caption together; verify both light
  and dark themes.

### Five reusable diagram templates

1. **Manual mechanism → Kubernetes primitive → AI example**
   Example: shell watchdog → controller → serving controller.
2. **Request swimlane**
   Client, Gateway, API/router, queue, worker/model, data store, telemetry.
3. **Feedback-loop clock**
   Signal, decision, action, delay, observed result, with its time scale.
4. **Resource/topology map**
   zone → rack → node → NUMA/device/interconnect, with schedulable constraints.
5. **Failure sequence**
   numbered event timeline, ambiguous state, evidence, repair, and regression
   proof.

### Anchor figure for every module

| Module | Anchor figure |
|---:|---|
| 0 | macOS → Docker Linux VM → kind node containers → Pods |
| 1 | process → isolated container → image layers |
| 2 | manual watchdog beside spec/observe/diff/act reconciliation |
| 3 | kubectl request through API, authn, authz, admission, storage, watch |
| 4 | Pod shared boundaries and init/app/sidecar lifecycle timeline |
| 5 | Deployment/Job/StatefulSet ownership tree |
| 6 | ConfigMap, Secret, ServiceAccount projection and rotation paths |
| 7 | client → DNS → Service VIP → EndpointSlice → Pod packet path |
| 8 | external request through Gateway/Route plus allowed/denied policy matrix |
| 9 | data lifetime ladder: container, Pod, node, volume, backup |
| 10 | scheduler queue/filter/score/bind plus node resource bins |
| 11 | API security chain and layered workload threat boundaries |
| 12 | one request correlated across status, event, log, metric, and trace |
| 13 | source → immutable artifact → environment promotion → GitOps reconcile |
| 14 | probe, rollout, HPA, and node loops on separate clocks |
| 15 | diagnostic ladder from client to node |
| 16 | worker crash between side effect and acknowledgement |
| 17 | list/watch/cache/queue/reconcile/status controller loop |
| 18 | admission → queue → prefill → iterative decode → SSE timeline |
| 19 | fetch → verify → load → warm → ready cold-start waterfall |
| 20 | zone/rack/node/NUMA/device/interconnect topology |
| 21 | infrastructure → Kubernetes → controller → engine → router ownership stack |
| 22 | continuous-batching timeline beside weights/activations/KV memory blocks |
| 23 | replica, tensor, pipeline, and leader/worker layouts on physical topology |
| 24 | router, batcher, Pod scaler, and node scaler clocks |
| 25 | SLO/goodput/cost dashboard with failure overlays |
| 26 | full system architecture annotated with control, data, and telemetry paths |

The first figure in an article should be a low-detail mental model. Later
figures may reveal packets, timings, ownership, or topology. Reuse the same
figure with one changed layer when teaching progression; visual continuity
reduces cognitive load.

## Code, command, and output style

Article snippets are teaching instruments, not compressed copies of the lab
repository.

### Rules

- Keep a normal snippet to 10–30 lines and one concept.
- Use file-path captions such as
  `modules/14-reliability/manifests/worker.yaml`.
- Prefer focused diffs when changing an existing resource.
- Pin images by digest in runnable source; use a short semantic placeholder only
  when the digest would hide the lesson.
- Use fully qualified API versions and namespaced commands.
- Place the expected two-to-eight output lines immediately after a command.
- Highlight the one field that caused the behavior in prose.
- Never hide a destructive, cluster-wide, or billable step in a copy block.
- Every multiline shell block starts with strict mode in scripts and quotes
  variable expansions.
- Validate YAML, shell, Python, and application code in CI.
- Present macOS host commands separately from commands executed inside a Linux
  kind node or debug Pod.
- Redact tokens, certificate material, registry credentials, prompts, and user
  data from output.

### Example: one semantic slice

Instead of printing an entire Deployment, introduce the lifecycle contract:

```yaml
startupProbe:
  httpGet: {path: /started, port: http}
  periodSeconds: 2
  failureThreshold: 30
readinessProbe:
  httpGet: {path: /ready, port: http}
  periodSeconds: 2
livenessProbe:
  httpGet: {path: /live, port: http}
  periodSeconds: 10
```

Then make the observation explicit:

```bash
kubectl -n workbench wait pod \
  -l app=model --for=condition=Ready --timeout=90s
kubectl -n workbench get pod -l app=model \
  -o custom-columns=NAME:.metadata.name,CONTAINERS-READY:.status.containerStatuses[*].ready
```

```text
pod/model-7f8c9d condition met
NAME             CONTAINERS-READY
model-7f8c9d     true
```

Follow with a focused failure diff:

```diff
+# Remove startupProbe so liveness begins during the 20-second load.
-startupProbe:
-  httpGet: {path: /started, port: http}
-  periodSeconds: 2
-  failureThreshold: 30
 livenessProbe:
-  httpGet: {path: /live, port: http}
+  httpGet: {path: /ready, port: http}
-  periodSeconds: 10
+  periodSeconds: 2
+  failureThreshold: 3
```

Ask the reader to predict what a 20-second model load does, observe restart
count become positive and inspect `Last State`, repair it, and prove the
replacement Pod reaches Ready within the budget with restart count still zero.
The complete Deployment, test, and reset command stay in the lab repository.

### Language balance

- YAML for API intent, never YAML without the behavior it causes.
- Shell for observation and controlled mutation.
- Python only for the smallest application or controller concept.
- Go as an optional controller deep dive, not a prerequisite for application
  developers.
- PromQL and OpenTelemetry examples start from one user question.
- Pseudocode is acceptable for algorithms, but must be labeled and cannot be
  presented as a runnable lab.

## Learning aids and assessment system

### Progressive help

Every lab has two tracks using the same environment:

- **Guided:** commands, checkpoints, expected output, and short explanations.
- **Challenge:** scenario, constraints, acceptance tests, and optional hints.

Hints have three levels:

1. name the failed layer;
2. name the evidence source;
3. show the relevant command or field.

This lets a beginner finish without making the advanced reader repeat every
keystroke.

The guided lab is required for the route. A section labeled **Assignment** is
an optional portfolio-depth exercise unless it is labeled **Checkpoint**.
Checkpoints and the chosen capstone are the graded route requirements.

### Evidence packet types

Every assignment shares `evidence/`, `explanation.md`, assumptions, production
delta, and a reproducibility note. It then uses the packet that matches the
work:

| Packet | Additional artifacts |
|---|---|
| Implementation/fault | `prediction.md`, `change.diff`, `regression-test.sh`, `cleanup.txt` |
| Design/ADR | decision, alternatives, constraints, risk/failure matrix, validation plan |
| Benchmark/experiment | hypothesis, workload/config manifest, raw data, analysis notebook/report, rerun command |

For an implementation/fault packet, the explanation answers:

1. What did the reader predict?
2. What actually changed?
3. Which contract or feedback loop failed?
4. Which evidence distinguishes this cause from two alternatives?
5. Why is the repair sufficient and no broader than necessary?
6. What would differ in production?

A design/ADR packet instead explains the decision boundary, constraints,
rejected alternatives, evidence that could falsify the decision, operational
risks, and the production validation plan. A benchmark/experiment packet states
the hypothesis, controlled and uncontrolled variables, load model, metric
definitions, result with uncertainty, limitations, and the exact rerun method.

### Module-assignment rubric

| Dimension | Weight |
|---|---:|
| Correct prediction and mental model | 20% |
| Correct implementation, decision, or experiment | 25% |
| Relevant evidence | 20% |
| Causal diagnosis and rejected alternatives | 20% |
| Reliability/security/production reasoning | 10% |
| Reproducibility and cleanup where applicable | 5% |

Automated tests determine behavior, but they do not grade the reasoning. A
reader may use the solution after submitting a prediction; the learning comes
from comparing the prediction with observed state.

### Checkpoint and capstone progression

| After | Checkpoint artifact |
|---:|---|
| 5 | Containerized API operated by a Deployment and finite Job, with probes and owner evidence |
| 10 | Networked, stateful, resource-aware multi-service Workbench |
| 14 | Security, immutable delivery, correlated telemetry, rollout, disruption, and autoscaling proof |
| 17 | Crash-boundary idempotency plus a restart-safe custom controller |
| 19 | Versioned inference service with safe load, stream, canary, and rollback |
| 22 | Reproducible benchmark, capacity/topology diagnosis, and provisional framework ADR |
| 24 | Model-aware route/scaling and group-failure policy under burst, cold start, and signal loss |
| 25 | Seeded inference game day, readiness review, capacity/cost evidence, and runbook |
| 26 | Chosen software or inference capstone and oral/written design defense |

Offer an answer key that explains diagnostic choices, not only the final
manifest. Keep the first failure deterministic; introduce randomized fault
selection only after Module 14.

## Editorial voice and accessibility

- Write to a capable developer who is new to Kubernetes, not to a novice
  programmer.
- Introduce the plain-language mechanism first, then the Kubernetes term.
- Use one recurring application and name the state being protected.
- Define an acronym on first use and maintain a glossary.
- Put optional internals and cloud/GPU extensions in collapsible or clearly
  labeled sections.
- Avoid anthropomorphism such as “Kubernetes knows.” Name the API server,
  scheduler, controller, kubelet, or application.
- Say “this implementation” when behavior is CNI, CSI, Gateway-controller, or
  cloud specific.
- State uncertainty and version boundaries directly.
- Use short paragraphs, descriptive headings, and one takeaway sentence after
  a difficult mechanism.
- Provide transcript-equivalent descriptions for animated or interactive
  diagrams.
- Ensure labs do not require perfect color vision, a US keyboard layout, or
  proprietary desktop tools beyond the declared Docker Desktop baseline.
- Explain every dangerous command and offer a scoped cleanup.

The tone should remain first-principles and conversational: “Let us break the
selector and ask where the endpoints went,” not “simply configure the following
enterprise-grade manifest.”

## Integration with the current site

The current content loader expects flat `posts/<slug>/page.md` entries, sorts
them globally by date, and the article pager follows that global chronology.
Keep the storage convention, but add explicit series metadata and series-aware
navigation.

### Post naming and frontmatter

Use stable, readable slugs:

```text
posts/kubernetes-00-disposable-lab/page.md
posts/kubernetes-01-process-to-container/page.md
...
posts/kubernetes-26-capstone/page.md
```

Recommended frontmatter:

```yaml
---
title: "Kubernetes 00: Build a disposable local cluster"
description: "..."
date: "2026-09-..."
tags: [Kubernetes, Containers, Lab]
draft: true
series: kubernetes
seriesTitle: Kubernetes from first principles
module: 0
season: 1
tracks: [shared]
difficulty: foundation
resourceTier: LOCAL-CORE
clusterProfile: core
requiredAddons: []
labTime: 45
prerequisites: []
labPath: modules/00-lab
labRelease: v0.1.0
labRef: 8f4c2d1
lastVerified: "2026-08-15"
---
```

Add these optional fields to the `Post` type and declare them in the mdsvex
layout because that layout currently accepts frontmatter keys explicitly.
Validate the full series schema at build time: unique and contiguous module
numbers, dates, enums, cluster/resource profiles, add-on names, prerequisite
existence and acyclicity, lab path, immutable lab commit/ref, and retained lab
release. Do not infer order from dates or slugs, and do not let a moving default
branch violate the promise that an older article remains runnable.

Before staging draft modules, add a production route guard. The current
`getPosts()` hides drafts from lists and the API, but the slug loader imports a
matching Markdown file directly, so a guessed draft URL still renders. Use a
two-stage loader or a build-generated manifest: a server loader validates the
slug against serializable metadata and returns 404 for `draft: true` in
production, while the universal page loader imports the already-authorized
Markdown component. Do not try to return a Svelte component from
`+page.server.ts`; it is not serializable. Use an explicit authenticated preview
mechanism if draft URLs are needed.

### Series experience

Add `/learn/kubernetes` as a durable course hub:

- promise, audience routes, and prerequisites;
- season/module outline with time, difficulty, cluster profile, resource tier,
  add-ons, and status;
- “start here” and resume position stored locally without an account;
- filter for shared, software, AI, and platform routes;
- checkpoint and capstone cards;
- tested-version and last-verified notice;
- glossary, lab repository, issue template, and changelog;
- print-friendly curriculum outline.

On every series article:

- breadcrumb back to the course hub;
- stable overall module ID plus route-specific progress, for example
  `Module 7 · 8 of 18 on the Software route`;
- prerequisite links;
- series-specific previous/next navigation;
- sticky or inline progress marker with `aria-current="step"`; store completion
  by stable slug, not a numeric position that changes when modules evolve;
- lab setup summary;
- production-delta and version notice;
- “report a lab issue” link prefilled with module, architecture, versions, and
  command;
- existing site-wide older/newer pager hidden or moved below the series pager.

The ordinary `/writing` index can still list each article by publication date,
but add the course hub as a featured collection. Expand its current
LLM/agent-only description to include cloud-native and distributed systems.

### Minimal reusable components

Add only components that carry recurring semantic meaning:

- `LabSetup` — prerequisites, resource profile, time, tested versions;
- `Checkpoint` — prediction or proof the reader must make before proceeding;
- `ExpectedOutput` — a small exact or pattern-matched result;
- `Pitfall` — misconception and why it fails;
- `ProductionDelta` — what the local environment deliberately omits;
- `VersionNotice` — stable/experimental status and last verification.

Keep ordinary explanation, lists, code, and figures as mdsvex. Too many custom
cards would make the article feel like documentation scaffolding instead of an
essay.

Registration is part of the implementation: creating the Svelte files alone
does not make `<LabSetup>` available in Markdown. Either import every component
inside every post, or preferably teach `mdsvex.config.js` to rewrite the six
known tags to `Components.*` and import/export them from the module script in
`src/lib/components/markdown/layout.svelte`. Add a compile test containing
every component and fail the build on an unknown course tag.

Expand and test the Shiki language allowlist before Module 0. The current list
does not include `dockerfile` or `promql`, both required by this course. Define
one convention for unhighlighted `text`/`console` output and compile a fixture
containing every fence language used by the series.

### Diagram and social-card pipeline

Extend `scripts/generate-sketches.mjs` rather than introducing a second visual
language. Organize generators by series/module and share palette, markers,
object shapes, and typography helpers.

Before generating dozens of figures, make sketch rendering reserve explicit
dimensions and expose meaningful figure/alt content during server rendering.
The current client-side SVG injection can cause empty initial figures and
layout shift. Add a keyboard-accessible figure component that can break out of
the 42rem prose column on wide screens, open a labeled zoom view or raw SVG,
and collapse safely on mobile. Add explicit print styles for figures, semantic
lab components, and any `<details>` used for optional depth.

Generate one social-card template that consumes post metadata; the current
social-card list is manually enumerated and its output is not served from
`static` or connected automatically to `meta.image`. Emit a public asset such
as `/social/<slug>/card.png`, assign it through validated post metadata, and
test the actual Open Graph/Twitter response rather than falling back to the
favicon.

### Existing articles as bridge reading

- Module 18 links to `the-two-clocks` for prefill/decode intuition.
- Module 21 links to `agentic-rag-for-kubeflow` as a real application/platform
  boundary case.
- Module 22 links to `vllm-architecture`, `sglang-architecture`, and
  `the-two-clocks`.
- Module 24 links back to the cache-aware routing and scheduler sections of
  those serving articles.

These are optional depth links, not prerequisites. The Kubernetes series must
define the needed vocabulary locally.

## Publishing and production plan

### Phase 0 — Course infrastructure

Complete before publishing Module 0:

1. create and pin the lab repository;
2. build ARM64/AMD64 Workbench images;
3. implement preflight, verification, evidence, reset, and cleanup scripts;
4. add series frontmatter, production draft-route guard, hub, navigation, and
   registered semantic components;
5. make diagrams server-rendered, sized, accessible, and theme-safe;
6. add CI for a clean kind run of Modules 0–3;
7. create a lab issue template and version changelog.

### Phase 1 — Four-module pilot

Write Modules 0–3 completely before announcing the course. Recruit:

- two developers new to Kubernetes;
- one application developer with production Kubernetes experience;
- one AI/ML developer;
- one platform engineer.

Observe, without coaching, whether each person can:

- install the pinned toolchain;
- recover from a preflight failure;
- explain the local VM/node layers;
- use status and events to repair a broken object;
- clean up successfully.

Revise the article contract, component set, expected times, and help levels from
this pilot. Do not scale production of all diagrams until the template survives
real readers.

### Phase 2 — Seasonal release

Recommended cadence is one module per week, with a consolidation week after
each checkpoint:

| Release block | Modules | Editorial gate |
|---|---|---|
| Pilot | 0–3 | clean-machine completion and API mental-model review |
| Foundations | 4–6 | Checkpoint 1 and beginner comprehension review |
| Application path | 7–10 | Checkpoint 2 and network/storage technical review |
| Production I | 11–14 | Checkpoint 3 and security/SRE review |
| Production II | 15–17 | Checkpoint 4 and controller/distributed-systems review |
| Inference I | 18–22 | Checkpoints 5–6 and serving benchmark review |
| Inference II | 23–25 | Checkpoints 7–8 and multi-node/GPU practitioner review |
| Capstones | 26 | full clean-room run and external design review |

At one module per week plus consolidation, this is roughly an eight-month
series. Publishing can pause at the end of any season without leaving readers
with a half-taught prerequisite chain.

### Definition of done for one module

- article follows the contract and has one operational question;
- required lab passes twice from a clean pinned environment;
- reset and cleanup pass after every injected failure;
- ARM64 and AMD64 course-owned images exist;
- every command is copied from the tested lab, not retyped into the article;
- expected output is pattern-safe for non-deterministic IDs and timing;
- API stability and production delta are explicit;
- diagram has source, caption, alt description, dimensions, and theme QA;
- assignment has acceptance tests, rubric, three hint levels, and solution;
- technical review and beginner read-through are complete;
- links, spelling, frontmatter, build, and accessibility checks pass;
- `lastVerified` and lab version record are updated.

## Maintenance and version policy

Kubernetes and inference projects evolve on different clocks. Freeze the lab;
date the explanation.

### Source-of-truth order

1. Kubernetes enhancement/API documentation and official Kubernetes docs;
2. SIG or project documentation for Gateway API, kind, KServe, Kueue,
   LeaderWorkerSet, and similar components;
3. release notes and compatibility matrices;
4. peer-reviewed systems papers for algorithms and measured claims;
5. books for durable mental models;
6. explanatory articles for teaching structure and intuition.

A book or blog may explain *why*. It must not be the sole source for a current
API version, feature state, installation command, or security recommendation.

### Verification schedule

- run all `LOCAL-CORE` labs on every lab-repository change;
- run a scheduled clean build on ARM64 and AMD64;
- review stable core modules every six months;
- review `LOCAL-HEAVY`, `GPU-CLOUD`, and `VERSION-SENSITIVE` modules quarterly;
- open an automated issue when a pinned Kubernetes/add-on version leaves
  support;
- keep the previous lab release available for readers midway through a season;
- publish migrations rather than silently rewriting commands;
- display “tested,” “known working,” and “latest upstream” as three different
  concepts.

### Currency watchlist

- Kubernetes API removals and feature-state changes;
- Docker Desktop/kind networking and architecture support;
- Gateway API and controller conformance;
- CNI NetworkPolicy behavior;
- Pod Security and ServiceAccount defaults;
- metrics APIs and autoscaling behavior;
- Dynamic Resource Allocation drivers and subfeatures;
- KServe serving modes and APIs;
- vLLM, Triton, and Ray compatibility;
- LeaderWorkerSet and Kueue APIs;
- Gateway API Inference Extension maturity;
- accelerator driver/runtime matrix.

## Research and reading map

### The two editorial references

- [Kubernetes vs. age-old infrastructure
  patterns](https://iximiuz.com/en/posts/kubernetes-vs-age-old-infra-patterns/)
  supplies the manual infrastructure → Kubernetes primitive progression.
- [The feedback loops behind
  Kubernetes](https://planetscale.com/blog/the-feedback-loops-behind-kubernetes)
  supplies the operator/reconciliation progression from a manual watchdog to
  spec, status, watch, cache, queue, retry, and convergence.

Use their explanatory method, not their exact structure or artwork.

### Primary platform references

- [Docker Desktop Kubernetes](https://docs.docker.com/desktop/use-desktop/kubernetes/)
  [Docker Desktop VM architecture](https://docs.docker.com/desktop/features/vmm/),
  and [Docker Desktop GPU support](https://docs.docker.com/desktop/features/gpu/)
  for the macOS boundary.
- [kind quick start](https://kind.sigs.k8s.io/docs/user/quick-start/) and
  [Calico Kubernetes quick start](https://docs.tigera.io/calico/latest/getting-started/kubernetes/quickstart)
  for the reproducible local clusters.
- [Kubernetes objects](https://kubernetes.io/docs/concepts/overview/working-with-objects/),
  [workloads](https://kubernetes.io/docs/concepts/workloads/),
  [Services and networking](https://kubernetes.io/docs/concepts/services-networking/),
  [storage](https://kubernetes.io/docs/concepts/storage/), and
  [configuration](https://kubernetes.io/docs/concepts/configuration/) for
  Modules 2–10.
- [Gateway API introduction](https://gateway-api.sigs.k8s.io/guides/getting-started/introduction/)
  and [Envoy Gateway documentation](https://gateway.envoyproxy.io/docs/)
  and the Kubernetes
  [Ingress NGINX retirement statement](https://kubernetes.io/blog/2026/01/29/ingress-nginx-statement/)
  for Module 8.
- Kubernetes
  [security](https://kubernetes.io/docs/concepts/security/),
  [RBAC good practices](https://kubernetes.io/docs/concepts/security/rbac-good-practices/),
  and [Secret good practices](https://kubernetes.io/docs/concepts/security/secrets-good-practices/)
  for Module 11.
- Kubernetes
  [observability](https://kubernetes.io/docs/concepts/cluster-administration/observability/),
  [Horizontal Pod Autoscaling](https://kubernetes.io/docs/concepts/workloads/autoscaling/horizontal-pod-autoscale/),
  [Kustomize](https://kubernetes.io/docs/tasks/manage-kubernetes-objects/kustomization/),
  and [operators](https://kubernetes.io/docs/concepts/extend-kubernetes/operator/)
  for Modules 12–17.
- [OpenGitOps principles](https://opengitops.dev/) and
  [Argo CD documentation](https://argo-cd.readthedocs.io/en/stable/) for the
  optional GitOps implementation.

### Primary inference and accelerator references

- Kubernetes
  [GPU scheduling](https://kubernetes.io/docs/tasks/manage-gpus/scheduling-gpus/)
  and [Dynamic Resource Allocation](https://kubernetes.io/docs/concepts/scheduling-eviction/dynamic-resource-allocation/),
  with the [Kubernetes 1.34 DRA GA update](https://kubernetes.io/blog/2025/09/01/kubernetes-v1-34-dra-updates/)
  and [Kubernetes 1.35 release](https://kubernetes.io/blog/2025/12/17/kubernetes-v1-35-release/)
  for the GA-versus-always-enabled timeline,
  including [DRA administration and hardening](https://kubernetes.io/docs/concepts/cluster-administration/dra/),
  for Module 20.
- [KServe documentation](https://kserve.github.io/website/docs/intro),
  [KServe control-plane API](https://kserve.github.io/website/docs/reference/crd-api),
  and [LLMInferenceService installation](https://kserve.github.io/website/docs/admin-guide/kubernetes-deployment-llmisvc),
  [vLLM Kubernetes deployment](https://docs.vllm.ai/en/stable/deployment/k8s/),
  [vLLM production metrics](https://docs.vllm.ai/en/latest/usage/metrics/),
  [vLLM parallelism](https://docs.vllm.ai/en/latest/serving/parallelism_scaling/),
  [Triton batching](https://docs.nvidia.com/deeplearning/triton-inference-server/user-guide/docs/user_guide/batcher.html),
  [Ray Serve on Kubernetes](https://docs.ray.io/en/latest/serve/production-guide/kubernetes.html),
  and [KEDA scaling concepts](https://keda.sh/docs/2.20/concepts/scaling-deployments/)
  for Modules 21 and 24.
- [LeaderWorkerSet overview](https://lws.sigs.k8s.io/docs/overview/) and
  [Kueue topology-aware scheduling](https://kueue.sigs.k8s.io/docs/concepts/topology_aware_scheduling/)
  for Module 23.
- [Gateway API Inference Extension project
  status](https://github.com/kubernetes-sigs/gateway-api-inference-extension),
  [InferencePool API overview](https://gateway-api-inference-extension.sigs.k8s.io/concepts/api-overview/),
  and the [reference EPP warning](https://gateway-api-inference-extension.sigs.k8s.io/)
  for Module 24. InferencePool v1 is GA at the research date; Gateway
  implementation conformance and maintained-router integration remain
  `VERSION-SENSITIVE`.

### Systems papers for the inference season

- [Orca: A Distributed Serving System for Transformer-Based Generative
  Models](https://www.usenix.org/conference/osdi22/presentation/yu) for
  iteration-level scheduling.
- [Efficient Memory Management for Large Language Model Serving with
  PagedAttention](https://arxiv.org/abs/2309.06180) for vLLM and paged KV
  management.
- [Sarathi-Serve](https://www.usenix.org/conference/osdi24/presentation/agrawal)
  for chunked prefills and scheduling trade-offs.
- [DistServe](https://www.usenix.org/conference/osdi24/presentation/zhong-yinmin)
  for prefill/decode disaggregation.

Use a paper to explain the mechanism and its evaluated workload. Re-measure
claims on the chosen hardware and software version; do not turn a paper result
into a universal benchmark claim.

### Books by role in the curriculum

| Book | Best use |
|---|---|
| [*Kubernetes: Up and Running*, 3rd ed.](https://www.oreilly.com/library/view/kubernetes-up-and/9781098110192/) | concise companion for Modules 0–10 |
| [*Kubernetes in Action*, 2nd ed.](https://livebook.manning.com/book/kubernetes-in-action-second-edition/) | deeper application-centric explanation across Modules 0–17 |
| [*Kubernetes Patterns*, 2nd ed.](https://www.oreilly.com/library/view/kubernetes-patterns-2nd/9781098131678/) | reusable workload and controller patterns for Modules 4, 14, 16, 17 |
| [*Kubernetes Best Practices*, 2nd ed.](https://www.oreilly.com/library/view/kubernetes-best-practices/9781098142155/) | production review for Modules 10–15 |
| [*Networking and Kubernetes*](https://www.oreilly.com/library/view/networking-and-kubernetes/9781492081647/) | packet, CNI, policy, DNS, and service depth for Modules 7–8 |
| [*Programming Kubernetes*](https://www.oreilly.com/library/view/programming-kubernetes/9781492047094/) | API machinery, CRDs, and controllers for Module 17 |
| [*Production Kubernetes*](https://www.oreilly.com/library/view/production-kubernetes/9781492092292/) | cluster/platform trade-offs and the production bridge |
| [*Container Security*](https://www.oreilly.com/library/view/container-security/9781492056690/) | Linux/container threat model and Module 11 depth |
| [*Site Reliability Engineering*](https://sre.google/sre-book/table-of-contents/) and [*The SRE Workbook*](https://sre.google/workbook/table-of-contents/) | SLOs, alerting, overload, and incident practice |
| [*Designing Data-Intensive Applications*, 2nd ed.](https://www.oreilly.com/library/view/designing-data-intensive-applications/9781098119058/) | replication, queues, coordination, and failure semantics |
| [*Designing Machine Learning Systems*](https://www.oreilly.com/library/view/designing-machine-learning/9781098107956/) | model release, monitoring, data shift, and production ML context |
| [*Generative AI on Kubernetes*](https://www.oreilly.com/library/view/generative-ai-on/9781098171919/) | current AI-platform companion for Modules 18–25 |

Do not require every book. Put one “go deeper” box at the end of a module with
the exact relevant chapter or topic after the edition is checked. Official docs
remain the required reading.

## Recommended first deliverable

Do not begin by drafting all 27 articles. Build one vertical slice:

1. course hub shell and metadata support;
2. pinned lab repository with Workbench API and simulator skeleton;
3. Module 0, including a clean-machine preflight;
4. Module 2, proving reconciliation through failure;
5. Module 7, tracing a packet through DNS, Service, EndpointSlice, and Pod;
6. one checkpoint page;
7. five diagrams covering local layers, feedback loop, packet path, failure
   sequence, and evidence packet.

This slice tests installation, the teaching thesis, networking depth, lab
automation, series navigation, diagram rendering, and assessment format before
the largest writing investment.

The strongest opening sequence is still published in dependency order
(Modules 0–3). Module 7 is an internal prototype because networking exposes
weak lab and diagram design early; publish it only after Modules 4–6.
