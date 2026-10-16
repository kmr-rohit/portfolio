---
title: "Scalability"
summary: "Scalability isn't \"can it handle a lot of traffic.\" It's \"when the traffic doubles, what do I have to do, and does it still work?\" A system that handles a million requests a second but requires a three-month rewrite to handle two million is not scalable — it's just big."
stage: 1
stageName: "Foundations"
tier: "core"
seq: 4
tags: ["scalability", "horizontal-scaling", "statelessness", "autoscaling"]
---

Scalability isn't "can it handle a lot of traffic." It's "when the traffic doubles, what do I have to do, and does it still work?" A system that handles a million requests a second but requires a three-month rewrite to handle two million is not scalable — it's just big.

The best way to understand it is to grow one system until each approach breaks.

## A URL shortener, day one

You ship a link shortener. One 4-vCPU virtual machine runs the API and PostgreSQL side by side. Two endpoints: `POST /shorten` writes a row, `GET /:code` reads one.

Traffic is 500 reads and 50 writes a second. The box sits at 15% CPU. Life is good, your architecture diagram is a rectangle, and you are correct to have built it this way.

Then you get written up somewhere and traffic goes 10x. 5,000 reads a second. CPU is pegged, p99 latency has gone from 12ms to 900ms, and requests are timing out.

## Try the obvious thing: buy a bigger box

You resize the VM from 4 vCPUs to 32 and give it four times the RAM. Ten minutes of downtime during the resize. CPU drops back to 20%, latency goes back to 12ms, and you go to lunch.

That's **vertical scaling**, and it is genuinely the right first move far more often than interview folklore admits. It required zero code changes, introduced zero new failure modes, and it bought you an order of magnitude. Modern single machines are enormous — hundreds of cores, terabytes of RAM, NVMe measured in millions of IOPS. A great many systems never need anything else.

Then traffic 10x again. 50,000 reads a second.

Now vertical scaling starts failing you in four separate ways, and it's worth naming them separately because they're different problems.

**There's a biggest box.** The instance catalogue runs out. When you reach the top of it, the next 10x has nowhere to come from.

**The price curve bends the wrong way.** Going from 4 to 8 vCPUs roughly doubles the bill. Going from the second-largest to the largest instance type frequently costs far more than double for far less than double the capacity, because you're paying a scarcity premium.

**Resizing means downtime.** Every capacity change is a restart. You can't do it during the spike, which is exactly when you want to.

**It's one failure domain.** One machine, one kernel, one power supply, one bad `apt upgrade`. However big it is, it is still a single point of failure, and a single point of failure has an availability ceiling no amount of CPU can raise. → [Availability](/learn/system-design/availability)

## Horizontal scaling, and the thing that immediately breaks

So you go wide: a load balancer in front, ten app servers behind it, database moved onto its own machine. → [Load Balancing](/learn/system-design/load-balancing)

You deploy. Within a minute, support is flooded with "it keeps logging me out."

Here's what happened. A user signs in and hits app server 3, which creates a session and stores it in a local `HashMap` in that process's memory. The next request from that user goes through the load balancer, which round-robins it to app server 7. Server 7 has never heard of this session. It sees an unauthenticated request and bounces the user to the login page.

The quick patch is **sticky sessions** — configure the load balancer to hash the client to a fixed backend. It works, and it quietly poisons everything downstream. A deploy restarts server 3 and logs out everyone pinned to it. A scale-in event does the same. Your traffic distribution is now determined by which clients happened to land where, so one server ends up at 90% CPU while another sits at 20%. And you can never do a clean rolling restart again.

The real fix is to remove the reason the request cares which machine it lands on.

## Statelessness is the precondition, not a bonus

**A stateless server is one where every request carries everything needed to serve it.** The auth token, the parameters, the body. Nothing is remembered between requests.

When that's true, any server can serve any request, and horizontal scaling becomes a load balancer configuration problem instead of an application architecture problem. You can add a machine, kill a machine, or replace all of them during a deploy, and no user notices.

Making the shortener stateless means hunting down every place state leaked into a process:

- **Sessions** → move to a shared store (Redis), or make the token self-contained and signed so no lookup is needed at all.
- **In-process caches** → fine as a latency optimisation, but the correctness of a response must never depend on which server's cache you hit. Give each server its own and let them be independently wrong-but-fresh-enough. → [Caching Strategies](/learn/system-design/caching-strategies)
- **Uploaded files on local disk** → object storage.
- **Rate-limit counters in memory** → a shared counter, otherwise a user gets N times their quota across N servers. → [Rate Limiting](/learn/system-design/rate-limiting)
- **Scheduled jobs running on every instance** → a leader election or an external scheduler, or you'll send every email ten times.

<aside class="sd-callout sd-callout--note">

<p class="sd-callout-title">Some state genuinely can't be moved</p>

