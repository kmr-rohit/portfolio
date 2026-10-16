---
title: "Service Discovery"
summary: "Your orders service needs to call the payments service. So it needs an address."
stage: 8
stageName: "Services and infrastructure"
tier: "useful"
seq: 59
tags: ["service-discovery", "microservices", "infrastructure"]
---

Your orders service needs to call the payments service. So it needs an address.

In a world of fixed servers that's a config file and you're done. In a world where instances are created and destroyed by an autoscaler, crash and get rescheduled onto different machines, and roll during every deploy, that config file is wrong within the hour.

---

## Why the config file stops working

Start with the honest baseline: hardcode `payments.internal:8080` and point it at a machine. This works, and for a small fixed fleet it can work for years. Don't sneer at it.

It breaks when instances stop being pets.

**Autoscaling** means the number of payment instances changes with load, and the new ones have addresses nobody wrote down. **Container orchestration** means a crashed instance comes back on a different host with a different IP. **Rolling deploys** mean that during every release, some fraction of your addresses point at containers that are shutting down.

The common thread: the set of instances behind a name is now changing continuously, and no static file can track it.

So something has to answer "where is `payments` right now?" at call time.

---

## The registry

The core piece is a **service registry** — a database of currently-live instances, keyed by service name.

```
payments → 10.0.0.4:8080  (healthy, registered 14:02)
           10.0.0.9:8080  (healthy, registered 14:07)
           10.0.1.2:8080  (healthy, registered 14:31)
```

Two questions follow immediately: how do entries get in, and how do dead ones get out.

**Getting in** is either self-registration — the instance calls the registry on startup and deregisters on shutdown — or third-party registration, where the orchestrator registers on the instance's behalf because it already knows what it started. Kubernetes does the latter, which is why nothing in your application code knows the registry exists.

**Getting out** is the harder half, and it's the part that catches people. Graceful shutdown deregisters cleanly. A process that segfaults, a machine that loses power, or a network partition deregisters nothing at all.

So the registry can't trust registration alone. It **health-checks** — either polling each instance's `/health`, or requiring instances to renew a lease that expires if they go quiet. That second pattern should look familiar: it's the same trick as [TTL as a Coordination Primitive](/learn/system-design/ttl-as-a-coordination-primitive), where absence of a write is the signal.

And this is why a health check that only returns `200 OK` is nearly useless. If it doesn't verify the instance can reach its database, you'll happily route traffic to a process that's up and unable to do anything.

---

## Two places to put the lookup

<figure class="sd-figure"><img src="/system-design/diagrams/service-discovery.svg" alt="Diagram: Service Discovery" loading="lazy" decoding="async" /></figure>

**Client-side discovery.** The caller asks the registry for the instance list, caches it, and picks one itself. It's doing its own load balancing.

One fewer network hop, and the client can be clever — it can prefer instances in its own availability zone, or track which ones are responding slowly. The cost is that every client, in every language you use, needs a library implementing registry lookup, caching, refresh and balancing. Netflix's Eureka and Ribbon worked this way.

**Server-side discovery.** The caller sends its request to a stable address — a load balancer or a virtual IP — and *that* consults the registry and forwards. Clients stay dumb: they just call `http://payments/`.

This is what Kubernetes Services do. Your code calls a DNS name, `kube-proxy` or the mesh handles the rest, and your application never learns that discovery is happening. It's the dominant model now, mainly because "no client library" beats "clever client" once you have more than two languages.

---

## Why not just use DNS?

It's the obvious question, and DNS *is* a distributed lookup from names to addresses — exactly the shape we want. Plenty of systems do use it.

The problem is **TTL**. A DNS record says "this is valid for 60 seconds", and clients cache accordingly. So for up to a minute after an instance dies, clients will keep resolving to it and failing.

Worse, plenty of clients ignore the TTL entirely. The JVM famously used to cache DNS lookups forever by default. A resolver that honours nothing will hold a dead address indefinitely.

And DNS has no notion of health. It returns addresses; it has no idea whether anything is listening. → [DNS](/learn/system-design/dns)

