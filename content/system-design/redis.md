---
title: "Redis"
summary: "You have a leaderboard page and it's slow. The query sorts ten million scores on every load. So you keep the scores somewhere that's already sorted, in memory, and update it as scores change. That somewhere is very often Redis."
stage: 3
stageName: "Scaling data"
tier: "core"
seq: 18
tags: ["redis", "cache", "in-memory"]
---

You have a leaderboard page and it's slow. The query sorts ten million scores on every load. So you keep the scores somewhere that's already sorted, in memory, and update it as scores change. That somewhere is very often Redis.

Redis is an in-memory data structure server. It's not "a cache with extras": the point is that it holds real data structures on the server and lets you run small operations on them atomically, in microseconds.

<figure class="sd-figure"><img src="/system-design/diagrams/redis.svg" alt="Diagram: Redis" loading="lazy" decoding="async" /></figure>

---

## Why one thread is a feature

Redis executes commands **one at a time** on a single thread. That sounds like a limit and it's the reason Redis is so useful for correctness.

`INCR page_views` reads, adds and writes in one indivisible step. Two servers calling it at the same instant get two different answers, never the same one twice. There's no lock to take because nothing can interleave. That's why rate limiters, counters and "claim this once" checks are so natural here. → [Rate Limiting](/learn/system-design/rate-limiting)

The catch is that a slow command blocks everyone. `KEYS *` on a big keyspace, a huge `SMEMBERS`, or a Lua script with a loop can freeze the whole instance for its duration. Rule of thumb: every command should be O(1) or O(log n), and scripts should be tiny.

---

## The data structures are the product

- **String:** a value, a counter (`INCR`), or a lock (`SET key val NX EX 30`: set only if absent, with a TTL, atomically).
- **Hash:** a small object, like a session or a token bucket's `&#123;tokens, ts&#125;`.
- **List:** a queue or a recent-items list (`LPUSH` + `LTRIM`).
- **Set:** membership, dedup, "who has seen this".
- **Sorted set (zset):** members with scores, kept ordered. `ZADD`, `ZRANK` and `ZRANGE` are all logarithmic. This is the leaderboard, the waiting queue in BookMyShow, the "held seats by expiry" set, a rate-limit sliding window.
- **Bitmap and HyperLogLog:** one bit per seat (50,000 seats in 6 KB), and approximate unique counts in about 12 KB. → [Bloom Filters and Probabilistic Structures](/learn/system-design/bloom-filters-and-probabilistic-structures)
- **Geo:** a sorted set whose score is a 52-bit geohash; `GEOSEARCH` is range scans over it. → [Geospatial Indexing](/learn/system-design/geospatial-indexing)
- **Stream:** an append-only log with consumer groups, a small Kafka. → [Message Queues](/learn/system-design/message-queues)

Everything also takes a **TTL**, which makes Redis the natural home for anything that should expire: sessions, holds, presence, location pins. → [TTL as a Coordination Primitive](/learn/system-design/ttl-as-a-coordination-primitive)

---

## Making the check atomic: Lua

`MULTI/EXEC` queues commands and runs them back to back, but none of them can look at a value and branch. A token bucket has to read the tokens, compute a refill, and then decide, so it can't be a `MULTI`.

A **Lua script** runs atomically: read, compute, write, all before any other command. One `EVALSHA` round trip, correct under any contention. That's the whole rate limiter. → Rate Limiter

---

## Durability, which is weaker than you'd like

Redis is memory-first. Two persistence options exist and neither is a database's guarantee.

**RDB snapshots** dump the dataset every few minutes. You can lose everything since the last one. **AOF** appends every write to a log, fsynced every second (or every write, at a cost). You can lose about a second.

Replication is **asynchronous**, so a primary that dies can lose writes it acknowledged but hadn't shipped. That's fine for a cache and a bad idea for a system of record. The design rule that keeps you safe: **Redis is where you keep things that are cheap to lose or rebuild.** If a lost key can double-book a seat, the database must still be the gate. → [Distributed Locks and Fencing Tokens](/learn/system-design/distributed-locks-and-fencing-tokens)

---

## Scaling it

**Read replicas** scale reads (with async lag). **Sentinel** or a managed service promotes a replica when a primary dies. **Redis Cluster** splits keys across nodes by hashing each key into one of **16,384 slots**; a cluster-aware client knows the slot map and talks straight to the right node. → [Consistent Hashing](/learn/system-design/consistent-hashing) · [Sharding and Partitioning](/learn/system-design/sharding-and-partitioning)

Multi-key operations only work when the keys share a slot. A **hash tag** (`&#123;user:42&#125;:cart`, `&#123;user:42&#125;:prefs`) forces keys to one slot, which is how you keep a user's keys together. It can't help a global key.

**The hot key** is the real limit. Sharding spreads *different* keys; one key at 40,000 ops a second still hits one node. Fixes are a local in-process cache in front, splitting the key (`counter:1..N`, summed on read), or a deny cache for a limiter. → [Hotspots and Dynamic Resharding](/learn/system-design/hotspots-and-dynamic-resharding)

---

## Where it goes wrong

- **Eviction:** at `maxmemory` Redis evicts by policy (`allkeys-lru`, `volatile-ttl`, and so on). Pick it on purpose; `noeviction` turns a full cache into write errors.
- **Big keys:** a 100 MB hash blocks the thread when deleted or read. Break them up.
- **Thundering herd:** a hot key expires and a thousand requests hit the database together. Jitter TTLs or use a single-flight refill. → [Caching Strategies](/learn/system-design/caching-strategies)
- **Pub/sub is fire and forget:** a message to a disconnected subscriber is gone. Use Streams or a real broker when delivery matters. → [Publish-Subscribe](/learn/system-design/publish-subscribe)

---

## In an interview

Name the structure, not just "Redis". "A sorted set scored by expiry" or "a Lua token bucket" shows you know why it fits. Say what happens when it fails (cold cache, lost hold, degraded limiter) and where the source of truth lives.

The trap is treating Redis as durable or as a lock service you can trust for correctness. Both are optimisations; the gate is elsewhere.

## Seen in
- Rate Limiter — a Lua token bucket, sharded by key, with a deny cache for the hot key
- BookMyShow — the waiting queue as a sorted set, seat holds with `SET NX EX`, availability bitmaps
- URL Shortener — look-aside cache with LRU for viral links
- PasteBin — key → S3 pointer cache
- Yelp — location cache with a 10-minute TTL, and the pub/sub layer for Nearby Friends
- Chat System — the connection registry and presence TTLs

## Related
[Caching Strategies](/learn/system-design/caching-strategies) · [Message Queues](/learn/system-design/message-queues) · [Idempotency](/learn/system-design/idempotency)
