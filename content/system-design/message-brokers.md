---
title: "Message Brokers"
summary: "Message Queues and Publish-Subscribe describe shapes of communication. A message broker is the actual software that holds the messages, decides where they go, and remembers who has seen what."
stage: 7
stageName: "Async and messaging"
tier: "core"
seq: 49
tags: ["messaging", "kafka", "rabbitmq", "infrastructure"]
---

[Message Queues](/learn/system-design/message-queues) and [Publish-Subscribe](/learn/system-design/publish-subscribe) describe shapes of communication. A message broker is the actual software that holds the messages, decides where they go, and remembers who has seen what.

Which broker you pick is one of the few infrastructure decisions that changes what your architecture can do, so it's worth understanding the machinery rather than memorising logos.

---

## "Can't I just use a database table?"

You're building a photo-sharing site. Every upload needs three thumbnails generated, and you've decided that shouldn't happen on the request path. You need a queue. You already run Postgres. So:

```sql
CREATE TABLE jobs (
  id          bigserial PRIMARY KEY,
  payload     jsonb NOT NULL,
  status      text NOT NULL DEFAULT 'pending',
  attempts    int  NOT NULL DEFAULT 0,
  created_at  timestamptz NOT NULL DEFAULT now()
);
```

Workers poll every second:

```sql
SELECT * FROM jobs
 WHERE status = 'pending'
 ORDER BY created_at
 LIMIT 1
 FOR UPDATE SKIP LOCKED;     -- another worker won't grab the same row
```

**This is a genuinely good design and you should say so in an interview.** At a few thousand jobs an hour it's simpler than running a broker, it's transactional with the rest of your data, and `SKIP LOCKED` gives you correct competing consumers in one line. Plenty of production systems ship like this forever.

Now grow it to 5,000 uploads a second and watch it come apart.

**The polling gets expensive before the work does.** Two hundred workers each running a query every second is 200 queries per second whether or not there are any jobs, all hitting the same index on the same primary. Poll less often and your p99 job latency becomes your poll interval.

**The table fights your product for the same database.** Every job insert, status update and delete is a write against the primary that's also serving photo uploads. Deleted rows accumulate as dead tuples until autovacuum catches up, and on a hot jobs table it usually doesn't. The index bloats and the whole box gets slower — including the parts that have nothing to do with thumbnails.

**You can't fan out.** When the search team also wants to know about every upload, there's no clean way to let two independent readers each consume all rows without inventing per-consumer cursor tables.

**And you slowly rebuild a broker, badly.** A worker that dies holding a row leaves it locked until the transaction times out, so you add a lease column and a reaper. Then you add `attempts` and a max, then a `failed_jobs` table, then exponential backoff with a `visible_after` timestamp. Each of those is a feature a broker ships with, and yours is the version that hasn't been tested by anyone else.

That's the moment to move the messages out of your database and into something whose only job is messages.

---

## What a broker is actually responsible for

Four jobs. Every broker does all four; they differ almost entirely in *how*.

**Accept and persist.** Take the producer's message, write it durably — usually replicated to several nodes — and only then acknowledge the publish. The acknowledgement is the contract: once the producer has it, the broker owns the message. Get this wrong and you have a producer that thinks its message is safe sitting in a buffer that's about to be lost.

**Route.** Decide which queues or subscriptions a published message belongs to. This ranges from trivial (SQS: one queue, no decision) to a small rules engine (RabbitMQ topic exchanges, SNS filter policies).

**Deliver and track.** Hand messages to consumers and remember what happened next. Who has it. Whether they acknowledged. Whether it's time to redeliver. This bookkeeping is where brokers diverge most sharply.

**Order.** Provide a defined sequence, at whatever granularity it promises — per queue, per message group, per partition. Almost nobody promises global order, because global order means a single serialisation point, which means a throughput ceiling.

Worth saying plainly: the broker is doing work your services would otherwise each do for themselves, inconsistently. That's the whole value proposition.

---

## The fork in the road: delete on ack, or keep the log

Here's the distinction that actually matters, and the one most candidates never articulate.

**What does the broker do with a message after a consumer has successfully handled it?**

There are two answers, and everything else about a broker's behaviour follows from which one it gives.

### Queue-based brokers: the message is an object with a lifecycle

