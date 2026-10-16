---
title: "Consistent Hashing"
summary: "You've split your data across N machines and you need a rule for deciding which machine holds what. Consistent hashing is what you reach for when N is going to change — and N always changes, either because you planned it or because a machine died at 3am."
stage: 3
stageName: "Scaling data"
tier: "core"
seq: 20
tags: ["consistent-hashing", "sharding", "distributed-systems", "caching"]
---

You've split your data across N machines and you need a rule for deciding which machine holds what. Consistent hashing is what you reach for when N is going to change — and N always changes, either because you planned it or because a machine died at 3am.

---

## Start with a ticketing site and one database

You're building a ticketing system. Concerts, sports, theatre. One table:

```sql
CREATE TABLE events (
  event_id   BIGINT PRIMARY KEY,
  venue_id   BIGINT,
  starts_at  TIMESTAMPTZ,
  seatmap    JSONB
);
```

One Postgres instance holds all of it, and for a long time that's fine. Then it isn't — the table outgrows the box, and the reads outgrow the CPU. So you buy three databases instead of one.

**How do we decide which database holds which event?**

The obvious rule, and a genuinely good first answer:

```
database_id = hash(event_id) % number_of_databases
```

Three databases, so `% 3`. Event 1234 hashes to something big, mod 3 gives 1, so it lives on DB1. Event 5678 gives 0, so DB0. Event 9012 gives 2, so DB2.

Look at what this buys you. Hash functions spread keys almost perfectly evenly, so each database gets a third of the rows without you doing anything. Every lookup by `event_id` is a point lookup to exactly one machine. And best of all, **there's no state anywhere** — every app server can compute the answer itself from the key and the number 3. No lookup table, no coordinator, no cache to keep fresh.

This works. Ship it.

---

## Then you add a fourth database

Six months later three isn't enough either. You provision DB3, change the config to `% 4`, and deploy.

Event 1234 used to live on DB1. Now `hash(1234) % 4` says DB3. It has to move.

**How much of your data moves?** Let's actually count it. A key stays put only if `h % 3 == h % 4`, and since both are decided by `h % 12`, you can just enumerate the twelve cases. Only `h % 12 ∈ &#123;0, 1, 2&#125;` satisfies it. Three cases out of twelve.

So **75% of your rows move**. You added 33% more capacity and paid for it by rewriting three quarters of your database.

It gets worse as you grow, not better. Going from N machines to N+1, the fraction that stays put is `1/(N+1)`. At three machines that's a quarter. At a hundred machines it's under 1% — you add one box and 99% of your data is on the wrong machine.

And "moving" understates it. During the migration there are two truths: app servers that got the new config compute `% 4`, app servers that didn't compute `% 3`, and for most keys those disagree. You're not doing a data transfer, you're doing a data transfer *plus* a distributed cutover where being wrong means reading a row that isn't there.

---

## And a node failing is the same disaster, unannounced

Now DB2's disk controller fails at 9pm on a Friday.

You're down to three working machines. Whatever your client library does next — drop the dead node and recompute `% 3`, or `% 2` — every remaining key remaps. You lost one third of your machines and 100% of your routing.

This is much worse when the thing being sharded is a **cache**. Every node in a memcached fleet suddenly believes it owns different keys than it did a second ago, so every lookup misses, so every request falls through to the database at once. A cache being down costs you its hit rate. A cache being *wrong* costs you the whole database.

So we can name exactly what we want, and it's a narrow, specific property:

**When the set of machines changes by one, about 1/N of the keys should move. Not all of them.**

Everything below is in service of that one sentence.

---

## The hash ring

The problem is that `N` is baked into the rule. Change N, change every answer. So stop hashing into N buckets.

Instead, hash into a **fixed enormous space that doesn't depend on N at all** — say 0 to 2³² − 1 — and treat that space as a circle, where the largest value wraps around to 0.

Then hash the *machines* into the same space, using their hostname or IP as the input. Now keys and machines live on one circle together.

**Rule: hash the key, walk clockwise, and the first machine you bump into owns it.**

A ring is easier to read unrolled. Using a 0–100 space instead of 2³² for legibility:

<figure class="sd-figure"><img src="/system-design/diagrams/consistent-hashing.svg" alt="Diagram: Consistent Hashing" loading="lazy" decoding="async" /></figure>

Each machine owns the arc that ends at it. DB1 owns `(10, 40]`, DB2 owns `(40, 75]`, DB0 owns `(75, 100] ∪ [0, 10]`.