A WebSocket connection is inherently pinned to the machine holding the socket. You don't fix that by pretending it's stateless — you fix it by keeping a registry of *which server holds which connection*, so any machine can look up where to deliver a message. The connection stays stateful; the routing decision becomes stateless. → [Real-Time Server Push](/learn/system-design/real-time-server-push)

</aside>

## Reads and writes are not the same problem

The app tier now scales by adding boxes. Traffic 10x again and the bottleneck moves to the database, where the two directions behave completely differently.

**Reads are copyable.** Add read replicas, put a cache in front, and each additional copy adds real read capacity. You can serve a read from anywhere that has a copy of the data. What it costs you is freshness: a replica is behind the primary by some replication lag, and a cache is behind by up to its TTL. So read scaling is mostly the discipline of deciding, per call site, how stale is acceptable. → [Replication and Read Consistency](/learn/system-design/replication-and-read-consistency)

**Writes are not copyable, and this is the part people get wrong.** Adding a read replica does not add write capacity — it *subtracts* it. Every replica has to apply the entire write stream. Ten replicas don't share the writes between them; all ten do all of them. You've added ten times the read capacity and zero times the write capacity, plus the replication bandwidth.

The only thing that adds write capacity is splitting the data so different machines own different rows. That's sharding, and the moment you do it you inherit a new set of problems: choosing a key that spreads load evenly, queries that now have to hit every shard, and transactions that span two of them. → [Sharding and Partitioning](/learn/system-design/sharding-and-partitioning) · [Avoiding Distributed Transactions](/learn/system-design/avoiding-distributed-transactions)

Before you shard, the cheaper write-side moves are worth naming. Batch many small writes into fewer large ones. Put a queue in front so a burst becomes a backlog instead of a timeout, and shed load explicitly when the backlog grows rather than letting everything degrade at once. Pre-aggregate hierarchically so the hot counter isn't a single row.

## Why 2x the machines never gives you 2x the throughput

You've been adding app servers happily. Ten servers gave you roughly ten times one server's throughput. So a hundred should give a hundred, right?

Try it and you'll find you got about seventeen. Go to two hundred and it may actually get *worse*.

There are two distinct taxes, and Neil Gunther's **Universal Scalability Law** names them both:

```
X(N) = γN / (1 + α(N−1) + βN(N−1))

  N = number of workers
  γ = throughput of one worker
  α = contention  — queueing for something shared      (grows with N)
  β = coherency   — keeping shared state in agreement  (grows with N²)
```

**Contention (α)** is waiting in line for a shared resource. There's one database, one lock, one load balancer, one connection pool. Amdahl's Law is the same idea in its simplest form: if 5% of the work is inherently serial, your maximum speedup is 20x however many machines you buy. Set α = 0.05 and β = 0 and watch what the formula does:

```
N =   10  →   6.9x
N =  100  →  16.8x        (not 100x)
N = 1000  →  19.6x        (ceiling is 1/α = 20x)
```

Going from 100 machines to 1,000 machines bought you 17%. That's contention: throughput flattens into a ceiling.

**Coherency (β)** is worse. It's the cost of keeping shared, mutable state consistent across participants — and the work grows with the number of *pairs* who might need to agree, which grows as N². Add even a tiny bit of it:

```
α = 0.05,  β = 0.001

N =   10  →  6.5x
N =   30  →  9.0x     ← peak
N =  100  →  6.3x     ← worse than 30 machines
```

Throughput doesn't plateau. It goes **retrograde**. You add machines and get less work done. The peak sits at N* = √((1−α)/β), which for these numbers is about 31.

That's not a theoretical curiosity — here's the concrete version in your shortener. Each app server keeps a pool of 50 database connections. At 200 app servers that's 10,000 connections opened against PostgreSQL, whose default `max_connections` is 100 and which sizes shared memory directly off that setting. Long before you hit 10,000 the database is spending its time context-switching between connections instead of answering queries. Adding the 201st app server makes the system slower. The fix is a connection pooler like PgBouncer, which is really just "stop letting N grow on the contended resource."

Gossip protocols, distributed locks, cross-node cache invalidation and consensus rounds are all β. Anything where every node has to tell every other node something.

<aside class="sd-callout sd-callout--tip">

<p class="sd-callout-title">The move this gives you in an interview</p>

When someone asks "what if we just add more servers?", the strong answer isn't yes or no — it's "which resource do they all share?" Naming the shared resource is naming α. Naming the thing they all have to agree on is naming β. That's the difference between a candidate who knows the word *horizontal* and one who knows why it stops working.

</aside>

## Autoscaling, and why it's always late

Your traffic isn't flat. Weekday evenings are 5x weekday mornings. Running peak capacity all day means paying for idle machines most of the day.

