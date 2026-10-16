---
title: "Scaling Reads"
summary: "Your product page loads fast at 100 users and crawls at 100,000. Nothing is broken. You have a read-heavy workload (often 10:1 to 1000:1) and the database is doing the same work over and over."
stage: 3
stageName: "Scaling data"
tier: "core"
seq: 25
tags: ["pattern", "reads", "caching", "replicas"]
---

Your product page loads fast at 100 users and crawls at 100,000. Nothing is broken. You have a read-heavy workload (often 10:1 to 1000:1) and the database is doing the same work over and over.

The good news is that reads are the forgiving half of a system. They can tolerate staleness, be cached, be copied and be precomputed. There's a **ladder** of fixes, and you climb it in order because each rung is cheaper and easier to undo than the next.

<figure class="sd-figure"><img src="/system-design/diagrams/scaling-reads.svg" alt="Diagram: Scaling Reads" loading="lazy" decoding="async" /></figure>

---

## 1. Fix the query and the index

Before adding machines, make sure the database isn't scanning. A missing index on `(listing_id, created_ts)` turns a range read into a full scan. Look for N+1 queries, `SELECT *`, unbounded `OFFSET` paging, and joins on unindexed columns. A ten-second scan becomes a millisecond seek. → [Database Indexes](/learn/system-design/database-indexes)

## 2. Read replicas

Copy the data to followers and send reads to them. Writes still go to the primary, so this scales read throughput nearly linearly. The cost is **replication lag**: a replica may be milliseconds to seconds behind.

- Fine for a restaurant's phone number or a seat map.
- Wrong for "did my payment go through" or an idempotency check, which read the leader. Use **read-your-writes** routing (send a user's reads to the leader for a few seconds after they write) when you must.

→ [Replication and Read Consistency](/learn/system-design/replication-and-read-consistency)

## 3. Cache

Put a fast store (Redis, in-process) in front of the database. The default is **look-aside**: check the cache, on a miss read the database and fill the cache.

- **Hit rate is everything.** A 95% hit rate cuts database reads twentyfold.
- **Invalidation is the hard part.** Immutable data (short-URL mappings, video segments) makes it vanish. Otherwise use short TTLs, or write-through, or event-driven invalidation.
- **Hot keys and stampedes:** one viral key can overload a node; a popular key expiring sends a thundering herd to the database. Jitter TTLs, single-flight the refill, keep a local cache in front.
- **Eviction:** LRU discovers hot keys without prediction, which is why it fits virality. → [Caching Strategies](/learn/system-design/caching-strategies) · [Redis](/learn/system-design/redis)

## 4. CDN and edge

For static or slow-changing content (images, video segments, layouts, public pages), a **CDN** serves from a server near the user and never reaches your origin. Give immutable objects **versioned URLs** (`/layouts/v7.json`) and cache them forever, with no invalidation problem. Give mutable ones (manifests, HTML) short TTLs. → [CDN](/learn/system-design/cdn) · YouTube

## 5. Precompute (denormalise)

If the same expensive answer is read a thousand times, compute it once at write time and store it in the shape reads want. A **feed table** per user, a **`total_stars` and `num_reviews`** column instead of an average over reviews, a **`clicks_by_minute`** rollup, top-K stored at every trie node.

The trade: writes get more expensive and more complicated, and the derived copy can lag. Keep it fresh with change data capture, not a dual write. → [CQRS](/learn/system-design/cqrs) · News Feed · [Normalization and Denormalization](/learn/system-design/normalization-and-denormalization)

## 6. Shard or split the data

Only when the dataset or the read rate exceeds what a replica set can hold. It's the hardest rung to reverse. Shard by the key your reads use so a query touches one shard. → [Sharding and Partitioning](/learn/system-design/sharding-and-partitioning)

---

## Bounding the work per read

Some workloads are heavy per request, so cap the cost.

- **Return small answers:** each search shard returns its top K, not its matches.
- **Paginate with cursors:** `WHERE ts &lt; :cursor LIMIT 20` beats `OFFSET 100000`.
- **Accept partial results:** a feed or search with one slow shard out of a hundred can return without it (a timeout plus `timed_out: true`). Hedge slow requests to a replica.
- **Split the payload by change rate:** immutable layout at the CDN, small availability overlay separately.

---

## Reads that hit the write path

Some reads must be strongly consistent (payment status, uniqueness, "is this seat free to claim"). Don't cache or replicate those. Keep them cheap by making them **point reads on the leader by primary key**, and keep everything else off that node. A stale *display* read is a hint; the *decision* read is the gate. → BookMyShow · Google Pay

---

## In an interview

Climb the ladder out loud, and stop where the numbers stop needing more. Say the read:write ratio, the staleness you tolerate per path, and how the cache stays correct. Split paths by consistency: display reads can be stale, decision reads cannot.

The trap is jumping straight to sharding or "add a cache" with no hit-rate reasoning and no invalidation story.

## Seen in
- URL Shortener — B-tree index, look-aside Redis with LRU, replicas for the 17:1 ratio
- Yelp — one node with many read replicas; a zip-snapped result cache
- BookMyShow — the read path: versioned layouts at the CDN, availability bitmap, search index
- News Feed — precomputed feeds versus pull, with hedged requests
- LinkedIn — the second-degree cache and a 4 TB graph held in memory
- YouTube — CDN head versus tail

## Related
[Scaling Writes](/learn/system-design/scaling-writes) · [Caching Strategies](/learn/system-design/caching-strategies) · [Replication and Read Consistency](/learn/system-design/replication-and-read-consistency) · [CDN](/learn/system-design/cdn)
