---
title: "Kubernetes 00: Where is the cluster, really?"
description: "Build a tiny Kubernetes cluster on your Mac, look inside it, delete it safely, and build the same shape again."
date: "2026-08-14"
tags: [Kubernetes, Containers, Lab]
draft: false
series: kubernetes
seriesTitle: Kubernetes from first principles
module: 0
season: 1
tracks: [shared]
difficulty: foundation
resourceTier: LOCAL-CORE
clusterProfile: core
labRuntime: kubernetes
labTime: 45
prerequisites: []
labPath: "labs/kubernetes"
lastVerified: "2026-08-15"
---

Imagine that an application stops at 3 a.m. Someone must notice, restart it, and check that it works again. Now imagine doing that for hundreds of applications across many machines. **Kubernetes** automates much of that repeated operating work. You describe what should be running; Kubernetes keeps checking and tries to make reality match.

We will begin with just enough vocabulary to build a tiny version on one Mac:

- A running program is a **process**.
- A **container** is a process packaged with the files it needs and given boundaries. It is not a complete computer.
- A **node** is a Linux machine where Kubernetes can run work.
- A **cluster** is the complete Kubernetes system: its nodes plus the software that manages them.
- That managing software is called the **control plane**. It accepts requests and decides what should run where.
- Kubernetes places one or more containers inside a wrapper called a **Pod**. For now, read “Pod” as “the smallest application unit Kubernetes starts.”
- `kubectl` (pronounced “kube control”) is the command-line tool we use to talk to the cluster.

Do not try to memorize that list. The lab will show every item. Our first question is simply: **when `kubectl` says a node is `Ready`, where is that node actually running?** Predict the answer, then prove it.

The lab takes about 45 minutes. `LOCAL-CORE` is simply the course name for its laptop-sized setup: a Mac with at least 16 gigabytes (GB) of memory and four processor cores. Docker Desktop must have 8 gibibytes (GiB) of memory allocated. Its Linux environment reports slightly less usable memory because it has overhead; the first check allows for that.

By the end, you will be able to recreate the same cluster from fixed-version inputs, explain its four layers, choose it safely with `kubectl`, and delete only the lab resources.

## First decide whether you need Kubernetes

Kubernetes helps when many applications and machines must keep matching a goal. A **workload** is simply an application or task you ask it to run. Kubernetes can choose a node for that work, restart it after a failure, move from an old version to a new one, connect it to other services, and apply the same rules across a team.

That automation is not free. Someone still has to look after networking, stored data, access, upgrades, monitoring, and failures. Start with the smallest option that solves the real problem:

- One long-running program may only need a hosting service or a tool that restarts it if it stops.
- A few services on one machine may fit Docker Compose.
- A web application may fit a managed platform that handles builds, secure web traffic, deployment, and scaling.
- Occasional AI model requests may fit a managed model API.
- Kubernetes becomes useful when applications must be placed and recovered across several machines, or when many teams need one consistent operating system for their services.

With managed Kubernetes, a cloud provider runs part of the control plane, but your team still has work. An application team normally owns its container image—the package used to start a container—plus how the app reports health, how much CPU and memory it needs, and how it treats data. A platform team normally owns the cluster's machines, networking, storage, access rules, and upgrades.

Write down one workload you know. Choose its simplest adequate home, then name the requirement that would force a move to the next option. Keep the answer; later modules should sharpen it.

## Map the four layers before building

