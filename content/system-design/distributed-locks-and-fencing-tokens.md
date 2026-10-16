---
title: "Distributed Locks and Fencing Tokens"
summary: "Five drivers tap \"accept\" on the same ride. You want exactly one to win. The first idea is a lock: whoever holds lock:ride:9001 gets to assign the ride. Simple, until the lock holder pauses."
stage: 4
stageName: "Distributed systems and coordination"
tier: "core"
seq: 35
tags: ["locks", "fencing", "concurrency", "redis", "zookeeper"]
---

Five drivers tap "accept" on the same ride. You want exactly one to win. The first idea is a lock: whoever holds `lock:ride:9001` gets to assign the ride. Simple, until the lock holder pauses.

A lock service hands out a lock with a **lease** (a TTL), so a crashed holder can't block everyone forever. Client A takes the lock, then a stop-the-world garbage collection freezes it for 15 seconds. The lease expires. Client B takes the lock and writes. Client A wakes up, still believes it holds the lock, and writes too. **Two writers, and the lock didn't stop it.**

<figure class="sd-figure"><img src="/system-design/diagrams/distributed-locks-and-fencing-tokens.svg" alt="Diagram: Distributed Locks and Fencing Tokens" loading="lazy" decoding="async" /></figure>

---

## Why a lock alone can't be the correctness mechanism

The holder can't reliably know its lease expired. A GC pause, a slow disk, a VM migration or a clock jump can all sit *between* "I checked the lock" and "I wrote". No amount of checking before the write closes that gap. (Martin Kleppmann's well-known critique of Redis's Redlock makes this argument in detail.)

So a lock is an **efficiency** tool: it stops many clients doing the same expensive work and losing. It is not a **correctness** tool unless the resource itself can reject stale holders.

---

## The fix: a fencing token

Every time the lock is granted, the service also returns a **monotonically increasing number**. The client sends that number with every write, and the resource remembers the highest it has seen and **rejects anything lower**.

Walk through the drawing. A gets token 33. Its lease expires; B gets token 34 and writes. Storage has now seen 34. A wakes and writes with 33, and storage refuses it. The pause no longer matters.

The token can come from a ZooKeeper `zxid` or sequential znode, an etcd revision, a Raft term, or a database sequence. What matters is that it's monotonic and that the **storage layer checks it**.

---

## Often the database is the better lock

If the shared resource is a database row, let the database enforce exclusivity. A conditional update is atomic and needs no lock service.

```sql
UPDATE rides SET driver_id = :d, status = 'Claimed'
 WHERE ride_id = :r AND driver_id IS NULL;          -- rows affected 1 = you won
```

For seats, add the hold as a **fencing token in the row**: confirm only if `hold_id` is still yours.

```sql
UPDATE show_seats SET status = 'BOOKED'
 WHERE show_id = :s AND seat_id = 'G12' AND hold_id = :hold;
```

If the seat was taken by someone else in between, the update matches zero rows. That's a fencing token, expressed as a column. → Uber · BookMyShow · [Avoiding Distributed Transactions](/learn/system-design/avoiding-distributed-transactions)

---

## The options, honestly

- **Redis `SET key value NX PX 30000`:** one atomic command, fast, and fine as an efficiency lock. Release with a script that checks the value (so you don't delete someone else's lock). If Redis fails over and loses the key, two holders can exist. Use a fencing check or a database gate for anything that matters. → [Redis](/learn/system-design/redis)
- **ZooKeeper or etcd:** ephemeral nodes or leases with real consensus behind them, and monotonic sequence numbers you can use as tokens. Heavier and slower, and the strongest option. → [Leader Election and Consensus](/learn/system-design/leader-election-and-consensus)
- **Database row lock (`SELECT ... FOR UPDATE`):** correct, but holds a transaction open. Never hold it across a human or a network call to a slow party.
- **Optimistic concurrency:** read a version, write `WHERE version = :v`, retry on failure. No lock at all, and fine when contention is low. → [Transactions and Isolation](/learn/system-design/transactions-and-isolation)

---

## Design habits that avoid locks

- **Colocate the contenders** so one node settles the race (shard by the thing being fought over).
- **Make the claim a conditional write** rather than a read-then-write.
- **Use TTLs instead of releases.** A hold that expires on its own has no "unlock" that can be forgotten or fail. → [TTL as a Coordination Primitive](/learn/system-design/ttl-as-a-coordination-primitive)
- **Keep critical sections tiny** and never do network calls inside them.
- **Make work idempotent**, so a duplicate writer is harmless. → [Idempotency](/learn/system-design/idempotency)

---

## In an interview

If you propose a distributed lock, immediately say what happens when the lease expires under the holder, and name the fencing token or the conditional write that makes it safe. That's the difference between explaining a lock and understanding one.

The trap is presenting a Redis lock as the thing that prevents double booking.

## Seen in
- BookMyShow — Redis holds as an optimisation; the Postgres conditional update with `hold_id` is the gate
- Uber — the claim CAS, and the optional Redis lock that only avoids wasted work
- Web Crawler — a per-domain `SET NX` lock in the shared-frontier design, and why host partitioning removes it
- Job Scheduler — fencing a duplicate firing after a leader pause
- Online Auction — bid ordering on a hot item

## Related
[Leader Election and Consensus](/learn/system-design/leader-election-and-consensus) · [Idempotency](/learn/system-design/idempotency) · [Avoiding Distributed Transactions](/learn/system-design/avoiding-distributed-transactions)