Now add DB3 and hash it to position 90:

<figure class="sd-figure"><img src="/system-design/diagrams/consistent-hashing-2.svg" alt="Diagram: Consistent Hashing - 2" loading="lazy" decoding="async" /></figure>

DB3 takes `(75, 90]` — an arc that used to belong to DB0. **That's the only data that moves.** DB1 and DB2 don't notice anything happened. Keys at 58 still go to DB2; keys at 20 still go to DB1.

Removal works the same way in reverse. If DB1 dies, its arc `(10, 40]` is inherited by the next machine clockwise, DB2, which now owns `(10, 75]`. Everyone else is untouched.

On average, with K keys and N machines, adding or removing one machine moves about **K/N keys**. That's the property we asked for, and it falls out of the geometry rather than being enforced by anything.

The routing state is also trivially small. It's a sorted list of (position, machine) pairs, one per machine — kilobytes, not gigabytes. Every client can hold a copy and binary-search it:

```python
def owner(key):
    h = hash(key)                                  # 0 .. 2**32 - 1
    i = bisect_right(ring_positions, h) % len(ring_positions)
    return ring_nodes[i]                           # the % is the wraparound
```

Still no coordinator on the read path. We kept the thing that made modulo hashing attractive.

---

## The ring's own problem: those arcs aren't equal

Look back at that first diagram and be suspicious. DB1 owns 30 units of the circle, DB2 owns 35, DB0 owns 35. That's fine — but nothing made it fine. Those positions came out of a hash function, which is to say they're random points on a circle, and **random points are not evenly spaced.**

Hash three machine names and you could just as easily get 10, 15 and 75. Then DB1 owns 5% of the keyspace, DB2 owns 60%, and DB0 owns 35%. One machine is holding twelve times what another holds, and there's nothing you can do about it short of renaming the server.

This isn't bad luck, it's the expected behaviour. Drop N points on a circle at random and the largest gap is roughly `ln(N)/N` of the circle rather than the fair `1/N`. With ten machines, the unluckiest one owns something like a quarter of the keyspace instead of a tenth.

**And the failure case is worse than the imbalance case.** When DB1 dies, *exactly one* machine — its clockwise neighbour — inherits every single one of its keys. That neighbour's load doubles instantly. If it was already at 60% CPU, it now falls over too, and *its* combined range lands on the next machine clockwise, which also falls over. You've built a ring that fails around itself like dominoes.

---

## Virtual nodes

The fix is almost embarrassingly simple: **stop putting each machine at one point on the ring, and put it at many.**

Instead of hashing `"DB1"`, hash `"DB1#0"`, `"DB1#1"`, `"DB1#2"` … `"DB1#199"`. That's 200 positions on the ring, all owned by DB1, scattered all over the circle. Each of those positions is a **virtual node** (Cassandra calls them tokens). Three machines with 200 vnodes each gives a ring with 600 points on it.

Unrolled, the ring stops looking like three fat arcs and starts looking like this:

<figure class="sd-figure"><img src="/system-design/diagrams/consistent-hashing-3.svg" alt="Diagram: Consistent Hashing - 3" loading="lazy" decoding="async" /></figure>

Two problems get solved at once, which is why this design won.

**Balance.** Instead of betting the machine's whole share on one random arc, you're averaging 200 of them. The spread of each machine's total share shrinks roughly like `1/√V`, where V is vnodes per machine. Going from 1 to a couple hundred takes the imbalance from "routinely double" to "a few percent".

**Failure spreads out.** When DB1 dies now, its 200 arcs are inherited by whatever sits clockwise of each one — roughly 200 *different* successors, spread across every surviving machine. Each survivor picks up about `1/(N−1)` extra instead of one poor neighbour picking up everything. The dominoes don't line up any more. Same story when you add a machine: it takes a small slice from everyone rather than cutting one neighbour in half.

There's a third benefit you get for free. If some of your machines are bigger than others, **give the bigger ones more virtual nodes.** Capacity becomes a dial you turn, not a property of where a hash happened to land.

<aside class="sd-callout sd-callout--note">

<p class="sd-callout-title">This is what "tokens" means in Cassandra</p>

Cassandra 2.x allocated tokens randomly, which needed a lot of them to average out — the default was **256 tokens per node**. Version 3.0 added a deterministic token allocator that picks positions to balance the ring deliberately rather than hoping, and gets better balance with far fewer tokens per node.

</aside>

### What virtual nodes cost