RabbitMQ, SQS, ActiveMQ. A message is a thing the broker owns and tracks individually. It moves through states — enqueued, delivered-but-unacked, acknowledged — and when it's acknowledged it's **deleted**. The broker's job is to get each message safely to exactly one consumer and then forget it.

Because the broker maintains per-message state, it can do per-message things, and this is a much longer list than people expect:

- Redeliver *that one* message after a visibility timeout or a nack, while everything else flows past it.
- Move *that one* message to a dead-letter queue after N failed attempts.
- Expire *that one* message with a per-message TTL — an offer that's worthless after 60 seconds should not be delivered at minute five.
- Deliver a priority-9 message ahead of the priority-1 messages already queued.
- Delay delivery until a future time.
- Route the same publish to several queues by content.

The cost is that all that bookkeeping is per message, in the broker. Deep queues get expensive — a RabbitMQ queue with tens of millions of messages is a queue that's about to have a bad day. And once a message is acked it is *gone*. There's no replay, because there's nothing left to replay.

### Log-based brokers: the message is a position in a file

Kafka and Pulsar. A topic partition is an **append-only log**. Producers append to the end. Each record gets a monotonically increasing **offset**, which is just its position. Reading is a sequential scan from wherever you are.

Reading does not delete. The Kafka documentation states it directly — events "are not deleted after consumption." Messages disappear when the **retention policy** says so, typically a time window (seven days by default) or a size cap, and not one moment sooner. Whether anyone read them is irrelevant.

The broker therefore tracks almost nothing per message. It doesn't know which consumers have handled which records. All it stores is one number per consumer group per partition: the **committed offset**, the position that group has processed up to. That single design choice is where the consequences come from.

Sequential appends to a file are about the fastest thing a disk does, and serving reads is often just `sendfile` from page cache to socket with no copy through the application. There's no per-message state machine to update. A single broker moving on the order of a million messages a second is a realistic ballpark for modestly sized messages on decent hardware.

More importantly, **the data is still there**, so a consumer group can move its offset backwards and re-read. Ship a bug that mangled the last six hours of thumbnails? Fix it, reset the offset, replay. Add a brand new consumer group next year and have it start from the beginning of retention. Neither is possible on a queue-based broker at any price, because the messages no longer exist.

And every one of the per-message features above is now impossible or awkward. There is no per-message TTL, because retention is per partition. There is no priority, because the order is the file order. There is no "retry just this one," because your position is a single number — skipping a record means committing past it and losing it, or blocking the whole partition. Kafka has no built-in consumer retry at all; the standard workaround is to publish the failure to a separate retry topic or a DLQ topic and move on.

| | Queue-based (RabbitMQ, SQS) | Log-based (Kafka, Pulsar) |
|---|---|---|
| After a successful read | message deleted | message stays until retention expires |
| Broker tracks | per-message state | one offset per group per partition |
| Replay old messages | no | yes, rewind the offset |
| Per-message TTL / priority / delay | yes | no |
| Retry one bad message | yes, natively | no — retry topic or DLQ topic |
| Routing intelligence | rich (exchanges, filter policies) | none — consumer filters |
| Ordering scope | per queue / per message group | per partition |
| Scaling limit | queue depth and broker memory | partition count |

<aside class="sd-callout sd-callout--tip">



When you're asked to justify a broker choice, the question to answer out loud is which of these two you're buying: per-message control, or replay. A queue-based broker keeps state for every message, so it can do things to individual messages. A log-based broker keeps almost none, so it can move far more of them and keep them around afterwards. No single system gives you both, and picking one means saying which you gave up.

</aside>

---

## Kafka up close

### Partitions are the unit of everything

A topic is split into **partitions**, and a partition is one log file living on one broker (plus its replicas). Partitions are simultaneously the unit of parallelism, of ordering, and of scaling — which is why partition count is the first number you should decide.

Producers pick a partition by hashing the message key: `partition = hash(key) % num_partitions`. Same key, same partition, always. No key means round-robin across partitions.

That gives you the ordering rule. **Kafka guarantees order within a partition and makes no promise across partitions.** Key by `photoId` and every event for that photo is processed in order, while millions of other photos proceed in parallel. There's no global sequence, and you don't want one.

