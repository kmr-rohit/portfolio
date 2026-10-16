---
title: "Secondary Indexes at Scale"
summary: "On one database, needing to query by a second column is a non-event. You run CREATE INDEX and go to lunch."
stage: 3
stageName: "Scaling data"
tier: "core"
seq: 22
tags: ["indexing", "denormalization", "cdc", "sharding"]
---

On one database, needing to query by a second column is a non-event. You run `CREATE INDEX` and go to lunch.

On a sharded table it's an architectural decision, and the reason is worth understanding properly.

---

## The setup

Say you have an `Orders` table sharded on `orderId`. Point lookups by order id are fast — one shard, one row.

Now the customer service team needs "all orders for customer 4711." `customerId` isn't the shard key. What are your options?

---

## Option one: a local index on every shard

Each shard builds a B-tree over its own rows' `customerId`. Simple, and it uses machinery the database already has.

The problem is the query. Customer 4711's orders could be on any shard, because `orderId` said nothing about the customer. So you ask **every shard** "do you have any?" and merge what comes back.

That's fine at ten shards for a query that runs a hundred times a day. It's fatal at a thousand shards for a query on a hot path, for two reasons. Your latency becomes the slowest shard's response time. And your cost grows every time you scale out — you added machines to handle load and made this query worse. → [Sharding and Partitioning](/learn/system-design/sharding-and-partitioning)

---

## Option two: a global index

Build a separate structure, keyed by `customerId`, sharded on `customerId`. Now the lookup is a single-shard point read. Reads are solved.

Writes are where it falls over. Every time you touch `Orders`, you also have to touch the global index — which lives on a different machine. To keep them consistent you need both writes to succeed or neither.

You've reinvented the distributed transaction. Managed databases that offer global secondary indexes hide this from you, and charge for it in either write latency or in consistency guarantees you should go read the fine print on.

---

## Option three: build it yourself, on purpose

```
Base:   Orders(orderId PK, customerId, ...)     shard on orderId
Index:  CustomerOrders(customerId, orderId)     shard on customerId
```

That second table *is* a global secondary index. You didn't avoid building one — you built it by hand.

The difference is that **you now own the consistency semantics.** The database would have given you either atomicity you can't afford or lag you can't tolerate. Writing it yourself lets you choose the third option: write the two rows sequentially, in an order where the only reachable inconsistency is a dangling pointer. → [Avoiding Distributed Transactions](/learn/system-design/avoiding-distributed-transactions)

When is the extra table worth it? When the query is hot, or on a correctness path. When it isn't — a rare admin query, a report — just scatter-gather and move on. Not every access path deserves an index.

---

## Why CDC usually isn't the answer here

Change Data Capture is the standard way to derive a second view: stream the base table's binlog, consume it, materialise the index. It's a good pattern with a genuinely nice property — the base table doesn't need to know the index exists.

It has one disqualifying characteristic for correctness paths: **lag**.

```
t = 0ms     row written to the base table, now visible to everyone
t = 5ms     another actor reads it and acts on it
t = 800ms   CDC finally materialises the index row
```

For 800 milliseconds, the index says the row doesn't exist. Anything that makes a decision from the index during that window — "does this customer already have an open order?" — gets the wrong answer.

And CDC lag isn't a fixed number. It's usually tens of milliseconds and it's **unbounded when the pipeline backs up**, which happens precisely when your system is busiest.

So the dividing line is: **CDC for derived read models, synchronous writes for anything a concurrency or correctness decision depends on.**

Good CDC targets: search indexes, analytics, ML features, caches, audit logs, history, notifications. Bad CDC targets: uniqueness checks, "do I already have one of these?", anything gating a claim.

---

## Know the simple answer too

On a single node, "at most one open order per customer" is a partial unique index:

```sql
CREATE UNIQUE INDEX ON orders (customer_id) WHERE status = 'OPEN';
```

One statement. Atomic. Enforced by the database. Done.

It only fails because a unique constraint across a **sharded** table needs a global index — which is exactly the thing we've spent this note avoiding.

That's worth leading with in an interview. Present the single-node answer, name precisely which constraint kills it, then derive the complicated one. Showing you know the cheap answer and why it doesn't apply is a stronger signal than producing the sophisticated answer straight away.

---

## In an interview

Lead with the single-node answer — a unique or partial index — and then name the exact constraint that kills it: the table is sharded on a different key. Showing you know the cheap answer, and why it doesn't apply, beats producing the complex one directly.

When you hand-roll a lookup table, call it what it is: a global secondary index you maintain yourself so you control the consistency semantics.

The trap: using CDC to build an index that a correctness decision depends on. Its lag is unbounded under load, which opens exactly the race you're trying to close.

## Seen in
- 03 - Data Model and Sharding — one table read three ways, two hand-rolled index tables, and why CDC was rejected

## Related
[Sharding and Partitioning](/learn/system-design/sharding-and-partitioning) · [Avoiding Distributed Transactions](/learn/system-design/avoiding-distributed-transactions) · [Replication and Read Consistency](/learn/system-design/replication-and-read-consistency)
