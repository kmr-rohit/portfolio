---
title: "Clustering"
summary: "Kill one web server behind a load balancer and nothing else notices. Kill one node of your primary database and suddenly everything depends on which node it was."
stage: 8
stageName: "Services and infrastructure"
tier: "useful"
seq: 60
tags: ["distributed-systems", "availability", "consensus", "leader-election"]
---

Kill one web server behind a load balancer and nothing else notices. Kill one node of your primary database and suddenly everything depends on *which* node it was.

The difference is that the web servers have never heard of each other, while the database nodes have, and they have to agree on things. That shared membership and shared state is where most of the hard problems in distributed systems live. This note is about what that agreement costs and how it's actually built.

## Two groups of six machines that look identical from outside

You've got the online bookstore. Six application servers behind a load balancer, all running the same stateless code, all talking to the same database.

Kill one. The load balancer's health check fails, it stops sending that server traffic, and the other five absorb it. Nothing else in the system noticed. No other server changed its behaviour, because no other server knew that server existed. Adding a seventh means telling exactly one thing — the load balancer.

Now take six *different* machines, running your primary datastore, and kill one of those.

Suddenly it matters which one. Was it the one accepting writes? Did it hold the only copy of anything? Do the other five agree that it's gone, or do three think it's gone and two think it's fine? If it comes back in ninety seconds, is its data still valid, or did the world move on without it?

**The load balancer isn't what's different.** What's different is that these nodes hold state that has to stay consistent between them, and consistency across machines requires that the machines have a shared answer to two questions: *who is in this group*, and *who is in charge*.

That's a cluster. A set of nodes that maintain a shared view of membership and of some state, and that coordinate to keep it correct when nodes fail.

<figure class="sd-figure"><img src="/system-design/diagrams/clustering.svg" alt="Diagram: Clustering" loading="lazy" decoding="async" /></figure>

Most real systems have both. Your stateless app tier is a pool. Your database, your cache, your message broker and your orchestrator are all clusters.

## Somebody has to decide

Start with the smallest version of the problem. Three replicas of your orders database, and any of them will accept a write.

Two customer-service agents update order 4821 at the same moment. One sets it to `shipped` on replica A. The other sets it to `cancelled` on replica B. Both writes succeed. Both replicas tell their client it worked.

Now replicate. A tells B the order is `shipped`. B tells A it's `cancelled`. There is no fact of the matter about which happened first — they were concurrent, and "the network delivered one first" is not a business answer.

You have exactly two ways out. Either you define merge semantics for every conflict in your data model, which means CRDTs or last-write-wins and a promise that you're willing to silently lose one of those updates. Or **you designate exactly one node that gets to decide the order of writes**, and route everything through it.

Most systems pick the second. So now: which node?

**The naive answer is to hardcode it.** Node 1 is the leader. Simple, obviously correct, and the cluster is down until a human wakes up when node 1's disk dies.

**The next naive answer is to let whoever notices take over.** Node 2 stops hearing from node 1, declares itself leader, and carries on. Fast, automatic, and broken — because node 3 also stopped hearing from node 1, at roughly the same moment, and made the same decision. Now there are two leaders, both accepting writes, and we're back to the divergence we were trying to prevent. That's **split brain**.

**The fix is to make leadership something you win, not something you claim.**

Raft is the canonical version and worth knowing in outline. Time is divided into numbered *terms*. A follower that hears nothing from a leader for its election timeout becomes a candidate, increments the term, votes for itself and asks everyone else for a vote. Each node grants at most one vote per term. A candidate that collects votes from a **majority** becomes leader for that term.

The anti-split-brain argument is one sentence, and it's worth being able to say it cleanly: **two disjoint majorities of the same set cannot exist, so at most one candidate can win any given term.** That's not a heuristic or a race-condition mitigation. It's arithmetic.

Two practical details make it work. Election timeouts are **randomised** per node, so that when a leader dies the followers don't all become candidates simultaneously and split the vote forever. Elasticsearch does the same thing for the same reason — its docs note that "elections are scheduled randomly on each node to reduce the probability of this happening."