The key choice is a [Sharding and Partitioning](/learn/system-design/sharding-and-partitioning) decision wearing different vocabulary, and it fails the same way. Key by `country` in a business where 60% of traffic is one country and that partition's broker melts while the rest idle. The fixes are the familiar ones: pick a higher-cardinality key, salt the hot key with a suffix, or drop the key entirely for that stream and give up ordering you didn't need ([Hotspots and Dynamic Resharding](/learn/system-design/hotspots-and-dynamic-resharding)).

One asymmetry to remember: you can increase a topic's partition count, but doing so changes `hash(key) % n` for every key, so messages for a key start landing in a different partition than their history. Ordering across the change is broken. Over-provision partitions up front rather than resizing under pressure.

### Offsets and consumer groups

Each consumer group holds one committed offset per partition, stored in Kafka itself (in the internal `__consumer_offsets` topic). Restart a consumer and it reads its committed offset and resumes. That's the entire state.

Within a group, **each partition is assigned to exactly one consumer**. Twelve partitions can feed at most twelve useful consumers in a group; the thirteenth sits idle. Across groups, everybody gets everything — fan-out for free, since there's only one copy of the data and each group just has its own cursor.

When a consumer joins, leaves or stops heartbeating, the group **rebalances**: partition assignments are recomputed. Older protocols stop the world while this happens, so a deploy that rolls twelve consumers can cause twelve rebalances and a visible processing gap. Cooperative/incremental rebalancing only moves the partitions that need to move. If an interviewer asks what goes wrong when you scale a Kafka consumer fleet, rebalance storms are the answer they're fishing for.

Commit timing is the delivery-guarantee knob from [Message Queues](/learn/system-design/message-queues), spelled in Kafka. Commit the offset *before* processing and a crash loses the record — at-most-once. Commit *after* and a crash replays it — at-least-once, the default, and the reason your consumer must be idempotent ([Idempotency](/learn/system-design/idempotency)). Kafka's exactly-once semantics — idempotent producers plus transactions that commit the output records and the input offsets atomically — are real, but they only hold inside Kafka. The moment your consumer calls a payment API, you're back to at-least-once.

### Replication, ISR, and how to lose data by accident

Each partition has one **leader** replica and some **followers**. All reads and writes go to the leader; followers pull from it. A replication factor of 3 — one leader, two followers, on three different brokers — is the common production setting. If the leader's broker dies, a follower is promoted.

Followers that are caught up form the **in-sync replica set (ISR)**. The producer's `acks` setting decides how many of them must have the record before the broker acknowledges the publish:

- `acks=0` — don't wait at all. Fastest, and the producer is lying to you about durability.
- `acks=1` — the leader has it. If the leader dies before any follower replicates, that record is gone.
- `acks=all` — every in-sync replica has it. Slowest and the only one you can call durable.

<aside class="sd-callout sd-callout--warning">



`acks=all` alone is not enough. If followers have fallen behind, the ISR can shrink to just the leader, and "all in-sync replicas" becomes "the leader" — you're back to `acks=1` without changing a config. Pair `acks=all` with `min.insync.replicas=2` so the broker rejects the write rather than silently accepting a single-copy one.

</aside>

### Retention and compaction

Two retention modes, and the second one is genuinely a different data structure.

**Time or size based deletion** is the default: keep seven days, or keep 500 GB, whichever policy you set, then delete the oldest segments.

**Log compaction** keeps the *most recent* record for each key forever and garbage-collects older versions of that key. The log stops being a stream of events and becomes a durable changelog of current state — replay it from the beginning and you've reconstructed the latest value for every key. This is how Kafka backs materialised views and stateful stream processors, and it's the mechanism underneath a lot of [CQRS](/learn/system-design/cqrs) and [Event Sourcing](/learn/system-design/event-sourcing) plumbing.

Rough sizing numbers to have in your head, treating them as order-of-magnitude rather than gospel: a broker handles on the order of a terabyte of storage and around a million messages a second, and messages should stay under about 1 MB — Kafka is not a file transfer system. Large payloads go to blob storage and the message carries the URL.

<aside class="sd-callout sd-callout--note">



