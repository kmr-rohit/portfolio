---
title: "Bloom Filters and Probabilistic Structures"
summary: "Your crawler has seen ten billion URLs, and for every link on every page it asks \"have I seen this?\". Storing ten billion URLs is a terabyte. Storing 8-byte fingerprints is 80 GB and still a disk seek per miss. And you don't need the exact answer: you need to be confident about \"new\" and can tolerate a small error on \"seen\"."
stage: 4
stageName: "Distributed systems and coordination"
tier: "core"
seq: 36
tags: ["bloom-filter", "hyperloglog", "count-min", "probabilistic"]
---

Your crawler has seen ten billion URLs, and for every link on every page it asks "have I seen this?". Storing ten billion URLs is a terabyte. Storing 8-byte fingerprints is 80 GB and still a disk seek per miss. And you don't need the exact answer: you need to be **confident about "new"** and can tolerate a small error on "seen".

That trade, a little inaccuracy for a huge saving, is what probabilistic structures sell. There are three worth knowing.

---

## Bloom filter: is it in the set?

A **Bloom filter** is a bit array plus *k* hash functions. To **add** an item, set the *k* bits its hashes point to. To **check** an item, look at those *k* bits.

<figure class="sd-figure"><img src="/system-design/diagrams/bloom-filters-and-probabilistic-structures.svg" alt="Diagram: Bloom Filters and Probabilistic Structures" loading="lazy" decoding="async" /></figure>

- **Any bit is 0:** the item is **definitely not** in the set.
- **All bits are 1:** the item is **probably** in the set.

It has **no false negatives** and a tunable rate of false positives. The size follows from the error you'll accept:

```
bits per item = -ln(p) / (ln 2)²
p = 1%    → ~9.6 bits/item  → 10 billion items ≈ 12 GB
p = 0.1%  → ~14.4 bits/item → 10 billion items ≈ 18 GB
```

You can't delete from a plain Bloom filter (a bit may belong to several items), and it degrades as it fills past its design size. A **counting Bloom filter** allows deletes at more memory.

**What a false positive costs depends on the job.**

- **Crawler seen-set:** a false positive means a new URL is skipped forever. Accept it (1% loss is invisible for training data), or use the filter as a front: "definitely new" is trusted, "maybe seen" is confirmed against an exact store. → Web Crawler
- **Cache-miss shield:** ask the filter before hitting the database for keys that may not exist. A false positive costs one wasted lookup, which is harmless.
- **LSM trees:** Cassandra and RocksDB keep a Bloom filter per SSTable so a read skips files that can't contain the key. → [Cassandra and DynamoDB](/learn/system-design/cassandra-and-dynamodb)
- **Username taken?** Filter first; confirm on "maybe".

---

## HyperLogLog: how many distinct?

How many unique users watched this video? An exact answer needs a set of every id. HyperLogLog estimates the count of distinct items in about **12 KB**, with roughly 1–2% error, no matter how many items.

The idea: hash each item and look at the position of the first 1-bit. A hash that starts with many zeros is rare, so if you've seen one with 20 leading zeros you've probably seen about 2^20 distinct items. It averages many such observations across buckets to cut the noise.

Redis has it built in (`PFADD`, `PFCOUNT`), and you can **merge** HyperLogLogs from different shards or days by taking the max of each bucket. That makes it ideal for "unique visitors per day, then per week". → [Redis](/learn/system-design/redis)

---

## Count-Min Sketch: how often?

Which are the most-clicked ads, or the most-viewed videos, over a stream you can't store? A **Count-Min Sketch** is a small grid of counters: *d* rows, each with its own hash function. To **increment** an item, add 1 to one counter in each row. To **estimate** its count, take the **minimum** across its *d* counters.

It never underestimates (collisions only add), and it overestimates slightly for rare items. That's a good match for finding **heavy hitters**: the big counts stand out clearly above the collision noise. Pair it with a small heap of the current top K to answer "top K over the last window" in bounded memory. → YouTube Top-K

Related tools: **Top-K / Space-Saving** (track approximate top K directly), **t-digest** and **HdrHistogram** (approximate percentiles for latency monitoring), and **MinHash / SimHash** (near-duplicate detection, as in crawler content dedup).

---

## Choosing between them

| Question | Structure | Error |
|---|---|---|
| Is X in the set? | Bloom filter | false positives only |
| How many distinct? | HyperLogLog | ±1–2%, either direction |
| How often did X occur? | Count-Min Sketch | overestimates only |
| What are the top K? | Count-Min + heap, or Space-Saving | approximate |
| Are these near-duplicates? | SimHash / MinHash | tunable |

---

## In an interview

Say the trade out loud: "an exact set costs ~80 GB; a Bloom filter at 1% is ~12 GB, and a false positive costs us one skipped URL, which is acceptable here". Then say what you do about the error (accept it, confirm it, or rebuild with fresh hash seeds).

The trap is using a probabilistic structure where any error is unacceptable (billing counts) without a reconciliation step. → Ad Click Aggregator

## Seen in
- Web Crawler — the URL-seen Bloom filter, sizing, and the false-positive trade; SimHash for near-duplicates
- YouTube Top-K — Count-Min Sketch and heavy hitters over a stream
- Ad Click Aggregator — why exact counts and reconciliation still matter
- Metrics Monitoring — approximate percentiles
- [Cassandra and DynamoDB](/learn/system-design/cassandra-and-dynamodb) — Bloom filters in the LSM read path

## Related
[Caching Strategies](/learn/system-design/caching-strategies) · [Database Indexes](/learn/system-design/database-indexes) · [Redis](/learn/system-design/redis)