And once elected, the leader **heartbeats** continuously to suppress new elections. etcd's defaults are heartbeats every few hundred milliseconds with an election timeout around a second, and their guidance for geographically distributed clusters is to set the election timeout to at least 5× the heartbeat interval — because on a WAN, a single slow round trip must not look like a dead leader.

## Quorum, and why cluster sizes are odd

Majority is a specific number: ⌊N/2⌋ + 1. Here's what that buys, straight from etcd's documentation:

| Cluster size | Quorum | Failures tolerated |
|---|---|---|
| 1 | 1 | 0 |
| 3 | 2 | 1 |
| 5 | 3 | 2 |
| 7 | 4 | 3 |
| 9 | 5 | 4 |

**Now look at what's missing: the even numbers.** A 4-node cluster needs a quorum of 3, so it tolerates 1 failure — the same as a 3-node cluster. You bought a fourth machine, gained zero additional fault tolerance, and added one more thing that can break, one more machine to patch, and one more participant slowing down every write. etcd puts it plainly: an odd-size cluster tolerates the same number of failures as the next even size with fewer nodes.

**And the other direction: why not 9, or 99?** Because every committed write has to be acknowledged by a majority, so write latency is set by the slowest node in the fastest majority — and that gets worse as the cluster grows, not better. etcd says a cluster should probably have no more than seven nodes. Google's Chubby settled on five. Confluent recommends three or five KRaft controllers.

This is the counterintuitive bit that's worth internalising properly: **a consensus cluster does not get faster or more available as you add nodes.** It gets slower. The nodes are there for fault tolerance, not throughput. If you need throughput, you shard across many small clusters rather than growing one big one. → [Sharding and Partitioning](/learn/system-design/sharding-and-partitioning)

There's a deeper reason majority is the magic number, beyond "only one can win". **Any two majorities of the same set must overlap in at least one member.** So when a new leader gathers votes from a majority, at least one voter was also part of the majority that acknowledged the previous leader's last committed write — which means the new leader is guaranteed to learn about it. That overlap is what makes committed writes survive a leader change. It's the whole reason "majority" rather than "any two nodes".

The price is stated honestly in one line: **a minority partition is unavailable by design.** Two nodes on the wrong side of a network split are healthy, have the data, and will still refuse your writes. That's not a bug. That's the system choosing consistency, and it's the clearest concrete example of the CAP trade-off you'll find. → [CAP Theorem](/learn/system-design/cap-theorem) · [PACELC Theorem](/learn/system-design/pacelc-theorem)

## Split brain: what actually goes wrong

Let's walk both versions on the same failure, because the contrast is the lesson.

Five nodes, three in rack A and two in rack B. The link between the racks fails.

**With quorum.** Rack A has 3 of 5 — a majority. It elects a leader and keeps serving writes. Rack B has 2 of 5, cannot reach a majority, and so the nodes there fail to elect anyone and stop accepting writes. They're up; they're just refusing. When the link heals, rack B's nodes discover a higher term, discard anything they hadn't committed, and replay rack A's log. One history, no data loss, no human judgement required.

**Without quorum.** Both sides elect a leader, because both sides can see "a leader" among themselves. Both accept writes for the twenty minutes it takes someone to notice. The link heals and you have two conflicting histories of the same orders table, and no principled way to merge them — you're now choosing which customers' orders to throw away, by hand, at 3am.

There's a subtler variant that causes more real incidents than network partitions do, and it's worth knowing because the mitigation is different.

**The old leader doesn't know it's old.** Node 1 is the leader. Its JVM enters a 12-second stop-the-world garbage collection. The other nodes hear no heartbeats, time out, elect node 3 in a new term, and carry on. Node 1 wakes up, has no idea any time passed, and continues writing as though it's still leader.