More vnodes isn't strictly better, or Cassandra wouldn't have bothered with the deterministic allocator.

The ring metadata grows from N entries to V×N. That's still small in absolute terms, but it has to be gossiped around the cluster and agreed on, and gossip convergence gets slower as the membership table grows.

More subtly: with many vnodes, each machine shares arc boundaries with *many* other machines rather than just two. That means any given set of replicas is drawn from a wider pool, so the chance that some multi-node failure takes out a full replica set goes **up**, not down. Cassandra's own docs list increased failure risk and slower cluster-wide maintenance as the costs of a high token count.

---

## The thing consistent hashing does not fix: hot spots

This is the part that gets mis-stated in interviews constantly, so be careful with it.

Your ticketing site puts one enormous stadium tour on sale at 10am. It sells out in four minutes and takes 100× the read traffic of any other event on the platform.

That is **one `event_id`**. One hash. One position on the ring. One machine.

Virtual nodes don't help. Adding machines doesn't help — you can grow the fleet to a thousand nodes and every single request for that event still lands on the same box, which melts while the other 999 sit at 4% CPU.

The reason is simple once you say it out loud. Consistent hashing gives you an even distribution of **keys**. It quietly assumes an even distribution of **requests per key**. Real traffic is a power law and that assumption is always false.

There are three real fixes, and none of them is consistent hashing.

**Replicate the hot key.** Keep copies on R machines and read from any of them. Read load divides by R. Write load doesn't move at all, so this is the right answer for hot *reads* and the wrong answer for hot writes.

**Salt the key.** Write under `event:1234#0` through `event:1234#9`. Ten different hashes, ten ring positions, ten machines, a tenth of the load each. Reads now have to hit all ten and merge — but that's a fan-out of exactly ten whether your cluster has 10 machines or 10,000, so it stays affordable ([Sharding and Partitioning](/learn/system-design/sharding-and-partitioning) on bounded versus unbounded fan-out). What you give up is single-key atomicity, and any counter or conditional update on that key gets harder. AWS documents exactly this under the name **write sharding**, and it's needed because each DynamoDB partition tops out at 3,000 read units and 1,000 write units per second — a single key genuinely has a ceiling.

**Split the hot range adaptively.** Detect that one arc is hot and cut it, placing the halves elsewhere. This is what DynamoDB's adaptive capacity and HBase region splits do. Note what it requires: a *stored* placement map you can edit, not a pure function of the key. → [Hotspots and Dynamic Resharding](/learn/system-design/hotspots-and-dynamic-resharding)

<aside class="sd-callout sd-callout--warning">

<p class="sd-callout-title">The sentence interviewers are listening for</p>

"We'll use consistent hashing so no shard gets hot." That's wrong, and it's a common enough mistake that it reads as pattern-matching rather than understanding. Consistent hashing solves **rebalancing cost**. It does not solve **load skew**. Name which one you're solving.

</aside>

---

## In practice, adding a node usually moves no data at all

Here's a detail that surprises people. You'd assume that when the ring changes, terabytes start flying across the network. In production systems, mostly they don't — because of replication.

Real ring-based systems never store a key on *one* node. They store it on the next **R nodes clockwise**. Cassandra places replicas on consecutive nodes around the ring. DynamoDB keeps three copies across three availability zones.

So when a machine dies, the keys it owned are *already sitting on* the machines that just became responsible for them. Ownership shifts; nothing is copied. The failure is a routing event, not a migration.

Data genuinely moves only on **planned** membership changes — commissioning a new machine, decommissioning an old one — and then it's a background stream, rate-limited so live traffic doesn't notice, with the old owner serving reads until the new one has caught up.

The clean way to hold this in your head: **the ring tells you where a key should live. It does not put it there.** Placement and movement are two different mechanisms, and in Cassandra they have different names (token ring vs. streaming, hinted handoff, repair). When someone asks "what happens when a node dies?", the good answer is about replicas. The ring is just how everyone agrees on who's in charge now.

---

## Where this shows up

- **Apache Cassandra** — the entire data model rests on a token ring with virtual nodes, and replication is literally "the next R nodes clockwise."
- **Amazon DynamoDB** — descends from the Dynamo paper, which is where the ring-plus-virtual-nodes combination was popularised.
- **CDNs and cache fleets** — deciding which edge server holds which object. memcached clients have used ketama-style consistent hashing for two decades, and this is the *original* application: the 1997 Karger paper was about distributed web caching. → [CDN](/learn/system-design/cdn), [Caching Strategies](/learn/system-design/caching-strategies)
- **Load balancers with sticky routing** — Envoy's ring hash is ketama; its Maglev alternative trades slightly worse disruption for much faster lookups. → [Load Balancing](/learn/system-design/load-balancing)
- **Application-level sharding** — a service that shards state across its own instances rather than in a database, using a ring plus gossip membership so any node can route without a coordinator. → [Clustering](/learn/system-design/clustering), [Service Discovery](/learn/system-design/service-discovery)

