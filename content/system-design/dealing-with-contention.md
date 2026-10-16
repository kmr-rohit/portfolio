---
title: "Dealing with Contention"
summary: "Two people tap seat G12 at the same moment. Your code reads \"available\", checks it, and writes \"booked\". Both requests read \"available\" first, both pass, and both write. The second write overwrites the first. Two confirmations for one seat."
stage: 4
stageName: "Distributed systems and coordination"
tier: "core"
seq: 33
tags: ["pattern", "contention", "concurrency", "locks"]
---

Two people tap seat G12 at the same moment. Your code reads "available", checks it, and writes "booked". Both requests read "available" first, both pass, and both write. The second write overwrites the first. Two confirmations for one seat.

That's **contention**: many actors competing to change the same piece of state. It's not a throughput problem (a 50,000-seat show produces 50,000 successful writes, ever). It's a **correctness** problem first, and at scale a **survival** problem.

<figure class="sd-figure"><img src="/system-design/diagrams/dealing-with-contention.svg" alt="Diagram: Dealing with Contention" loading="lazy" decoding="async" /></figure>

---

## The ladder

### 1. Make the check part of the write

The gap between the read and the write is the bug, so remove the gap.

```sql
UPDATE show_seats SET status='BOOKED', booking_id=:b
 WHERE show_id=:s AND seat_id='G12' AND status='AVAILABLE';   -- rows affected: 1 won, 0 lost
```

A **conditional update** (compare-and-set) is atomic on one row. No lock service, no consensus, no transaction ceremony. The same shape settles "one driver per ride" (`WHERE driver_id IS NULL`) and "increment only if newer".

For several rows at once, wrap the conditional update in a transaction and check that the affected count equals the number you asked for; roll back otherwise. Lock rows in a consistent order (`ORDER BY seat_id`) to avoid deadlocks.

### 2. Colocate the contenders

An atomic row update only decides the race if **everyone competing for the same thing hits the same row on the same node**. Shard by the contested thing: rides by `rideId`, seats by `showId`. That partitioning choice is what makes the concurrency control trivial. → [Sharding and Partitioning](/learn/system-design/sharding-and-partitioning) · [Avoiding Distributed Transactions](/learn/system-design/avoiding-distributed-transactions)

### 3. Use a unique constraint as the mutex

Let the database refuse the second one. A unique index on `(show_id, seat_id)`, or `(user_id, idem_key)`, or `(listing_id, author_id)`, makes a duplicate insert fail. `INSERT ... ON CONFLICT DO NOTHING` plus a returned row count tells you whether you won. It's also the cleanest idempotency mechanism. → [Idempotency](/learn/system-design/idempotency)

### 4. Pessimistic lock (`SELECT ... FOR UPDATE`)

Take the row lock first and hold it through your logic. Correct, and simple to reason about. It holds a transaction open, so keep the critical section tiny and never hold it across a human, a payment call or any slow network hop.

### 5. Optimistic concurrency

Read the row with a **version**; write `WHERE version = :v` and bump it; retry on zero rows. No lock is held while you think, and it works well when conflicts are rare. Under heavy contention it becomes a **retry storm**, because 99% of attempts lose and each one retries. `SERIALIZABLE` isolation has the same character. → [Transactions and Isolation](/learn/system-design/transactions-and-isolation)

### 6. Distributed locks and leases

Last resort, and never the only defence. A lease can expire under a paused holder, so the resource must check a **fencing token**. → [Distributed Locks and Fencing Tokens](/learn/system-design/distributed-locks-and-fencing-tokens)

---

## When a human is in the middle: holds

Between "I want G12" and "here's my card" there are ninety seconds. Claiming at payment time means most people lose after typing their card; holding a lock open destroys the database.

Make the **hold a piece of data with an expiry**: `status='HELD', hold_id, hold_expires_at`. A short transaction claims it and commits; the hold lives in the row for ten minutes. Put expiry in the predicate (`status='AVAILABLE' OR (status='HELD' AND hold_expires_at &lt; now())`) so an expired hold is claimable without waiting for a cron job. Confirm with `WHERE hold_id = :mine` so a late payment against an expired hold matches zero rows (a fencing token) and triggers a refund. → BookMyShow · [TTL as a Coordination Primitive](/learn/system-design/ttl-as-a-coordination-primitive)

---

## When the herd arrives: keep them out

Everything above is correct under load and still useless if fourteen million people reach the same shard. Autoscaling forwards more doomed requests to the one place that can't scale, and you can't shard contention on individual rows.

**Admission control:** hold people **outside** in a virtual waiting room (a Redis sorted set for position, a static page on a CDN), and admit a controlled number at a time, sized from what the booking system can absorb. It isn't a buffer of requests; requests aren't made until admitted. The number of concurrent contenders becomes something you choose. Add **fairness** (randomise position among arrivals before the sale opens) and an honest sold-out message. → BookMyShow · [Rate Limiting](/learn/system-design/rate-limiting)

For hot counters and hot keys (likes, views), **shed the write**: batch, coalesce or split the key, since the losers of a contested counter don't need to retry, they need to be *counted*. → [Scaling Writes](/learn/system-design/scaling-writes)

---

## Choosing

| Situation | Reach for |
|---|---|
| One row, low-to-moderate contention | conditional update / unique constraint |
| Several rows, all-or-nothing | transaction + conditional predicate, ordered locks |
| Rare conflicts, long think time | optimistic version check |
| Human in the loop | expiring hold as data + fencing token |
| Cross-node exclusivity you can't colocate | lease + fencing token |
| Flash crowd on one resource | queue in front (admission control) |

---

## In an interview

Show the read-check-write race with two requests, say that a plain transaction at `READ COMMITTED` doesn't fix it, then land on the conditional write and *why it's enough* (the shard key colocates contenders). Then say what handles the human delay and the flash crowd.

The trap is proposing a distributed lock as the mechanism that prevents double booking.

## Seen in
- BookMyShow — the seat claim, holds with expiry, `hold_id` fencing, the waiting queue
- Uber — the driver claim as a single conditional update
- URL Shortener — claiming a key with `FOR UPDATE SKIP LOCKED`
- Google Drive — the version insert as the conflict detector
- Online Auction — bid ordering on a hot item
- Flash Sale — inventory decrement and the queue in front
- Yelp — the one-review-per-user constraint made local by the shard key

## Related
[Transactions and Isolation](/learn/system-design/transactions-and-isolation) · [Idempotency](/learn/system-design/idempotency) · [Avoiding Distributed Transactions](/learn/system-design/avoiding-distributed-transactions) · [Distributed Locks and Fencing Tokens](/learn/system-design/distributed-locks-and-fencing-tokens)
