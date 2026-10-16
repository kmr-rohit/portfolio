---
title: "PACELC Theorem"
summary: "CAP Theorem tells you what your system does on the worst day of the year. PACELC tells you what it does on every other day — and since partitions are rare and Tuesdays are not, that's usually the more expensive decision."
stage: 4
stageName: "Distributed systems and coordination"
tier: "core"
seq: 29
tags: ["cap", "consistency", "latency", "distributed-systems"]
---

[CAP Theorem](/learn/system-design/cap-theorem) tells you what your system does on the worst day of the year. PACELC tells you what it does on every other day — and since partitions are rare and Tuesdays are not, that's usually the more expensive decision.

The short version: **if there's a Partition, trade Availability against Consistency; Else, trade Latency against Consistency.**

---

## The 99.9% that CAP has nothing to say about

Same online store as the CAP note. Two datacenters, East and West, each with a full copy of `inventory`, replicating to each other. But this time nothing is broken. The link is up. Every machine is healthy. It's an ordinary afternoon.

A customer in Boston buys the last `SKU-42`. East writes `qty_on_hand = 0` and starts shipping the change to West. Twenty milliseconds later, before that change has landed, a customer in Portland loads the same product page and West has to answer.

**What should West do?**

You've seen this shape before, but look at what's actually being traded. West can ask East — "is my copy current?" — and answer correctly, at the cost of a cross-country round trip. Or West can answer from its local copy immediately and risk telling the customer there's one left when there isn't.

Nobody is unavailable. Nothing is partitioned. CAP is completely silent here, because CAP only speaks during partitions. And yet you just made a consistency decision, and it's one you make **on every single read, forever**, not once a year.

The currency isn't availability. It's latency.

---

## The number that makes this a real decision

The floor here is physics, not engineering. New York to San Francisco is roughly 4,100 km. Light in fibre travels at about two-thirds of *c*, call it 200,000 km/s. That's ~20 ms one way, ~41 ms for a round trip, and that's before a single router, switch or TLS handshake gets involved. Real cross-country RTTs land in the 60–80 ms range.

Now compare that to a read served from a replica in the same datacenter, which is a fraction of a millisecond.

So "check with the other coast before answering" isn't a small tax. It's a **hundredfold** change in read latency, applied to every request on that path, in exchange for closing a staleness window that is usually a few tens of milliseconds wide and that most reads genuinely do not care about.

That asymmetry is the whole reason PA/EL systems exist. It isn't sloppiness. It's someone looking at 60 ms versus 0.5 ms and deciding that a product page does not need to be linearizable.

The same tradeoff exists inside one datacenter too, just smaller and sneakier:

```
read from local replica      0 extra hops    may be stale
read from the leader         1 extra hop     current
quorum read (2 of 3)         1 extra hop,    current
                             but you wait for the SLOWER of two
```

That last line is the one people miss. A quorum read doesn't cost you the *average* replica latency — it costs you the max of the ones you waited for, so your p99 gets noticeably worse even though your median barely moves. → [Sharding and Partitioning](/learn/system-design/sharding-and-partitioning) has the same tail-latency-amplification argument for fan-out.

---

## PAC and ELC

Abadi proposed PACELC in 2012 because CAP, taken literally, mis-describes real databases. He had three specific complaints.

**CAP treats C and A asymmetrically.** Systems give up consistency constantly — every async replica, every cache, every eventually consistent read. They give up availability only during partitions. Framing those as two sides of one coin hides the fact that one happens all the time and the other almost never.

**CA and CP aren't distinguishable.** A system that refuses to serve when the network breaks is CP, whatever its marketing says.

**Latency is missing entirely, and it's the thing that actually drives the design.** His example was Yahoo's PNUTS, which relaxes consistency — but not to stay available. It does it to avoid paying a WAN round trip on every operation. CAP has no vocabulary for that at all.

So PACELC splits the question in two:

- **PAC** — if there is a **P**artition, do you choose **A**vailability or **C**onsistency? (This is just CAP.)
- **ELC** — **E**lse, do you choose **L**atency or **C**onsistency?

Each system gets a two-part label: PA/EL, PC/EC, PA/EC, PC/EL. Two of those four are comfortable and two are strange, and it's worth knowing why.

**PA/EL** says "I am optimising for the user-facing experience in both worlds — always answer, answer fast, sort out correctness later." **PC/EC** says "I would rather be slow or down than wrong." Those are coherent stories a developer can hold in their head.