Pulsar is worth one line because it solves Kafka's most annoying operational property. Kafka couples serving and storage on the same broker, so adding a broker means physically rebalancing partition data across the cluster. Pulsar separates the serving layer (brokers) from the storage layer (BookKeeper), so you scale each independently and adding a broker is instant. It also supports per-subscription modes that give you queue-like semantics on a log.

</aside>

---

## RabbitMQ up close

Kafka's producer picks a partition. RabbitMQ's producer doesn't pick anything — it publishes to an **exchange**, and the exchange decides.

That indirection is the entire design. A producer publishes a message with a **routing key** to an exchange. Queues are attached to exchanges by **bindings**, each with a binding pattern. The exchange compares the routing key against the bindings and copies the message into every queue that matches. Consumers only ever read from queues.

<figure class="sd-figure"><img src="/system-design/diagrams/message-brokers.svg" alt="Diagram: Message Brokers" loading="lazy" decoding="async" /></figure>

Four exchange types cover essentially everything:

| Exchange type | Routing rule | What you'd use it for |
|---|---|---|
| **direct** | routing key equals binding key exactly | send this job to the `transcode` queue |
| **fanout** | ignore the key, copy to every bound queue | broadcast — pub/sub within RabbitMQ |
| **topic** | dotted pattern match, `*` = one word, `#` = zero or more | `order.eu.*`, `photo.#` — the workhorse |
| **headers** | match on message header attributes, any or all | routing on structured metadata, not a string |

The payoff is that routing lives in broker configuration rather than producer code. Adding a consumer for `photo.uploaded.hd` means declaring a queue and a binding — no publisher changes, and no publisher restart. That's the same decoupling a topic gives you in [Publish-Subscribe](/learn/system-design/publish-subscribe), but expressed as a configurable rules layer instead of a fixed topic name.

Two consumer-side controls matter in practice. **Acknowledgements** can be automatic (broker deletes on delivery — at-most-once, fast, lossy) or explicit (broker deletes only on ack — at-least-once). And **prefetch** caps how many unacknowledged messages one consumer may hold. Leave prefetch unbounded and one greedy consumer pulls the whole queue into its local buffer while its peers starve; set it to a small number and work distributes evenly. It's the flow-control knob, and forgetting it is the classic RabbitMQ production incident.

On durability: classic mirrored queues are deprecated as of RabbitMQ 4.0, and **quorum queues** are the modern replicated queue type. They're built on **Raft** — every operation goes through an elected leader and needs agreement from a majority, `(N/2)+1` of N members. A 3-member quorum survives one node failure, a 5-member quorum survives two. Messages confirmed to the publisher survive as long as a majority does. Quorum queues are always durable, support message and queue TTL, support 32 priority levels, and give at-least-once dead-lettering. They pay for it in latency, because every write is a consensus round, and they're a poor fit for workloads that create and destroy queues rapidly.

---

## SQS: the broker you don't run

SQS deserves its own paragraph because it occupies a distinct spot. It's queue-based — delete on ack, visibility timeouts, per-queue DLQ — but it has essentially no routing intelligence. There are no exchanges. A queue is a queue.

What you get instead is that there is nothing to operate. No cluster, no partitions to size, no leader elections, no disks. It scales to effectively unlimited throughput on standard queues without you doing anything, and the constraints are quotas rather than capacity: 1 MiB maximum message size, 14 days maximum retention, and 300 transactions per second per API action on a FIFO queue partition.

When you want routing on top, you put SNS in front and fan out to several SQS queues — a topic for distribution, a queue per subscriber for reliability. That combination covers a startling fraction of real systems, and "SNS to SQS" is a perfectly strong interview answer when the requirement is fan-out with per-consumer retries and no replay.

---

## The broker is now your single point of failure

You moved the queue out of your database to stop it taking your product down. If the broker is one process on one box, you've relocated the risk rather than removed it, and made it worse — because *every* service now depends on it.

Every serious broker answers this the same way: **clustering with replication**, so the data lives on several nodes and one node's death is survivable. The vocabulary differs, the shape doesn't.

Kafka replicates each partition to N brokers and elects a new partition leader when one dies; different partitions have leaders on different brokers, so load spreads and no single node is "the" broker. RabbitMQ quorum queues replicate via Raft and elect a new leader from the surviving majority. SQS replicates across availability zones and never tells you about it.