---

## An honest counter-example: Redis Cluster doesn't use it

Redis Cluster does not have a hash ring. It carves the keyspace into a fixed **16,384 hash slots** and computes:

```
HASH_SLOT = CRC16(key) mod 16384
```

Each master node owns a subset of those slots. That's a modulo — the very thing we started by breaking. So why is it fine?

Because **16,384 never changes.** The key→slot map is permanent. Only the slot→node map changes, and that map is 16,384 entries, small enough to gossip around the cluster and cheap to edit. Adding a node means reassigning slots, not rehashing keys.

The trade is that slot migration becomes an explicit, coordinated operation rather than something that falls out of the geometry. Redis needs `MOVED` and `ASK` redirections so that clients stay correct while a slot is halfway between two nodes. Simpler to reason about, more machinery to operate.

That's worth generalising, because the same trick appears everywhere: **put a level of indirection between the key and the machine, sized so it never has to change.** Instagram did a third version of it — they hashed into several thousand *logical* shards mapped in code to far fewer physical databases, so growing the fleet means moving logical shards between machines and never re-bucketing a single row.

Three shapes of the same idea, and it's worth being able to place them:

| Approach | Keys moved when N changes | Routing state | Where you see it |
|---|---|---|---|
| `hash(key) % N` | ~all of them | none, computed | small fixed clusters, nothing elastic |
| Hash ring + vnodes | ~K/N | sorted list of V×N points | Cassandra, DynamoDB, memcached, CDNs |
| Fixed slots / logical shards | zero — slots move, keys don't | a slot→node map | Redis Cluster, Instagram, Vitess |

---

## In an interview

Bring it up the moment you say "we'll add nodes to this cluster" or "we'll shard the cache" — and volunteer the failure story, don't wait to be asked.

Expect these three pushes: *how many keys move when a node joins?* (about K/N). *Why virtual nodes?* (balance, and so a dead node's load spreads across everyone instead of one neighbour). *Does this fix hot keys?* (no — replication or salting does).

The most common mistake is presenting it as load balancing. It's rebalancing.

It's also completely fine to say that Cassandra, DynamoDB and Redis handle this for you, and that you'd only design a ring by hand if you were building the storage or routing layer yourself. Knowing when the mechanism is *yours* to design is part of the answer.

---

## Seen in
- 12 - How Uber Actually Does It — Ringpop: a consistent hash ring plus SWIM gossip membership for sharding inside the application, and the ring size where gossip convergence stops keeping up

## Related
[Sharding and Partitioning](/learn/system-design/sharding-and-partitioning) · [Load Balancing](/learn/system-design/load-balancing) · [Clustering](/learn/system-design/clustering) · [Hotspots and Dynamic Resharding](/learn/system-design/hotspots-and-dynamic-resharding) · [Caching Strategies](/learn/system-design/caching-strategies) · [CDN](/learn/system-design/cdn) · [Service Discovery](/learn/system-design/service-discovery)

## Sources
- [Hello Interview — Consistent Hashing](https://www.hellointerview.com/learn/system-design/core-concepts/consistent-hashing)
- [Karger et al., *Consistent Hashing and Random Trees* (STOC 1997)](https://www.semanticscholar.org/paper/Consistent-hashing-and-random-trees%3A-distributed-on-Karger-Lehman/02bb762c3bd1b3d1ad788340d8e9cdc3d85f33e1)
- [Apache Cassandra — Dynamo-style architecture, token ring and vnodes](https://cassandra.apache.org/doc/latest/cassandra/architecture/dynamo.html)
- [Redis Cluster specification — key distribution model](https://redis.io/docs/latest/operate/oss_and_stack/reference/cluster-spec/)
- [AWS — Best practices for designing and using partition keys in DynamoDB](https://docs.aws.amazon.com/amazondynamodb/latest/developerguide/bp-partition-key-design.html)
- [Instagram Engineering — Sharding & IDs at Instagram](https://instagram-engineering.com/sharding-ids-at-instagram-1cf5a71e5a5c)