**PA/EC** — strict when healthy, loose when partitioned — means the guarantee your application relies on silently evaporates exactly when the network misbehaves. Your code has to handle a consistency model it never sees in testing. **PC/EL** is rarer still: fast-but-stale normally, then refusing service when partitioned.

<aside class="sd-callout sd-callout--note">



The mixed labels aren't wrong, they're just harder to program against. If your read path assumes it's always current because it always looks current in staging, a partition turns a latent bug into an outage. PA/EC systems are exactly where "it worked fine for two years" stories come from.

</aside>

---

## Classifying real systems

Here's the conventional labelling, with the thing that actually determines it:

| System | Usual label | What really decides it |
|---|---|---|
| Cassandra, Riak | PA/EL | consistency level per statement; default `ONE` |
| DynamoDB | PA/EC | `ConsistentRead` per request; default is *off* |
| MongoDB (replica set) | PA/EC | write concern and read concern; modern defaults are stricter |
| Postgres, async replica | PA/EL in effect | your app choosing to read a follower |
| Postgres, sync replication | PC/EC | `synchronous_commit` and `synchronous_standby_names` |
| Spanner | PC/EC | TrueTime and Paxos — consistency is not optional |
| VoltDB, HBase, MySQL Cluster | PC/EC | by design |

Now the part the table can't carry.

**DynamoDB** is listed PA/EC, and that describes what it *offers*, not what your code does. The default read is eventually consistent, served from any of the three availability-zone replicas, and costs half as much as the strong one. That's textbook EL, and it's what you get unless you opt out. Set `ConsistentRead: true` and that specific call becomes EC — it has to reach the leader replica, so it's slower, pricier, and can fail when the leader is unreachable. Global tables make the same choice at region scale: multi-Region eventual consistency (the default, replicating typically within a second) versus multi-Region strong consistency, which replicates synchronously before the write returns.

**Cassandra** is the honest PA/EL. Default consistency level `ONE`, quorum computed as `(replication_factor / 2) + 1`. Reading and writing at `QUORUM` makes `R + W > RF`, the read and write sets must overlap, and you've bought yourself EC on that statement — at the cost of waiting for the slower of two replicas. `LOCAL_QUORUM` is the interesting middle: quorum inside the local datacenter only, so you get overlap without ever paying the WAN hop. That's a deliberate "consistent here, eventually consistent there."

**MongoDB**'s PA/EC label is a fossil. It comes from the era when writes were acknowledged by the primary alone, so a primary stranded on the minority side of a partition would keep accepting writes until it noticed — writes that then got rolled back. Modern MongoDB defaults an implicit write concern of `w: "majority"` on most replica set configurations, which makes the partition behaviour much more PC. The lesson isn't "the table is wrong," it's that the label tracks the **defaults of a particular version**, and defaults change.

**Postgres** is the clearest demonstration that this is a configuration property, not a product property. Leave `synchronous_standby_names` empty and you have asynchronous replication: commits return as soon as the primary has flushed, and a replica is behind by whatever the current lag is. Read only from the primary and you're EC. Point your read traffic at a follower to save the primary's CPU and you've just chosen EL — deliberately, and often without saying so out loud. Set `synchronous_commit = on` with a named standby and every commit waits for the standby's flush; you've bought EC and paid for it with the primary-standby round trip on every write. Same database, four different PACELC positions depending on what you configured and where you read.

**Spanner** is the one that looks like it cheats. It's PC/EC — externally consistent reads and writes, globally — and yet it's fast enough to run real workloads. There's no loophole. It pays: writes go through Paxos, and commits deliberately wait out TrueTime's clock uncertainty interval before releasing locks. What makes that affordable is a private global network with atomic clocks and GPS receivers in every datacenter, which shrinks the uncertainty enough that the wait is small. Google's own position is that Spanner is technically CP with better than five nines of availability — high enough that most teams can behave as if partitions don't happen. You can buy EC. You just can't get it free.

---

## What the E branch actually looks like in code

The good news is that the L-versus-C choice isn't binary, and the middle is where most real systems live.

