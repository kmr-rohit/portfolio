---
title: "Stream Processing"
summary: "You want a dashboard of clicks per ad per minute, fresh within seconds. A nightly batch job computes it perfectly and a day late. A SELECT COUNT() GROUP BY minute on the raw table gets slower every day. So you count as events arrive, keeping a small running result per ad. That's stream processing."
stage: 7
stageName: "Async and messaging"
tier: "core"
seq: 55
tags: ["stream", "flink", "windows", "watermarks"]
---

You want a dashboard of clicks per ad per minute, fresh within seconds. A nightly batch job computes it perfectly and a day late. A `SELECT COUNT(*) GROUP BY minute` on the raw table gets slower every day. So you count *as events arrive*, keeping a small running result per ad. That's stream processing.

A stream processor (Flink, Kafka Streams, Spark Structured Streaming) reads an unbounded stream of events, keeps **state** per key, and continuously emits results.

<figure class="sd-figure"><img src="/system-design/diagrams/stream-processing.svg" alt="Diagram: Stream Processing" loading="lazy" decoding="async" /></figure>

---

## The building blocks

- **Source and sink:** usually a Kafka topic in, and a database, OLAP store or another topic out. → [Kafka](/learn/system-design/kafka)
- **Keyed state:** the job partitions the stream by a key (`ad_id`) and keeps per-key state (a counter, a set, a map). All events for one key go to one task, so state is local and fast.
- **Operators:** map, filter, join, aggregate, and window.
- **Parallelism:** as many tasks as partitions or key groups, spread over workers.

The fact that state lives *next to the computation* is what makes stream jobs fast, and it's also what makes recovery the interesting part.

---

## Windows

A running total forever isn't useful; you want counts per interval.

- **Tumbling:** fixed, non-overlapping (each minute). The minute view.
- **Sliding:** a fixed length that advances by a smaller step (the last 10 minutes, updated every minute); windows overlap. "Top 100 ads in the last M minutes."
- **Session:** grouped by gaps of inactivity (a user's visit).

---

## Processing time lies; use event time

If the job lags for four minutes and then catches up, **processing time** puts the 14:03 clicks into 14:07's bucket: a dip and a spike that never happened. Bucket by **event time** (when the click actually happened, carried in the event) and a replayed backlog lands in the right minutes.

**Whose clock?** A client's clock can be wrong or hostile. Stamp the event at the first server you control.

---

## Watermarks: when is a window finished?

With event time there's no moment when you *know* you've seen the last 14:03 event. A straggler may be in a slow network path.

A **watermark** is the processor's running estimate: "I've now seen everything up to time T". A window emits when the watermark passes its end. The simplest watermark is **bounded out-of-orderness**: the latest event time seen minus a fixed allowance (say 15 seconds).

The watermark is a **guess**, so decide what happens to events after it: **drop** them, **allow lateness** (re-emit an updated window), or send them to a **side output** for a batch job to fix. The batch layer that re-aggregates from raw events is what makes the final number correct. → Ad Click Aggregator

---

## State, checkpoints and exactly-once

A job that crashes loses its in-memory state. So the framework **checkpoints**: it periodically snapshots operator state together with the **source offsets** to durable storage. On failure it restores the last checkpoint and rewinds the sources to match, so state and position agree.

That gives **exactly-once state updates** inside the job. It does not give exactly-once effects on the outside world: a sink that isn't idempotent (or transactional with the checkpoint) can still see duplicates after a rewind. Make sink writes idempotent, keyed by window and key, or commit them with the checkpoint. → [Idempotency](/learn/system-design/idempotency)

Kafka Streams does the same job differently: state stores are backed by a **compacted changelog topic**, and recovery replays the changelog. Flink writes snapshots to durable storage.

---

## Hot keys and joins

- **Skew:** one hot key overloads one task. Do a **two-stage aggregation**: salt the key (`adId:0..N`) for local partial counts, then merge the partials. → [Hotspots and Dynamic Resharding](/learn/system-design/hotspots-and-dynamic-resharding)
- **Co-partitioned joins:** if two streams are partitioned by the same key with the same partition count, a task can join them locally with no network. That's how Chat System joins messages with membership.
- **Stream-table joins:** enrich events from a slowly changing table held as local state (fed by a CDC stream).

---

## Batch, stream, or both?

| Approach | Live counts | Corrections | Logic written |
|---|---|---|---|
| Batch only | a day late | rerun | once |
| **Lambda** | stream job | batch over raw | twice |
| **Kappa** | stream job | replay raw through the same job | once |

Lambda's cost is two implementations that must agree. Kappa needs a replayable log and a replay service. Either way, **keep the raw events**: a stream count is a fast estimate, and the number that gets billed should be reconciled from raw data.

---

## In an interview

Say **event time, watermark and what you do with late events**. Say how state survives a crash (checkpoint plus offset rewind). Say whether the sink is idempotent. Then name the hot-key fix.

The trap is describing "Flink" without saying what a window is closed by.

## Seen in
- Ad Click Aggregator — tumbling windows, the 15-second watermark, lambda versus kappa, salted hot ads
- News Feed — Kafka Streams state for the follower map, changelog recovery, streaming follower counts
- Chat System — the co-partitioned join of messages and membership
- YouTube Top-K — sliding-window heavy hitters
- Metrics Monitoring — downsampling and alert evaluation over streams
- Twitter Search — the indexing consumers batch and upsert

## Related
[Event-Driven Architecture](/learn/system-design/event-driven-architecture) · [Event Sourcing](/learn/system-design/event-sourcing) · [CQRS](/learn/system-design/cqrs) · [Message Queues](/learn/system-design/message-queues)