For a moment there are two leaders, and the stale one is behaving perfectly reasonably from its own point of view. Two mechanisms handle it. **Fencing tokens**: every write carries the leader's term or epoch, and the storage layer rejects anything with a term lower than the highest it has seen — so node 1's writes bounce. Redis Cluster's `configEpoch` is exactly this, and the spec says so directly, describing it as "a concept similar to the Raft algorithm term". And **leader leases**: a leader that hasn't been re-confirmed by a majority within its lease must voluntarily stop serving, so it steps down on its own before it can do damage.

<aside class="sd-callout sd-callout--warning">



When people say "split brain" they picture a severed cable between data centres. In practice the far more common trigger is **a node that froze** — a long GC pause, a saturated disk, a hypervisor stall, an overloaded box that stopped responding to health checks. The failure looks identical from outside, which is exactly the point: the cluster cannot tell a dead node from a slow one, and a node that comes back thinking it's still in charge is the normal case, not the exotic one.

</aside>

## Heartbeats, and the thing you cannot solve

Here's the uncomfortable foundation under all of this.

**You cannot distinguish a crashed node from a slow one.** Not with more clever code, not with a better protocol — it's a proven impossibility in an asynchronous network. Every failure detector ever built is a timeout, and every timeout is a guess.

So the design question isn't "how do we detect failure correctly", it's "which way do we prefer to be wrong".

Set the timeout low and you get false positives. A GC pause or a brief network hiccup triggers a failover of a perfectly healthy leader. Under load — when pauses are longest and the network is busiest — you get failover storms, which means you're churning leadership at exactly the moment the system is already struggling.

Set it high and real failures go unnoticed for that long. Every write blocks for the duration, because there's no leader to accept them.

**The good systems refuse to let one node's opinion decide.** Redis Cluster's two-stage detection is a clean example:

A node marks another as `PFAIL` — *possible failure* — when a ping has gone unanswered for longer than `NODE_TIMEOUT`. That's purely local suspicion and triggers nothing. Nodes gossip their views of each other constantly, so everyone accumulates everyone else's opinions. `PFAIL` only escalates to `FAIL` when a **majority of masters** have independently reported `PFAIL` or `FAIL` for that node within `NODE_TIMEOUT × 2`. Only then does a replica promotion get triggered.

There's a lovely detail in the spec: nodes proactively reconnect to a peer once half of `NODE_TIMEOUT` has elapsed without a reply, specifically so that a quietly-dropped TCP connection doesn't masquerade as a dead node. Most of the engineering in a failure detector is about suppressing false positives, not catching failures faster.

Two architectures for getting the heartbeats around. **Centralised**: everyone heartbeats to the leader or to a dedicated monitor. Simple, fast to detect, and the monitor is a bottleneck and a special node. **Gossip**: each node periodically exchanges membership views with a few random peers, and information spreads epidemically. Redis Cluster's cluster bus works this way, as do Cassandra and SWIM-based libraries like Serf and Uber's Ringpop. It scales to large N with no special node, at the cost of a convergence delay that grows with cluster size. → [Service Discovery](/learn/system-design/service-discovery)

One refinement worth a sentence: instead of a boolean "up or down", **phi-accrual** detectors output a continuously rising suspicion level based on the observed distribution of heartbeat arrival times. Cassandra and Akka use it. It adapts automatically to a network that's normally 1 ms and a network that's normally 80 ms, instead of making you tune a constant for each.

## Active-active versus active-passive

Now the question of how many nodes actually do work.

**Active-passive.** One node serves. One or more stand by, kept in sync, doing nothing. A health check notices the active is gone and promotes a standby.

It's simple and it's *safe* in a specific way that matters: there is only ever one writer, so the concurrent-write problem never arises. The costs are that you're paying for idle hardware, and that failover is a gap — seconds during which writes fail, connections drop and clients see errors.

There's a third cost nobody puts on the slide. **A standby that is never exercised is a standby that does not work.** Its config has drifted, its certificate expired, its replication silently fell behind four months ago. If you're not failing over deliberately and regularly, you don't have a standby, you have a hypothesis.