You rarely need global linearizability. You usually need **one user's view to make sense**, which is much cheaper: read-your-writes so a customer sees their own order, monotonic reads so a page doesn't appear to travel backwards in time, consistent prefix so causally-ordered events don't arrive scrambled. Each of those is a fraction of the cost of full strength, and [Replication and Read Consistency](/learn/system-design/replication-and-read-consistency) works through how to implement them — pinning to the leader for a few seconds after a write, tracking a write position, pinning a session to one replica.

Bounded staleness is the other useful middle. "Give me a read that's at most 10 seconds old" can be served entirely locally with no coordination, because the replica can check its own lag and answer or refuse on its own. Spanner exposes exactly this as stale reads, and it's dramatically cheaper than a strong read.

So the practical procedure, per read path: name the highest-QPS read and the highest-correctness read. Give the second one EC. Give the first one EL plus whatever session guarantee keeps it from looking broken. That's almost always the right shape, and it's the same read-to-write-ratio instinct that drives the sharding decision.

<aside class="sd-callout sd-callout--tip">



When an interviewer asks "strong or eventual consistency?", the PACELC-aware answer is two sentences instead of one: what happens during a partition, *and* what you're willing to pay in latency when there isn't one. Most candidates only answer the first half, because CAP is all they've got.

</aside>

---

## Where this shows up

- **Multi-region anything.** The moment a second region exists, every read carries an implicit "local or authoritative?" decision, and the answer costs ~60–80 ms across a continent.
- **Read replicas in one region.** Pointing dashboards and list views at followers while keeping checkout on the primary is an ELC decision, even though nobody calls it that.
- **`LOCAL_QUORUM` in Cassandra.** A deployment-shaped answer to ELC: consistent within a datacenter, eventually consistent across them, never paying WAN latency on the hot path.
- **CDNs and DNS.** The extreme EL end — serve from the nearest edge, accept staleness bounded by TTL, and never ask the origin. → [CDN](/learn/system-design/cdn), [DNS](/learn/system-design/dns)

---

## In an interview

Use PACELC when someone says "let's just make it strongly consistent." Ask what that costs on the read path, and you've moved the conversation from a slogan to a latency budget.

The classification labels are worth knowing but are the least interesting part. What earns signal is saying *which knob* produces the label — `ConsistentRead`, consistency level, write concern, `synchronous_commit`. That shows you know these are settings, not identities.

The common mistake is the same one CAP invites: treating PA/EL as a property of Cassandra rather than of the statement you're about to run. The second-most-common is forgetting that the E branch is the one you pay for continuously.

If you're designing multi-region, state the RTT out loud before choosing. A design that quietly adds 60 ms to every read is a design the interviewer will find.

---

## Seen in
- 11 - Location Index High Level Design — writes resolve their shard from a local cache, rider reads go to the leader: an ELC choice, no partition involved
- 10 - Dynamic Resharding and the Shard Index — paying leader-read latency on the rare path because the volume makes it affordable

## Related
[CAP Theorem](/learn/system-design/cap-theorem) · [Replication and Read Consistency](/learn/system-design/replication-and-read-consistency) · [ACID and BASE](/learn/system-design/acid-and-base) · [Caching Strategies](/learn/system-design/caching-strategies) · [NoSQL Databases](/learn/system-design/nosql-databases) · [Availability](/learn/system-design/availability)

## Sources
- [Consistency Tradeoffs in Modern Distributed Database System Design: CAP is Only Part of the Story — Daniel Abadi, IEEE Computer 45(2), 2012](https://www.cs.umd.edu/~abadi/papers/abadi-pacelc.pdf)
- [Problems with CAP, and Yahoo's little known NoSQL system — Daniel Abadi](https://dbmsmusings.blogspot.com/2010/04/problems-with-cap-and-yahoos-little.html)
- [PACELC design principle — Wikipedia (classification table)](https://en.wikipedia.org/wiki/PACELC_design_principle)
- [DynamoDB read consistency — AWS documentation](https://docs.aws.amazon.com/amazondynamodb/latest/developerguide/HowItWorks.ReadConsistency.html)
- [Synchronous replication and synchronous_commit — PostgreSQL documentation](https://www.postgresql.org/docs/current/warm-standby.html)
- [Default MongoDB read concerns / write concerns — MongoDB documentation](https://www.mongodb.com/docs/manual/reference/mongodb-defaults/)
- [Inside Cloud Spanner and the CAP Theorem — Eric Brewer, Google Cloud](https://cloud.google.com/blog/products/databases/inside-cloud-spanner-and-the-cap-theorem)