Two things follow from this that are worth saying in an interview. First, **replication protects against node loss, not against you**: a bad deploy that publishes malformed messages gets faithfully replicated three times. Second, a replicated broker is a consistency system, so the usual trade applies — `acks=all` with `min.insync.replicas=2` means the cluster will refuse writes rather than accept unsafe ones, which is choosing consistency over availability ([CAP Theorem](/learn/system-design/cap-theorem)). Know which one your business wants before the incident.

And notice the shift you've made architecturally. Every service now has a hard dependency on the messaging layer. That's a fair trade — one well-understood, heavily replicated, single-purpose system is easier to keep up than N direct service-to-service dependencies — but it's a real centralisation and you should name it rather than pretend the broker is free.

---

## Where this shows up

- **Kafka as the company-wide event backbone.** LinkedIn built it for exactly this; retention plus replay means a new team can consume last week's data without anyone re-emitting it.
- **RabbitMQ for task distribution.** Celery, Sidekiq-style job systems and anything needing priorities, per-message TTL or delayed retry — the per-message control is the point.
- **SNS to SQS for fan-out on AWS.** No cluster to run, per-subscriber retries and DLQs, filter policies for routing.
- **Change data capture into Kafka.** Debezium reads the database write-ahead log and publishes row changes; search indexes, caches and warehouses all subscribe to the same partitioned stream.

---

## In an interview

Don't just say "add Kafka." Say what property you need. If it's replay, retention or multiple independent consumers over the same stream, say log-based and name Kafka. If it's per-message retries, priorities, TTL or content routing, say queue-based and name RabbitMQ or SQS.

Expect "how do you guarantee ordering?" The answer is always per-key, never global: partition by the entity id in Kafka, message group id in SQS FIFO. Then volunteer the cost — head-of-line blocking within the key, and throughput proportional to key count.

Expect "what happens if a broker dies?" Replication factor, leader election, and the `acks` / `min.insync.replicas` pairing. Mentioning that `acks=all` degrades silently when the ISR shrinks is a strong signal.

The most common mistake is treating Kafka as a drop-in queue and then needing to retry one poison message. There's no mechanism for it — you publish to a retry topic and move on, and it's much better to know that before you've built on it.

---

## Seen in
- 05 - Matching and Real-Time Push — Kafka as the durable home for ride requests, partitioned by region so a busy city scales independently and the offset commits only after a match
- 06 - Location Sharing and Completion — a broker doing per-ride fan-out so neither server needs to know where the other one lives

---

## Related
[Message Queues](/learn/system-design/message-queues) · [Publish-Subscribe](/learn/system-design/publish-subscribe) · [Orchestration and Choreography](/learn/system-design/orchestration-and-choreography) · [Event-Driven Architecture](/learn/system-design/event-driven-architecture) · [CQRS](/learn/system-design/cqrs) · [Event Sourcing](/learn/system-design/event-sourcing) · [Sharding and Partitioning](/learn/system-design/sharding-and-partitioning) · [Hotspots and Dynamic Resharding](/learn/system-design/hotspots-and-dynamic-resharding) · [Consistent Hashing](/learn/system-design/consistent-hashing) · [Rate Limiting](/learn/system-design/rate-limiting) · [Idempotency](/learn/system-design/idempotency) · [CAP Theorem](/learn/system-design/cap-theorem) · [Clustering](/learn/system-design/clustering)

## Sources
- [Apache Kafka — introduction (topics, partitions, retention, replication)](https://kafka.apache.org/intro)
- [RabbitMQ — AMQP 0-9-1 model explained (exchanges, bindings, acknowledgements, prefetch)](https://www.rabbitmq.com/tutorials/amqp-concepts)
- [RabbitMQ — quorum queues](https://www.rabbitmq.com/docs/quorum-queues)
- [Amazon SQS message quotas](https://docs.aws.amazon.com/AWSSimpleQueueService/latest/SQSDeveloperGuide/quotas-messages.html)
- [Hello Interview — Kafka deep dive](https://www.hellointerview.com/learn/system-design/deep-dives/kafka)
- [Karan Pratap Singh — System Design: message brokers](https://www.karanpratapsingh.com/courses/system-design/message-brokers)
