---
title: "Leader Election and Consensus"
summary: "You run three database replicas. The primary dies. Which replica takes over? If two of them decide \"it's me\", you have two primaries accepting different writes, and when the network heals nobody can say which is right. That's split brain, and avoiding it is what consensus algorithms are for."
stage: 4
stageName: "Distributed systems and coordination"
tier: "core"
seq: 34
tags: ["consensus", "raft", "zookeeper", "coordination"]
---

You run three database replicas. The primary dies. Which replica takes over? If two of them decide "it's me", you have two primaries accepting different writes, and when the network heals nobody can say which is right. That's **split brain**, and avoiding it is what consensus algorithms are for.

The core idea is simple. **Don't let a node decide alone. Let a majority decide.** Any two majorities of the same group overlap in at least one node, so two conflicting decisions can't both win.

<figure class="sd-figure"><img src="/system-design/diagrams/leader-election-and-consensus.svg" alt="Diagram: Leader Election and Consensus" loading="lazy" decoding="async" /></figure>

---

## The problem, in three pieces

**Agreement on a leader.** All nodes must eventually agree who's in charge, even when messages are delayed or lost and nodes crash.

**Agreement on a log.** Once there's a leader, followers must apply the same commands in the same order. If they do, they all hold the same state (replicated state machine).

**Safety over liveness.** During a partition the system may stop making progress (no majority, no leader). It must never disagree.

---

## How Raft does it

**Paxos** is the classic and famously hard to explain. **Raft** was designed to be understandable and is what most modern systems (etcd, Consul, CockroachDB, and many others) use. Zab (ZooKeeper) is similar in spirit.

- **Terms.** Time is divided into numbered terms. Each term has at most one leader.
- **Election.** A follower that hears nothing from a leader for a randomised timeout becomes a candidate, increments the term, and asks for votes. A node votes once per term. **A majority of votes wins.** Randomised timeouts stop everyone campaigning at once.
- **Replication.** The leader appends a command to its log and sends it to followers. When a **majority** has stored it, it's **committed**, applied, and acknowledged to the client.
- **Safety.** A candidate can only win if its log is at least as up to date as a majority's, so a new leader always has every committed entry.

A five-node cluster survives two failures; three nodes survive one. You always want an **odd** number, because a 4-node cluster tolerates no more failures than a 3-node one but needs more votes.

---

## What it costs

- **Latency:** every write waits for a majority, so it costs a round trip to the slowest of the nearest majority. Across regions, that's tens to hundreds of ms.
- **Throughput:** one leader orders everything, so it doesn't scale writes. You shard *groups* (many small Raft groups) to scale.
- **No progress without a majority:** a partition that isolates the minority stops it accepting writes. That's the **CP** choice in [CAP Theorem](/learn/system-design/cap-theorem). → [PACELC Theorem](/learn/system-design/pacelc-theorem)

So you don't put consensus on the hot path of every request. You use it for small, critical, slow-changing facts: who's the leader, which node owns which shard, configuration, locks. Then the fast path reads those facts from a cache.

---

## ZooKeeper and etcd: consensus as a service

Most applications don't implement Raft. They rent it from **ZooKeeper** or **etcd**, small strongly consistent stores of coordination data.

- **Leader election:** each candidate creates an **ephemeral** node (`/election/leader`). Only one succeeds. If its session dies (heartbeats stop), the node vanishes, a **watch** fires, and the others race again.
- **Configuration and service registry:** store the shard map or the rate-limit rules, and watch it. Every server gets notified within seconds. → [Service Discovery](/learn/system-design/service-discovery)
- **Group membership:** ephemeral nodes show who's alive.
- **Locks and barriers:** see [Distributed Locks and Fencing Tokens](/learn/system-design/distributed-locks-and-fencing-tokens).

Kafka historically used ZooKeeper for controller election and metadata (newer versions use their own Raft, KRaft). HBase, and many others, lean on it for the same jobs.

---

## The trap: an old leader that doesn't know

A leader is elected, then a long GC pause freezes it for 30 seconds. The others time out and elect a new leader. The old one wakes up and still believes it's leader, and it starts writing. Two leaders again, and no amount of election logic prevents the *old* one from acting.

The fix is a **fencing token**: every leadership grant carries a monotonically increasing number (the Raft term, or a lock's sequence). Storage rejects any write with a smaller number than it has seen. The stale leader's writes fail. → [Distributed Locks and Fencing Tokens](/learn/system-design/distributed-locks-and-fencing-tokens)

---

## You often don't need it

Consensus is a heavy tool. Many designs avoid it.

- **Let the database do it.** A conditional `UPDATE ... WHERE driverId IS NULL` on one shard decides a race without any lock service. → Uber · BookMyShow
- **Single-leader replication** with async failover is fine when losing a few seconds of writes is acceptable. → URL Shortener
- **Leaderless quorums** (Cassandra) avoid electing at all, at the cost of conflict handling. → [Cassandra and DynamoDB](/learn/system-design/cassandra-and-dynamodb)
- **Gossip** (SWIM, used by Uber's Ringpop) spreads membership information without a coordinator, accepting eventual disagreement (AP).

Reaching for ZooKeeper or Raft to allocate a key or pick a driver, when one row on one shard already settles it, is over-engineering. Naming it and rejecting it with a reason is a better signal than not mentioning it.

---

## In an interview

Say **majority quorum** and why two majorities overlap. Say what you sacrifice (availability in the minority partition) and what you use it for (small critical metadata, not the data path). Mention the **fencing token** for stale leaders.

The trap is proposing ZooKeeper for something a single conditional write already solves.

## Seen in
- Uber — why a Raft or ZooKeeper claim is over-engineered for one row on one shard; Ringpop's gossip
- Rate Limiter — rules pushed via ZooKeeper or etcd watches, with last-known-good
- Distributed Cache — cluster membership and leader per shard
- Job Scheduler — electing a scheduler leader, fencing duplicate firing
- Google Drive — why the version check needs a single leader

## Related
[CAP Theorem](/learn/system-design/cap-theorem) · [PACELC Theorem](/learn/system-design/pacelc-theorem) · [Replication and Read Consistency](/learn/system-design/replication-and-read-consistency) · [Clustering](/learn/system-design/clustering)
