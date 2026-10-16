---
title: "Replication & Read Consistency"
summary: "\"Is this system strongly consistent?\" is almost always the wrong question. The useful one is narrower:"
stage: 3
stageName: "Scaling data"
tier: "core"
seq: 16
tags: ["replication", "consistency", "quorum", "leader", "stale-reads"]
---

"Is this system strongly consistent?" is almost always the wrong question. The useful one is narrower:

**What breaks if *this particular read* returns data that's a few hundred milliseconds out of date?**

Ask it per code path, and the answer usually falls out immediately.

---

## The topologies, briefly

**Single leader.** One machine takes writes, others replicate from it. Reads from the leader are current. Reads from a follower are stale by however far replication has fallen behind.

**Multi leader.** Several machines take writes and merge asynchronously. Conflicts become possible, so you need a resolution strategy — last-write-wins, CRDTs, or application logic.

**Leaderless / quorum.** Write to W nodes, read from R of N. If `R + W > N` you're guaranteed to read at least one node that saw the latest write. If not, you can read stale.

---

## How the copy actually gets there

"The follower replicates from the leader" hides three separate decisions, and each one has teeth.

### When does the leader acknowledge your write?

**Asynchronously.** The leader writes locally, tells you it's done, and ships the change to followers afterwards. Your write latency is one local disk write — fast. And if the leader dies in the gap before the change reached anyone, **that write is gone**, even though you were told it succeeded. Most deployments run this way and accept a small loss window on failover.

**Synchronously.** The leader waits for followers to confirm before acknowledging. No committed write can be lost. Your write latency is now the slowest follower's round trip, and if a follower is down or slow, writes **stall**. Fully synchronous replication to every follower is fragile enough that almost nobody does it.

**Semi-synchronously.** Wait for *one* follower, let the rest catch up asynchronously. You survive losing the leader, without one sick replica halting everything. This is the usual compromise — Postgres's `synchronous_standby_names` with a quorum, MySQL's semi-sync.

The choice is a durability-versus-latency dial, and it's the same dial as the `W` in a quorum system.

### What actually gets shipped?

**Statement-based** — send the SQL. Compact, and treacherous: `NOW()`, `RANDOM()` and auto-increment produce different results on the replica. Largely abandoned for good reason.

**Write-ahead log shipping** — send the physical log records the storage engine already produces. Exact, cheap, and tightly coupled: the replica must run the same engine and usually the same major version, which makes zero-downtime upgrades hard.

**Logical (row-based)** — send "row with key X changed to these values", decoupled from storage format. This is what enables replicating between versions, between different databases, and into a search index or warehouse. It's also the foundation of change data capture. → [Secondary Indexes at Scale](/learn/system-design/secondary-indexes-at-scale)

### Where lag comes from

Replication lag isn't one thing. The leader may be producing changes faster than the network carries them, or faster than a single-threaded replica applier can execute them. A long-running read on the replica can block the applier. A batch job — a bulk update, an index build — produces a burst the replica works through for minutes.

The number you want is **not** "how many bytes behind." It's **time** behind: `now() - last_replayed_transaction_timestamp`. Bytes tell you nothing about how long it'll take to catch up.

And the pattern that matters operationally: lag is near-zero when things are calm and spikes exactly when load is heaviest — which is precisely when a stale read is most likely to hurt.

---

## When the leader dies

Failover is the part that looks like a checkbox and isn't.

Something must **detect** the failure (usually a timeout — and the timeout is a guess, because you genuinely cannot distinguish a dead leader from a slow one), **choose** a new leader (ideally the most up-to-date follower), **promote** it, and **redirect** clients via DNS, a virtual IP, or a proxy.

Three things go wrong, reliably.

**Data loss on async failover.** The new leader is missing whatever the old one acknowledged but hadn't shipped. When the old leader comes back, it has writes nobody else has. The usual resolution is to discard them — which means acknowledged writes silently vanish. If anything external acted on those writes, you now have an inconsistency nothing will reconcile for you.

**Split-brain.** The old leader isn't dead, just unreachable. It keeps accepting writes while the new leader does too. Two divergent histories. This is the genuinely bad one, and the defence is **fencing** — forcibly cutting the old leader off. STONITH ("shoot the other node in the head") is the blunt version; a lease or epoch number that the storage layer rejects writes against is the sophisticated one.

**Timeout tuning is a trap.** Too short and a GC pause triggers a needless failover, which causes an outage to prevent one. Too long and a real failure takes minutes to notice.