**Active-active.** Everyone serves. Full hardware utilisation, no failover gap for reads, and losing a node costs you capacity rather than availability.

For writes, though, "active-active" is doing a lot of work as a phrase, and you should always ask what it means concretely. Either the write keyspace is partitioned so each node is the sole writer for its slice — in which case it's really N active-passive arrangements wearing a trench coat — or you're genuinely accepting concurrent writes to the same data, and you owe an answer about conflict resolution.

**The pattern that gets you both is many small leaderships spread across all nodes.** Kafka is the clearest illustration: every broker serves traffic, so the cluster is active-active, but each *partition* has exactly one leader and a set of in-sync replicas eligible to replace it, so each partition is active-passive. Spread thousands of partition leaderships evenly and every machine is busy while every individual write still has exactly one decider. Redis Cluster does the same thing with its 16,384 hash slots.

One warning on the phrase. "Active-active across regions" is a vastly bigger claim than active-active across racks, because now your conflict resolution happens over links with hundreds of milliseconds of latency and hours-long partitions. Multi-region active-active for writes is a genuinely hard design, not a checkbox. → [Replication and Read Consistency](/learn/system-design/replication-and-read-consistency) · [Availability](/learn/system-design/availability)

## Shared-nothing versus shared-disk

The other axis, and the one that quietly decides how painful your operations are.

**Shared-disk.** Nodes are compute over one storage system — a SAN, or object storage, or Aurora's shared storage volume. No node owns any data.

Failover is close to trivial, because there's nothing to move. Any node can pick up where another left off, since the data never lived on the failed node in the first place. Scaling compute is just adding nodes. The storage layer is the bottleneck, and it's also the shared fate: when it degrades, everything degrades together.

**Shared-nothing.** Each node owns its own disk and its own slice of the data. Nothing is shared and nothing contends.

This is what scales horizontally, because adding a node adds both compute and storage. It's also what makes you responsible for partitioning, for rebalancing when the node count changes, and for replicating each slice enough times that losing a node doesn't lose data. → [Sharding and Partitioning](/learn/system-design/sharding-and-partitioning) · [Consistent Hashing](/learn/system-design/consistent-hashing)

Failover is harder here in exactly the way shared-disk is easy: when a node dies, its data is on a disk you can't reach, so a replica has to be promoted, and the promotion has to be correct.

The modern shape is a hybrid — separate storage from compute, and make the "shared disk" be cloud object storage. Snowflake, Aurora, Neon and increasingly Kafka with tiered storage all work this way. You get shared-disk's easy failover and elastic compute on top of storage that's someone else's durability problem.

## The examples, named

**Kubernetes control plane** is the best single example, because it contains all three patterns at once. You run at least three control plane nodes for HA. `kube-apiserver` is stateless, so all instances run active-active behind a load balancer — it's a pool, not a cluster. `kube-scheduler` and `kube-controller-manager` are active-passive via leader election, because two schedulers placing the same pod would be a disaster. And `etcd` underneath is a genuine Raft cluster holding all the state. kubeadm's default stacks etcd on the control plane nodes (3 hosts); the external-etcd topology separates them (6 hosts) so that losing one machine doesn't cost you both a control plane instance and an etcd member.

**Kafka in KRaft mode.** Controller nodes form a Raft quorum managing the cluster metadata log. One is the *active controller* and handles broker requests; the others replicate the log and stand by as immediate replacements. Brokers fetch metadata from the active controller by offset, which makes controller failover fast because brokers know exactly how far behind they are. Confluent recommends three or five controllers. The detail worth remembering: a broker partitioned from the controllers **keeps serving existing clients** — it just can't do administrative operations, leader re-elections or consumer group rebalancing. Degrade, don't die.

**Elasticsearch.** Master-eligible nodes maintain a *voting configuration*, and a decision needs more than half of them to respond. Elections are scheduled randomly with exponential backoff on retry. Their operational rule is blunt and generalises to every quorum system: **you must not stop half or more of the voting configuration at the same time.** With three master-eligible nodes you can lose one; with two, you can lose none.