So you autoscale. A controller watches a metric and adjusts the fleet size. Kubernetes' Horizontal Pod Autoscaler does the obvious arithmetic:

```
desiredReplicas = ceil[ currentReplicas × (currentMetric / targetMetric) ]
```

Running at 80% CPU against a 50% target with 10 pods? Ask for 16. Simple, and it works well for gradual daily curves.

Now break it. At 20:00 a link of yours hits the front page of a news site and traffic goes from 5,000 to 50,000 requests a second in about fifteen seconds. Walk the timeline:

```
t+0s    traffic arrives, CPU saturates, latency climbs
t+15s   metrics pipeline publishes a sample (HPA's default sync period is 15s)
t+15s   controller evaluates, decides to scale out
t+20s   new instances requested
t+60s   instances booted
t+90s   container image pulled, process started
t+120s  JIT warmed, connection pools opened, caches cold-filled
t+140s  health checks pass, load balancer starts sending traffic
```

**More than two minutes of degraded service, and the autoscaler did its job perfectly.** The lag is inherent: it is a sampled feedback loop with several serial delays stacked on top of each other, and every one of them is measured in tens of seconds. For a workload with a genuinely slow start — a JVM, or an ML container pulling multi-gigabyte weights — it can be many minutes.

Three consequences worth carrying into a design discussion.

**Autoscaling handles trends, not spikes.** For predictable events (a ticket sale at noon, a Super Bowl ad) you schedule capacity in advance or keep a pre-warmed pool. For genuinely unpredictable spikes your defence is load shedding and queueing, not scaling. → [Rate Limiting](/learn/system-design/rate-limiting)

**Scaling in is more dangerous than scaling out.** Scale in too eagerly and you're undersized when the next wave arrives, so you scale out, so you scale in — the fleet oscillates and every cycle throws away warm caches and open connections. This is why autoscalers have stabilization windows and cooldowns: they scale out fast and in slowly, on purpose.

**Autoscaling the stateless tier can hurt the stateful one.** Tripling your app servers triples the connections hitting the database, and now α just went up at the worst possible moment. Scaling out during an overload can be the thing that finishes the database off. The tier that actually needs capacity is usually the one you can't add capacity to in two minutes.

## Where this shows up

- Managed serverless platforms sell you the autoscaling lag problem as the cold-start problem; provisioned concurrency and warm pools are people paying to remove it.
- Connection poolers (PgBouncer, RDS Proxy) exist purely because app-tier horizontal scaling collides with a database's connection limit.
- Read replicas plus a CDN are the standard answer for read-heavy products; a read-heavy product that suddenly becomes write-heavy is a re-architecture, not a config change.
- Sticky sessions in a legacy load balancer config are usually the fossil record of a system that was scaled out before it was made stateless.

## In an interview

Start by scaling vertically and say so — "one machine handles this fine until about X, so let's not shard yet" shows judgement, and jumping straight to sharding a 1,000 QPS system reads as pattern-matching.

Before you claim a tier scales horizontally, say what makes it stateless. Interviewers push hard here, and "sessions live in Redis, so any server can serve any request" is a one-line answer that closes the question.

Separate reads from writes explicitly and early. They have different numbers, different bottlenecks and different fixes, and treating "scale the database" as one problem is the most common way this topic goes badly.

Expect the follow-up "so just add more servers?" Answer with the shared resource: the database connection limit, the single primary, the lock, the coordination chatter. That's contention and coherency without needing to say the words.

## Seen in

- 08 - Location Index Scaling Problem — a million writes a second that doesn't fit on one machine, and why the split has to preserve the one query the system actually runs
- 03 - Data Model and Sharding — choosing the partition key that lets writes scale out without breaking reads

## Related

[Sharding and Partitioning](/learn/system-design/sharding-and-partitioning) · [Caching Strategies](/learn/system-design/caching-strategies) · [Replication and Read Consistency](/learn/system-design/replication-and-read-consistency) · [Load Balancing](/learn/system-design/load-balancing) · [Availability](/learn/system-design/availability) · [SLA SLO SLI](/learn/system-design/sla-slo-sli) · [Rate Limiting](/learn/system-design/rate-limiting) · [Avoiding Distributed Transactions](/learn/system-design/avoiding-distributed-transactions)

## Sources

- [Neil Gunther — How to Quantify Scalability (Universal Scalability Law)](https://www.perfdynamics.com/Manifesto/USLscalability.html)
- [Kubernetes — Horizontal Pod Autoscaling](https://kubernetes.io/docs/tasks/run-application/horizontal-pod-autoscale/)
- [PostgreSQL — Connection Settings (`max_connections`)](https://www.postgresql.org/docs/current/runtime-config-connection.html)
- [Hello Interview — Scaling Writes](https://www.hellointerview.com/learn/system-design/patterns/scaling-writes)