So DNS-based discovery works when instance churn is slow relative to your TTL. It falls down when instances turn over in seconds, which is the whole point of containers.

---

## Service meshes

The current answer, and worth understanding because it reframes the problem.

A **service mesh** runs a sidecar proxy — usually Envoy — next to every service instance. Your application makes a plain HTTP call to `localhost`; the sidecar intercepts it, looks up a healthy instance, load-balances, retries on failure, enforces timeouts, collects metrics and encrypts the hop with mTLS. → [SSL TLS and mTLS](/learn/system-design/ssl-tls-and-mtls)

The move here is that discovery, balancing, retries and encryption all leave your application code and become infrastructure. You get them uniformly across every language, and you configure them declaratively rather than in a client library.

The cost is real: another proxy per instance, more moving parts, more memory, and a control plane your team now has to understand when it misbehaves. Istio's reputation for complexity is earned. For a handful of services it's over-engineering; at a few hundred it starts paying for itself.

---

## The registry is now critical infrastructure

If the registry is down, nothing can find anything. Which makes it a prime candidate for the failure modes in [Clustering](/learn/system-design/clustering).

Real registries run as replicated clusters with consensus — **etcd** and **ZooKeeper** use Raft and ZAB respectively, **Consul** uses Raft. That gives them a consistent view of membership and tolerance of minority failures.

The practical mitigation on top is that **clients cache**. If the registry goes away, callers keep using the last known good instance list and degrade rather than stop. That's the right trade: a slightly stale address list is much better than no address list, and it's the same reasoning as the cached shard directory in [Caching Strategies](/learn/system-design/caching-strategies).

---

## Where this shows up

- **Kubernetes** — Services plus CoreDNS, with the orchestrator doing registration.
- **Consul, etcd, ZooKeeper** as standalone registries.
- **Istio, Linkerd** as meshes doing discovery along with everything else.
- **Uber's Ringpop**, which solves a related problem — nodes gossiping membership so any node can route — and whose documented limit is that gossip convergence slows as the ring grows. → 12 - How Uber Actually Does It

---

## In an interview

You usually don't need to design this — say "service discovery via Kubernetes Services" or "Consul" and move on. Spending five minutes on it is a scoping mistake.

Where it earns you something is when the interviewer asks how a service finds another one, or how you handle an instance dying. The answer that lands is the *health-check* half: registration is easy, and the interesting problem is evicting instances that died without telling anyone.

If you propose a mesh, be ready to justify the operational cost. "Istio" as a reflex for three services is a red flag; "at this scale, DNS-based discovery is fine" is a better answer than most candidates give.

---

## Seen in
- Chat System · Routing Messages — a connection registry maps each user to the server holding their WebSocket, which is service discovery at per-user granularity, and the chapter then shows why you might drop it
- Yelp · Scaling the Pub-Sub Layer — each server watches the hash ring in a coordination store to find which node owns a channel
- Rate Limiter · Rules and Hot Reload — limiter nodes pick up rule changes by watching a config store, the same mechanism discovery uses

## Related
[Clustering](/learn/system-design/clustering) · [Load Balancing](/learn/system-design/load-balancing) · [DNS](/learn/system-design/dns) · [API Gateway](/learn/system-design/api-gateway) · [Monoliths and Microservices](/learn/system-design/monoliths-and-microservices) · [VMs and Containers](/learn/system-design/vms-and-containers) · [SSL TLS and mTLS](/learn/system-design/ssl-tls-and-mtls) · [Caching Strategies](/learn/system-design/caching-strategies)

## Sources
- [Kubernetes: Service](https://kubernetes.io/docs/concepts/services-networking/service/)
- [HashiCorp Consul: Service discovery](https://developer.hashicorp.com/consul/docs/concepts/service-discovery)
- [Microservices.io: Client-side and server-side discovery](https://microservices.io/patterns/client-side-discovery.html)
- [Istio: Traffic management](https://istio.io/latest/docs/concepts/traffic-management/)