**Redis Cluster.** The keyspace is 16,384 hash slots divided among masters, each with replicas. Failure detection is the `PFAIL` → `FAIL` gossip escalation above. A replica promotes itself only after winning votes from a majority of masters, and `configEpoch` fences stale configurations so an old master rejoining can't reclaim its slots. Notably, it explicitly does *not* try to merge conflicting writes — the spec's position is that merge operations are avoided by design, because they're slow and the semantics are usually wrong.

## Where this shows up

- **Every managed database's "Multi-AZ" option** — that's active-passive with automatic failover, and the failover gap is exactly the seconds of write unavailability described above.
- **ZooKeeper, etcd and Consul** — clusters whose entire product is "somewhere to put the small piece of state everyone must agree on", which is why they sit under Kubernetes, Kafka and service registries.
- **Kafka partitions and Redis hash slots** — many small leaderships spread across all nodes, which is how a cluster is active-active in aggregate and single-writer per key.
- **Elasticsearch's minimum-master-nodes history** — a setting operators regularly got wrong and produced split brains with, which is why modern versions manage the voting configuration automatically instead of trusting you.

## In an interview

Bring this up the moment your design has stateful nodes — a database, a broker, a coordinator, a cache holding something you can't rebuild.

Say the quorum numbers out loud. "Three nodes, quorum of two, tolerates one failure" takes four seconds and demonstrates you know why it's three and not four.

Expect to be pushed on split brain. The answer is majority quorum plus a monotonically increasing term or epoch, and fencing at the storage layer so a resurrected old leader gets rejected.

Expect "what happens during a network partition?" The minority side must stop accepting writes. Saying so plainly — and naming that as a deliberate availability sacrifice — is a stronger answer than trying to keep both sides serving.

The most common mistake is treating a database cluster like a stateless pool: "we'll just add more nodes." Adding nodes to a consensus cluster makes writes *slower*. The second is putting an even number of nodes in a quorum, which reliably gets a follow-up question.

## Seen in
- 12 - How Uber Actually Does It — Ringpop is a consistent hash ring plus SWIM gossip membership, so every node independently knows the cluster's shape and can route without a coordinator. Its documented ceiling is the gossip convergence delay, which is the cost of decentralised membership showing up exactly where this note says it will.

## Related
[Service Discovery](/learn/system-design/service-discovery) · [Availability](/learn/system-design/availability) · [Load Balancing](/learn/system-design/load-balancing) · [Consistent Hashing](/learn/system-design/consistent-hashing) · [Sharding and Partitioning](/learn/system-design/sharding-and-partitioning) · [Replication and Read Consistency](/learn/system-design/replication-and-read-consistency) · [CAP Theorem](/learn/system-design/cap-theorem) · [PACELC Theorem](/learn/system-design/pacelc-theorem) · [Message Brokers](/learn/system-design/message-brokers) · [Disaster Recovery](/learn/system-design/disaster-recovery) · [OSI Model](/learn/system-design/osi-model) · [TCP and UDP](/learn/system-design/tcp-and-udp)

## Sources
- [etcd — FAQ: quorum, cluster sizing, heartbeats and election timeouts](https://etcd.io/docs/v3.5/faq/)
- [Redis — Cluster specification (hash slots, PFAIL/FAIL, configEpoch)](https://redis.io/docs/latest/operate/oss_and_stack/reference/cluster-spec/)
- [Elasticsearch — Quorum-based decision making](https://www.elastic.co/guide/en/elasticsearch/reference/current/modules-discovery-quorums.html)
- [Kubernetes — Options for highly available topology](https://kubernetes.io/docs/setup/production-environment/tools/kubeadm/ha-topology/)
- [Confluent — KRaft: Kafka metadata management](https://docs.confluent.io/platform/current/kafka-metadata/kraft.html)
- [Karan Pratap Singh — Clustering](https://www.karanpratapsingh.com/courses/system-design/clustering)