On macOS, Linux containers need a Linux **kernel**, the central part of the operating system that manages processes, memory, devices, and networking. Docker Desktop supplies one by running a lightweight Linux **virtual machine (VM)**, a computer created in software. The Mac is the **host**, meaning the physical computer underneath. The [Docker Desktop documentation](https://docs.docker.com/desktop/setup/install/mac-permission-requirements/#containers-running-as-root-within-the-linux-vm) describes this boundary.

Inside that VM, the **Docker Engine** creates and manages containers. This lab uses **kind**, short for Kubernetes IN Docker, to create two special containers that act as Kubernetes nodes. This is [kind's documented model](https://kind.sigs.k8s.io/docs/user/quick-start/).

Inside each node container:

- `kubelet` is the node's worker agent. It makes sure assigned Pods are running.
- `containerd` starts and stops the actual containers.
- The control-plane node also has an API server (the front door), a scheduler (chooses a node), controllers (notice and repair differences), and `etcd` (stores the cluster's data).

Those names are labels for the diagram, not a memorization test.

So the path is:

**Mac and `kubectl` → Docker Desktop Linux VM → kind node containers → Pods and their application containers**

![A Ready kind node is a Docker container inside Docker Desktop's Linux VM—not the Mac or an independent machine.](/sketches/kubernetes-local-layers.svg)

Draw that path before you run anything. The important correction is that the Mac does not become a node. The two nodes are separate containers, but they still share one VM, laptop, kernel, network path, disk, and power source. This lab can simulate scheduling and a stopped node; it cannot simulate independent racks or failure zones.

Docker Desktop may also offer its own Kubernetes cluster. This lab still uses kind; the built-in cluster and the kind cluster are separate systems.

## Get the lab files once

The commands in this course use files stored in the same GitHub repository as this website. A **repository**, or repo, is simply a project folder whose changes are tracked with Git.

If you already cloned the portfolio repo, open Terminal, move into its top-level `portfolio` folder, and continue. Otherwise, run:

```bash
git clone https://github.com/kmr-rohit/portfolio.git
cd portfolio
```

If Git is unfamiliar, [download the repo as a ZIP file](https://github.com/kmr-rohit/portfolio/archive/refs/heads/main.zip), unzip it, rename the resulting folder to `portfolio` if you like, and open Terminal in that folder. Every course command block marked **Lab command** also has a **Files** link. It opens the exact lab folder on GitHub so you can inspect the scripts before running them.

The top-level `portfolio` folder is what later instructions call the **repository root**. You only need to download or clone it once.

The lab uses a few small command-line tools. Their jobs are easier to remember than their names:

- [Docker Desktop](https://docs.docker.com/desktop/setup/install/mac-install/) runs the Linux containers.
- [kind](https://kind.sigs.k8s.io/docs/user/quick-start/#installation) creates the local Kubernetes nodes.
- [kubectl](https://kubernetes.io/docs/tasks/tools/install-kubectl-macos/) sends commands to Kubernetes.
- `jq` reads the lab's JSON reports.
- `make` gives longer scripts short names, such as `cluster-up`.
- `git` downloads the repo, and `curl` makes test web requests.

On a Mac with [Homebrew](https://brew.sh/), install the tools that macOS does not normally include:

```bash
brew install kind kubectl jq
```

Apple's Command Line Tools provide `git` and `make`; run `xcode-select --install` if either is missing. Docker Desktop includes the `docker compose` and `docker buildx` commands used in Module 01. The next step checks every requirement and prints the name of anything missing or at the wrong version.

## Check the machine before changing it

A **preflight** is a set of checks before take-off. This one stops early if a requirement is missing, before it changes your machine. From the repository root, run:

```bash
make -C labs/kubernetes preflight
```

This release **pins**, or fixes, kind at `v0.32.0` and Kubernetes at `v1.36.1`. Every recorded check should say `pass`, followed by this stable marker:

```bash
pass  macOS host — Darwin
pass  host architecture — arm64
...
pass  kind version pin — kind v0.32.0 ...
pass  kubectl version skew — client minor 36 is within 35-37 for server minor 36
pass  Docker Desktop Linux VM — Docker Desktop ...|linux|...
pass  Docker Desktop memory — ... bytes
Preflight report: ./evidence/module-00/preflight.json
MODULE 0 PREFLIGHT PASSED
```

Paths, memory totals, and patch versions can vary. Apple Silicon reports `arm64`; Intel reports `x86_64`. Do not continue after a failed check. Fix the named problem and rerun the same target, so later results have a clear foundation.

Why check versions? `kubectl` and the cluster must understand the same Kubernetes language. Kubernetes' [compatibility rule](https://kubernetes.io/releases/version-skew-policy/) allows `kubectl` to be one minor version older or newer than the API server. “Minor” is the middle number: 36 in `v1.36.1`. This lab therefore accepts `kubectl` 1.35 through 1.37. The final number may differ.

## Create, verify, and repeat the cluster

Before setup, three related words matter:

- A **kubeconfig** is the file that tells `kubectl` where clusters are and how to connect to them.
- A **context** is a saved selection inside that file: one cluster, one user identity, and sometimes one default namespace.
- A **namespace** is a named group of Kubernetes objects, similar to a project folder. It is not another cluster or another node, and it is not a security wall by itself.

Create the `core` profile—the course's basic two-node cluster:

```bash
make -C labs/kubernetes cluster-up
```

The target creates the pinned two-node cluster, waits for its API and nodes, and restores whichever context was selected before setup. Look for:

```bash
PASS: cluster API reports two Ready nodes through context kind-k8s-learning
MODULE 0 CLUSTER READY
```

Now run the independent acceptance check. One line mentions **CoreDNS**, the built-in component that lets applications find one another by name:

```bash
make -C labs/kubernetes verify
```

It should end with these assertions:

```bash
PASS: Docker has exactly the pinned control-plane and worker containers
PASS: kubeconfig contains context kind-k8s-learning
PASS: all nodes report Ready
PASS: API server is pinned to v1.36.1 (found v1.36.1)
PASS: CoreDNS deployment is Available
MODULE 0 VERIFIED
```

Run `cluster-up` once more. It should converge on the same healthy cluster, not create another one or fail. This property is called **idempotence**: repeating the operation has the same intended result.

## Observe each layer separately

Ask Docker what containers it created:

```bash
docker ps --filter label=io.x-k8s.kind.cluster=k8s-learning
```

You should see one control-plane container and one worker container. Docker reporting them as running does not prove their Kubernetes nodes are Ready; those are different layers.

Now ask the Kubernetes API through the lab context:

```bash
kubectl --context kind-k8s-learning cluster-info
kubectl --context kind-k8s-learning get nodes -o wide
kubectl --context kind-k8s-learning version --output=yaml
```

A healthy result includes:

```bash
Kubernetes control plane is running at https://127.0.0.1:<port>

NAME                         STATUS   ROLES           VERSION   OS-IMAGE
k8s-learning-control-plane   Ready    control-plane   v1.36.1   Debian GNU/Linux
k8s-learning-worker          Ready    <none>          v1.36.1   Debian GNU/Linux
```

The version output should contain:

```yaml
clientVersion:
  gitVersion: v1.36.x
serverVersion:
  gitVersion: v1.36.1
```

The `127.0.0.1` address is a Docker port exposed back to the Mac. `OS-IMAGE` describes Linux inside the node container, not macOS. The version beside a node is its kubelet version; `serverVersion` is the API server; `clientVersion` is host-side `kubectl`.

Inspect the built-in workload and the **StorageClasses**, cluster-wide objects that describe ways to provide persistent storage:

```bash
kubectl --context kind-k8s-learning -n kube-system get pods -o wide
kubectl --context kind-k8s-learning get storageclass
```

`-n kube-system` selects the namespace holding Kubernetes' own Pods. Expect the API server, `etcd`, scheduler, controller manager, `kube-proxy`, and CoreDNS, which provides name lookup inside the cluster. The [Kubernetes components overview](https://kubernetes.io/docs/concepts/overview/components/) explains their jobs. The StorageClass command is inventory only; Module 0 does not require a default class. StorageClasses and Nodes are cluster-wide, so a namespace does not narrow them.

Finally, inspect selection without printing secrets:

```bash
kubectl config get-contexts
kubectl config current-context
kubectl --context kind-k8s-learning config view --minify
```

The explicit `--context` chooses the lab without changing your default. A Docker context chooses a Docker Engine; a `kubectl` context chooses a Kubernetes API and credentials. They are unrelated selectors. Read the official [kubeconfig](https://kubernetes.io/docs/concepts/configuration/organize-cluster-access-kubeconfig/) and [namespace](https://kubernetes.io/docs/concepts/overview/working-with-objects/namespaces/) documentation before combining environments. Avoid command aliases on this first pass; seeing the resource, namespace, and output options is useful.

## Destroy, rebuild, and compare

First save a healthy baseline outside the cluster:

```bash
make -C labs/kubernetes evidence
```

Then remove only this course cluster:

```bash
make -C labs/kubernetes cluster-down
```

This removes its kind node containers, network, and kubeconfig entries. It must not prune Docker globally, remove unrelated volumes, or delete other kind clusters.

Verification should now fail quickly:

```bash
make -C labs/kubernetes verify
```

```bash
ERROR: kind cluster 'k8s-learning' does not exist; run 'make cluster-up'
make: *** [verify] Error 1
```

The cluster API and nodes are gone, but the repository and saved evidence remain on the Mac. Recreate the cluster and prove the contract again:

```bash
make -C labs/kubernetes cluster-up
make -C labs/kubernetes verify
make -C labs/kubernetes evidence
```

The replacement should have the same two-node shape, fixed versions, basic services, and Ready status. Generated identifiers, timestamps, ports, and container addresses may change. Repeatability means stable promises, not identical temporary details.

Later, reset only an application's namespace for ordinary exercises. Rebuild the whole cluster when you change its node layout, networking, optional Kubernetes features, control-plane settings, or deliberately damage cluster-wide state.

## Collect evidence without collecting secrets

After the rebuilt cluster passes, generate the final packet:

```bash
make -C labs/kubernetes evidence
```

The path prefix depends on your clone location. The stable suffix and marker are:

```bash
Evidence: .../labs/kubernetes/evidence/module-00/cluster
MODULE 0 EVIDENCE COLLECTED
```

The packet under `labs/kubernetes/evidence/module-00/cluster/` records preflight facts, tool versions, context, nodes, system Pods, Domain Name System (DNS), and storage inventory. It should identify the release and computer architecture without relying on memory.

Never submit a raw kubeconfig, private key, token, or certificate material. A redacted summary proves identity, version, topology, conditions, and assertions without exposing credentials.

This evidence shows that the pinned lab can be recreated, its API can be reached, its expected nodes become Ready, and its core checks pass on this architecture. It does **not** show production readiness:

- Both nodes share one laptop, VM, kernel, network path, disk, and power source.
- The control plane is not highly available across multiple failure zones.
- Local storage does not prove durable cloud storage, backup, restore, or disaster recovery.
- A loopback (local-only) port does not model a production load balancer, firewall, identity system, or DNS.
- A quiet laptop test does not prove capacity, upgrade safety, security posture, monitoring, or on-call recovery.

The local cluster is still valuable: it lets you learn Kubernetes API and controller behavior cheaply. Production claims need production-shaped systems and evidence.

## Clean up and explain what you learned

When finished, remove the course cluster:

```bash
make -C labs/kubernetes cluster-down
```

Run it a second time. Cleanup should be idempotent: an already absent cluster is success, and unrelated Docker resources remain untouched. Keep the evidence packet if you are submitting the assignment. Successful cleanup ends with:

```bash
MODULE 0 CLUSTER REMOVED
```

Submit the machine-readable preflight report and a one-page diagram that follows a command from your terminal to an eventual application process. Label the Mac host, Linux kernel, Docker Engine, kind node containers, containerd, kubelet, API server, `kubectl`, Pod, and application process. Add a short note answering: which boundaries provide real isolation, and which apparent nodes can still fail together because they share one laptop?

Use this rubric:

- **Correct prediction and mental model — 20%:** state the initial prediction, then correct any Mac-as-node or container-as-VM confusion.
- **Correct implementation — 25%:** use the supplied targets for preflight, creation, verification, rebuild, and cleanup.
- **Relevant evidence — 20%:** identify architecture, versions, context, nodes, core components, DNS, and storage without secrets.
- **Causal explanation — 20%:** distinguish Docker container health from Kubernetes Node readiness and reject at least two plausible wrong layer explanations.
- **Production reasoning — 10%:** name the shared laptop failure domain and at least two missing production capabilities.
- **Reproducibility and cleanup — 5%:** give an exact rerun path and complete the scoped cleanup twice.

Without rerunning the lab, answer:

1. When `kubectl get nodes` reports Linux on a Mac, which boundaries did the request cross?
2. What does a `kubectl` context select, and why does changing its namespace not select another cluster?
3. Why can a stopped kind node simulate node failure but not rack or power failure?
4. Which facts stay stable after a rebuild, and which temporary identifiers change?

Keep this mental model: **on a Mac, host-side `kubectl` talks through Docker Desktop to a Kubernetes API inside Linux node containers. Observe each layer on its own terms.**
