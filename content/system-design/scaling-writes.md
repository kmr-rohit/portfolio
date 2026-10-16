---
title: "Scaling Writes"
summary: "Reads had a ladder of cheap tricks. Writes don't: every write must land somewhere durable, in the right order, and you can't serve it from a cache. When Uber's ten million drivers report their location every five seconds, that's two million writes a second, and no read-side trick helps."
stage: 3
stageName: "Scaling data"
tier: "core"
seq: 26
tags: ["pattern", "writes", "sharding", "batching"]
---

Reads had a ladder of cheap tricks. Writes don't: every write must land somewhere durable, in the right order, and you can't serve it from a cache. When Uber's ten million drivers report their location every five seconds, that's two million writes a second, and no read-side trick helps.

Scaling writes is about reducing the **cost per write**, reducing the **number of writes**, and **spreading** what's left across machines without creating a hot spot.

<figure class="sd-figure"><img src="/system-design/diagrams/scaling-writes.svg" alt="Diagram: Scaling Writes" loading="lazy" decoding="async" /></figure>

---

## 1. Make each write cheaper

- **Batch.** One request carrying a thousand records is far cheaper than a thousand requests: fewer round trips, less per-request overhead. Elasticsearch wants bulk requests; warehouses want files, not rows.
- **Append, don't update.** Sequential appends (a log, an LSM tree) are much faster than random in-place updates. That's why Kafka and Cassandra take writes so cheaply. → [Kafka](/learn/system-design/kafka) · [Cassandra and DynamoDB](/learn/system-design/cassandra-and-dynamodb)
- **Don't do it in the request.** Acknowledge once the write is **durable in a log**, and do the expensive work (indexing, fan-out, notifications) asynchronously. The user needs "we won't lose it", not "it's fully processed". → [Event-Driven Architecture](/learn/system-design/event-driven-architecture)

## 2. Do fewer writes

- **Coalesce.** Ten thousand likes on one tweet become one update per batch, keeping only the latest count. A stream job turns a million view events into a few hundred `+N` writes.
- **Sample.** For popularity and analytics, logging 1 in N events ranks the same. (Never for money.)
- **Vary the rate.** A parked driver reports every 30 seconds; one on a motorway every 3. Adaptive intervals cut total volume several-fold.
- **Skip the write:** compute derived data on read when it's cheap, instead of maintaining it.

## 3. Trade durability where it's cheap

Not every write must survive. A driver's position is worthless in five seconds, and the recovery for a lost one is "the driver pings again". So put it in memory with a TTL and async replication, and accept losing a few seconds on failover. Compare the ride record, where losing a row loses a customer's trip. Same system, opposite decisions. → Uber · [TTL as a Coordination Primitive](/learn/system-design/ttl-as-a-coordination-primitive)

## 4. Shard the writes

When one node can't take the rate, split by a **write key** so each shard sees a fraction. → [Sharding and Partitioning](/learn/system-design/sharding-and-partitioning)

- Choose the key the **queries** use, not the one that balances load best. Round-robin balances perfectly and makes every read a scatter-gather. Then fix imbalance by splitting, not by changing the key.
- **Colocate what's contended** so one node settles a race (shard rides by `rideId`, seats by `showId`).
- **Hash or range?** Hash spreads evenly; range keeps neighbours together (and a hierarchical range, like H3 cells, splits a hot region with one row swap). → [Hotspots and Dynamic Resharding](/learn/system-design/hotspots-and-dynamic-resharding) · [Consistent Hashing](/learn/system-design/consistent-hashing)

## 5. Hot keys need their own fix

Sharding spreads *different* keys, not one. A viral ad, a celebrity, a hot listing sends all writes to one shard.

- **Split the key:** write `ad:42:0..N`, keep partial counts and merge on read (or in a two-stage stream job).
- **Batch in front:** aggregate in the app or a stream job so the hot key gets one write per second, not ten thousand.
- **Move the write off the hot path:** append the event to a log (one partition handles 50+ MB/s) and aggregate downstream.

→ Ad Click Aggregator · News Feed

## 6. Writes that fan out

One logical write that becomes many (a post to a million followers, a message to a group, a permission change on a folder) is the expensive kind. Bound it (a 500-user share cap, a friend cap), switch strategy above a threshold (push for normal accounts, pull for celebrities), or do it lazily. Batch the resulting writes **by destination shard** and issue them in parallel. → News Feed · Chat System

---

## Correctness when writes go async

Faster writes mean weaker guarantees, so state them.

- **At-least-once means duplicates:** make the write idempotent (a unique key, a conditional write, an upsert). → [Idempotency](/learn/system-design/idempotency)
- **Order the dual writes** so the failure is harmless (write the row that grants the right to act first), or use an outbox. → [Avoiding Distributed Transactions](/learn/system-design/avoiding-distributed-transactions)
- **Ordering:** keep it per key by partitioning on that key.

---

## In an interview

Give the write rate first, then say which rung you're on: batch, async log, shard, hot-key fix. Say what you traded for it (durability, freshness, ordering). Name the shard key and the query it serves.

The trap is "shard it" with no key, no hot-key answer and no idempotency story.

## Seen in
- Uber — 2M writes/s of disposable location data versus 100/s of precious ride data
- Ad Click Aggregator — Kafka on the write path, salted hot ads, aligned partitions
- Chat System — fan-out on write with a cap, and the large-group switch
- Twitter Search — bulk upserts, one update per tweet per batch
- Metrics Monitoring — batching and downsampling time-series writes
- Gaming Leaderboard — hot sorted sets and score updates

## Related
[Scaling Reads](/learn/system-design/scaling-reads) · [Sharding and Partitioning](/learn/system-design/sharding-and-partitioning) · [Message Queues](/learn/system-design/message-queues) · [Event-Driven Architecture](/learn/system-design/event-driven-architecture)
