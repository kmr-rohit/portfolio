---
title: "Avoiding Distributed Transactions"
summary: "Two things need to happen together, and they live on different machines. The textbook answer is a distributed transaction. The practical answer is usually to restructure the problem so you never need one."
stage: 4
stageName: "Distributed systems and coordination"
tier: "core"
seq: 30
tags: ["transactions", "2pc", "saga", "compare-and-set", "consistency"]
---

Two things need to happen together, and they live on different machines. The textbook answer is a distributed transaction. The practical answer is usually to restructure the problem so you never need one.

---

## Why two-phase commit hurts

2PC is correct. It's just expensive in ways that compound:

A **coordinator round-trip** on every write — prepare, collect votes, commit. That's an extra network hop before anything is durable.

**Locks held across the network** for the whole duration. Not "for a few microseconds while the row updates" but "until every participant has answered."

**Blocking on coordinator failure.** If the coordinator dies after the prepare phase, participants sit there holding locks, unable to commit or abort, until someone recovers it.

And your availability becomes the *product* of every participant's availability. Three services at 99.9% gives you 99.7%.

None of that matters at ten transactions a second on a money transfer. All of it matters on a hot path.

---

## What 2PC actually does

Worth knowing properly, because "avoid 2PC" is advice you should be able to justify.

**Phase one, prepare.** A coordinator asks every participant "can you commit this?" Each one does all the work — takes locks, writes the changes durably to its log — and replies *yes* or *no*. A participant that votes yes has made a **promise it cannot break**. It must be able to commit even if it crashes and restarts before hearing back.

**Phase two, commit.** If every vote was yes, the coordinator writes its decision to its own log and tells everyone to commit. One no, and everyone aborts.

It's correct, and the cost is in that word *promise*. Between voting yes and hearing the decision, a participant is in an **in-doubt** state: locks held, unable to commit, unable to abort, unable to do anything but wait.

So if the coordinator dies after collecting votes but before broadcasting the decision, every participant sits there **blocked, holding locks, indefinitely** — until an operator intervenes. The data they've locked is unavailable to everyone else for the duration. That's why 2PC is called a blocking protocol, and it's the specific failure that makes it unsuitable for a hot path.

**Three-phase commit** adds a round to make the decision known before anyone commits, removing the blocking. It buys that by assuming bounded network delay, which real networks don't provide — so it's rarely used in practice.

Modern systems that genuinely need cross-shard atomicity (Spanner, CockroachDB) still run 2PC underneath — but they replicate the *coordinator* with Raft, so it can't disappear. That's the real fix: make the coordinator fault-tolerant, rather than pretending the protocol is cheap.

---

## Technique 1: colocate the contenders

This is the highest-leverage move, and it happens before you write any code — at the point you choose a shard key.

If everyone competing for the same decision lands on **the same shard**, then a conditional update on a single row is atomic by definition. One row, one node, no coordination:

```sql
UPDATE rides SET driver_id = :d, status = 'Claimed'
 WHERE ride_id = :r AND driver_id IS NULL;
```

One row affected means you won. Zero means someone else did.

There's no lock service here, no consensus round, no coordinator. The *sharding decision* did the work. That's why **choosing a shard key is choosing how hard your concurrency control will be** ([Sharding and Partitioning](/learn/system-design/sharding-and-partitioning)).

### Why a distributed lock isn't a substitute

People reach for Redis `SETNX` with a TTL. It's genuinely useful — it stops the losers doing work they're going to throw away — but it is not a correctness guarantee.

A lock with a timeout can expire **while you still believe you hold it**. A long GC pause, a slow disk, a clock skew between machines, and suddenly two processes both think they own the resource. Nothing about the lock prevents that; the TTL is the whole reason the lock is available at all.

So: use the lock as an optimisation, and keep the conditional write as the gate.

---

## Technique 2: order the writes so failing is harmless

You can't colocate. You have two rows on two shards. Write them sequentially — two ordinary single-shard writes — and choose the order deliberately.

**Write the row that grants the right to act before the row that is the action.**

The state you can get stuck in has to be *"a pointer to nothing"*: visible only to its owner, trivially detectable, and invisible to everybody else. It must never be *"an action nobody is accountable for."*

Concretely, say a user may have at most one open order, and you keep a pointer table plus an orders table on different shards.

Write the pointer first. Crash in between, and the user has a pointer to an order that doesn't exist. Their own lookup joins to nothing, reports an error, and they retry. Nobody else in the system ever looked at that pointer. A sweeper deletes it in a few minutes.

Write the order first. Crash in between, and there's a live order in the system — visible to fulfilment, claimable by a worker, chargeable — while the user's own index says they have nothing. So they create a second one.

Same two writes. Same failure. Completely different blast radius.

On teardown, run it backwards: the permission row is removed **last**.

What you're trading is atomicity, for latency and availability, paid for with a small amount of reconciliation. That's a real trade — name it as one rather than pretending the problem went away.

---

## Technique 3: sagas

A sequence of local transactions, each with a compensating action that undoes it.

Technique 2 is really a two-step saga, ordered so the compensation is a no-op. Full sagas earn their complexity when the steps span services and genuinely need undoing — charge then refund, reserve then release.

---

## Technique 3b: sagas, properly

If you genuinely need a multi-step workflow across services, the saga is the real pattern, and there are two shapes.

**Orchestrated** — a coordinator explicitly calls each step and, on failure, calls the compensations in reverse. The workflow exists in one readable place, which makes it debuggable. The coordinator is a component you own and must keep available.