This is why plenty of mature teams keep the final promotion **manual** for their most important database. Automatic failover trades a rare long outage for a more frequent risk of split-brain, and that isn't always the right trade. → [Clustering](/learn/system-design/clustering)

---

## What a stale read actually costs

Replication lag is usually milliseconds. It's also **unbounded when the system is under load**, which is exactly when you'd least like it to be.

What matters isn't the number, it's what depends on the answer:

Rendering a list, a count, a dashboard? Stale is fine. Nobody notices a two-hundred-millisecond-old follower count.

A **routing decision** — "which shard holds this data?" Stale gives you a wrong or empty answer. Not an error, just a silently incorrect result.

A **concurrency decision** — "may I claim this?" Stale gives you a correctness bug, and probably a double-booking.

Reading back something the user just wrote? Stale means "where did my post go?", which is a support ticket even though nothing is technically broken.

So: **never make a correctness or routing decision from a lagging replica.** Read from the leader, or use a quorum read. Everything else can be eventually consistent.

---

## The same data, read two different ways

The interesting case is when one table is read by two callers with wildly different needs.

|  | High-volume path | Low-volume path |
|---|---|---|
| Rate | ~10⁶ / s | ~10² / s |
| Effect of a stale read | self-healing — the data expires and is rewritten | a lost transaction |
| So it reads | a cached local copy | the leader, or a quorum |

The asymmetry is what makes this affordable. Adding a leader round-trip to a path that runs a hundred times a second costs nothing. Adding it to one that runs a million times a second would be the end of your system.

Which gives you a useful habit: **look at the read-to-write ratio before deciding the consistency level.** It usually hands you the answer.

---

## Session guarantees, when full strength is too expensive

You often don't need global strong consistency — you need one user's experience to make sense.

**Read your writes.** The user sees their own updates. Implement by pinning them to the leader for a few seconds after a write, or by tracking a write position and requiring the replica to have caught up to it.

**Monotonic reads.** Time never appears to go backwards. Implement by pinning a user to one replica.

**Consistent prefix.** Causally-ordered writes appear in order. Falls out of per-partition ordering.

These are often exactly enough, at a fraction of the cost.

---

## Durability is a budget too

Replication and fsync buy durability, and durability isn't free. So ask what it's *worth* for each dataset.

Data that's **stale in seconds and regenerated by its source** — locations, presence, sessions, cached lookups — has almost worthless durability. Trade it for throughput: in-memory storage, asynchronous replication, accept losing a few seconds on failover. The recovery procedure is "the source writes again."

Data that's the **system of record** — an order, a payment, a trip — loses a customer's transaction if you lose a row. Pay for synchronous replication and fast failover.

The mistake is applying one answer to a whole system. A design with both kinds of data should look visibly different in the two places, and being able to say why is most of the signal.

---

## In an interview

Never describe a whole system as "strongly consistent". Say which *reads* need the leader and why — usually a routing decision or a concurrency check — and let everything else read replicas.

Know the async failover story cold: the leader acknowledged writes it hadn't shipped, a replica is promoted, and those writes are gone. Then say whether that's acceptable for *this* data, with a reason.

The trap: reaching for synchronous replication everywhere to be safe. It puts a replica round-trip on every write and stalls writes when a replica is slow. Spend it only where losing a write actually costs something.

## Seen in
- 10 - Dynamic Resharding and the Shard Index — driver writes read a cached copy, rider reads go to the leader
- Uber · High Level Design — three storage tiers with three different durability answers
- 04 - Driver Location Index — trading durability away for write throughput

## Related
[Caching Strategies](/learn/system-design/caching-strategies) · [Sharding and Partitioning](/learn/system-design/sharding-and-partitioning) · [Avoiding Distributed Transactions](/learn/system-design/avoiding-distributed-transactions) · [Clustering](/learn/system-design/clustering) · [Disaster Recovery](/learn/system-design/disaster-recovery) · [CAP Theorem](/learn/system-design/cap-theorem) · [PACELC Theorem](/learn/system-design/pacelc-theorem)

## Sources
- [PostgreSQL: Log-shipping standby servers and synchronous replication](https://www.postgresql.org/docs/current/warm-standby.html)
- [PostgreSQL: Logical replication](https://www.postgresql.org/docs/current/logical-replication.html)
- [MySQL: Semisynchronous replication](https://dev.mysql.com/doc/refman/8.0/en/replication-semisync.html)
- [Martin Kleppmann, *Designing Data-Intensive Applications*, ch. 5](https://dataintensive.net/)