**Choreographed** — each service emits an event, the next reacts. No coordinator, no bottleneck — and the workflow exists in no single file, so understanding it means reading every service. → [Orchestration and Choreography](/learn/system-design/orchestration-and-choreography)

Two things about compensations are worth getting right, because they're where people's mental model breaks.

**A compensation is not a rollback.** A rollback erases history. A compensation is a *new business action that offsets a previous one*. You don't un-charge a card; you issue a refund. Both appear on the statement. The customer sees the charge and the refund, and that's correct — it's what actually happened.

Which means compensations must be designed, not derived. Some actions genuinely can't be compensated: you cannot un-send an email. The usual answer is to order the workflow so irreversible steps come **last**, once everything reversible has succeeded.

**Sagas have no isolation.** This is the real cost, and it's easy to miss. Each step commits independently, so intermediate states are *visible to everyone*. An order can be seen as "paid but not fulfilled" — a state that would never have been observable inside a single transaction.

Three countermeasures are worth naming:

- **Semantic lock** — mark the record with a pending status (`PAYMENT_PENDING`) so other readers know not to trust it yet.
- **Commutative updates** — design operations so order doesn't matter. An increment and a decrement commute; a "set to X" doesn't.
- **Re-read before committing** — check the value hasn't changed since you read it, which is the conditional write from Technique 1 again.

---

## The dual-write problem, and the outbox

A specific trap that shows up constantly once you have a database and a message broker.

You want to update a row *and* publish an event. Two systems, no shared transaction:

```
db.save(order)              # succeeds
broker.publish(OrderPlaced) # process dies here
```

The order exists and nobody was told. Do it the other way round and you publish an event for an order that was never saved. There is no ordering that fixes this, because the two systems can't commit together.

**The transactional outbox** solves it by making it one write. Insert the event into an `outbox` table *in the same database transaction* as the business change:

```sql
BEGIN;
  INSERT INTO orders (...) VALUES (...);
  INSERT INTO outbox (topic, payload) VALUES ('OrderPlaced', '{...}');
COMMIT;
```

Now they're atomic — same database, one transaction. A separate relay process then reads the outbox and publishes to the broker, marking rows as sent. The relay either tails the database's replication log (CDC, via something like Debezium) or polls the table.

Delivery is **at-least-once**: the relay can publish and die before marking the row, so it republishes on restart. That's fine, and it's the standard contract — make the consumer idempotent. → [Idempotency](/learn/system-design/idempotency), [Event-Driven Architecture](/learn/system-design/event-driven-architecture)

---

## Technique 4: make the second write unnecessary

**Derive it.** Rebuild the second view asynchronously from the first, with CDC or an outbox. This only works if the lag sits **off the correctness path**. A consumer that makes a concurrency decision from a lagging view will race, and the lag is unbounded exactly when the system is busiest. → [Secondary Indexes at Scale](/learn/system-design/secondary-indexes-at-scale)

**Expire it.** If the second write is a placement or presence record, a TTL removes the need to delete it atomically at all. → [TTL as a Coordination Primitive](/learn/system-design/ttl-as-a-coordination-primitive)

---

## Which to reach for

| Situation | Technique |
|---|---|
| Contenders share a shard key | single-row conditional update |
| Two rows, different shards, one logically precedes the other | ordered writes plus a sweeper |
| Multi-service workflow that genuinely needs undo | saga with compensations |
| Something must happen *later* and survive a crash | durable workflow (Temporal, Step Functions) |
| Genuinely atomic, low rate, money-like | 2PC — and say why it's worth it |

<aside class="sd-callout sd-callout--note">

<p class="sd-callout-title">That fourth row deserves emphasis</p>

An in-memory timer is a single point of failure wearing a disguise. Anything that has to happen later needs a durable home: a persisted state the next process can resume from, a queue with commit-after-success, or a workflow engine.

</aside>

---

## In an interview

Reach for the shard key before anything else. *"Every contender for this decision lands on the same shard, so a single-row conditional update is enough"* is a stronger answer than any coordination protocol, and it's the one most candidates miss.

If you need two writes across two shards, say the order out loud and what the reverse order would allow. Walking the crash between them takes twenty seconds and it's convincing.

The trap to avoid: proposing a Redis lock as the correctness mechanism. If you use one, say it's an optimisation to stop wasted work, and that the conditional write is still the real gate — because a TTL'd lock can expire while you still think you hold it.

## Seen in
- 02 - Ride Request Flow — permission row before fact row, and what the reverse order allows
- 05 - Matching and Real-Time Push — the claim CAS, and why a Redis lock isn't a substitute
- 03 - Data Model and Sharding — why CDC is rejected on the correctness path

## Related
[Sharding and Partitioning](/learn/system-design/sharding-and-partitioning) · [Secondary Indexes at Scale](/learn/system-design/secondary-indexes-at-scale) · [TTL as a Coordination Primitive](/learn/system-design/ttl-as-a-coordination-primitive) · [Idempotency](/learn/system-design/idempotency) · [Orchestration and Choreography](/learn/system-design/orchestration-and-choreography) · [Event-Driven Architecture](/learn/system-design/event-driven-architecture) · [Transactions and Isolation](/learn/system-design/transactions-and-isolation)

## Sources
- [Microservices.io: Saga pattern](https://microservices.io/patterns/data/saga.html)
- [Microservices.io: Transactional outbox](https://microservices.io/patterns/data/transactional-outbox.html)
- [Google: Spanner — TrueTime and distributed transactions](https://cloud.google.com/spanner/docs/true-time-external-consistency)
- [Martin Kleppmann, *Designing Data-Intensive Applications*, ch. 9](https://dataintensive.net/)
