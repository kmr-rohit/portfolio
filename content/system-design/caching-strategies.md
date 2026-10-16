---
title: "Caching Strategies"
summary: "Two questions decide everything about a cache."
stage: 3
stageName: "Scaling data"
tier: "core"
seq: 17
tags: ["caching", "ttl", "staleness", "performance"]
---

Two questions decide everything about a cache.

**What breaks if this read is stale?** — decides whether you may cache at all.
**Who refreshes it, and when?** — decides which pattern you use.

Most cache incidents come from answering the first one for the system as a whole rather than for each caller.

---

## The patterns

**Cache-aside**, also called lazy loading. On a read, check the cache; on a miss, load from the database and populate. On a write, update the database and invalidate the cache entry. This is the default, and it's simple to reason about. The cost is a miss on every cold or evicted key.

**Read-through** is the same thing with the load logic hidden inside the cache client.

**Write-through** writes to the cache and the database synchronously. The cache is always warm and never stale, at the cost of slower writes.

**Write-behind** writes to the cache and flushes to the database asynchronously. Fastest writes, and you can lose data if the cache dies before flushing.

**Refresh-ahead** reloads on a timer in the background, so no request ever pays for a miss. Staleness is bounded by the refresh interval.

---

## Where caches live

Before choosing a pattern, notice that a request passes through several caches, and the cheapest hit is always the earliest one.

**In the browser.** HTTP caching via `Cache-Control` and `ETag`. Zero network. Free, and you control it only through headers you set once and can't easily revoke.

**At the edge / CDN.** Shared across all users near that location. Absorbs enormous read volume before it costs you anything. → [CDN](/learn/system-design/cdn)

**In a reverse proxy.** nginx or Varnish in front of your app tier, caching full responses. → [Proxies](/learn/system-design/proxies)

**In the application process.** A local hash map or Caffeine cache. Nanoseconds, no network — and it's *per instance*, so twenty servers means twenty copies that can disagree, and a cold cache after every deploy.

**In a distributed cache.** Redis or Memcached, shared by all instances. One coherent copy, one network round trip, one more thing that can be down.

**In the database.** The buffer pool is a cache, and it's often the one doing most of the work. A query that "hits disk" frequently doesn't. → [Databases and DBMS](/learn/system-design/databases-and-dbms)

The instinct to reach for Redis first is worth resisting. A correctly-set `Cache-Control` header can remove more load than any server-side cache, because the request never leaves the user's machine.

---

## Eviction: what goes when it's full

A cache is bounded, so something has to leave.

**LRU** — evict least recently used. The sensible default, and it matches how access actually works: recently touched things get touched again. Its weakness is a big scan — a batch job reading a million rows once will flush everything useful out.

**LFU** — evict least frequently used. Better for stable popularity distributions, where a genuinely hot key shouldn't be evicted just because a scan touched newer ones. It needs frequency counters, and it clings to things that *used* to be popular unless you decay the counts. Redis's `allkeys-lfu` uses a probabilistic counter with decay for exactly this reason.

**FIFO** — evict oldest inserted, ignoring use. Cheap, and usually worse than LRU.

**TTL** — evict on age rather than pressure. Orthogonal to the others and usually combined with one.

**Random** — surprisingly defensible. No bookkeeping, no locks on the hot path, and performance within a few percent of LRU on many workloads.

Most production systems run LRU or a TTL-plus-LRU combination and don't think about it again — which is fine. Reach for LFU when you have a genuinely skewed key distribution and scans are evicting your hot set.

---

## The number that tells you if it's working

**Hit ratio** — hits divided by total lookups. It's the metric, and the interesting part is what a bad one means, because the fix differs completely:

A **low ratio with high volume** usually means your keys are too specific — you're caching per-user what could be cached per-segment.

A **ratio that collapses periodically** means eviction pressure or synchronised expiry. More memory, or jittered TTLs.

A **high ratio that doesn't help latency** means you're caching the cheap things. The expensive queries are still going to the database.

And the ratio you need depends on the gap you're closing. If a cache hit is 1ms and a miss is 100ms, a 90% hit rate gives an average of ~11ms — but the p99 is still 100ms, because that's what the misses cost. **Caching improves the average far more than the tail.**

---

## Distributed cache specifics

Once the cache is a cluster rather than a process, two problems arrive.

**Which node holds a key?** Plain `hash(key) % N` means adding or losing a node remaps almost everything — a mass miss that stampedes your database at the worst moment. This is exactly the problem [Consistent Hashing](/learn/system-design/consistent-hashing) exists to solve, and a distributed cache is its most common application.

**Hot keys.** One key getting a disproportionate share of traffic overwhelms whichever node owns it, and consistent hashing doesn't help because it distributes *keys* evenly, not *traffic*. The fixes are replicating the hot key to several nodes, or salting it into `key#0..key#9` and reading from a random one. → [Hotspots and Dynamic Resharding](/learn/system-design/hotspots-and-dynamic-resharding)

---

## The metadata cache, which deserves its own section

There's a specific shape that comes up constantly and is worth recognising: **a small, slow-changing set that every single request needs.**

Shard directories. Feature flags. Routing tables. Tenant configuration. Rate-limit policy.

The design is:

```
at startup:         set = load_from_db()
every 60s:          set = load_from_db()     # background
on every request:   probe the in-memory set  # no I/O at all
```

Three things make this work.

**It's small enough to hold entirely.** A hundred thousand entries at sixteen bytes each is under ten megabytes. No eviction policy, no reasoning about partial caches, no cache-miss path.

**It's refresh-ahead, not cache-aside.** No request ever waits for a load.

**There's zero I/O on the hot path**, which is the whole point when the hot path runs a million times a second.

What it costs you is a bounded staleness window equal to the refresh interval. Which brings us to the interesting question.

---

## Staleness is a per-caller decision

Here's the mistake worth avoiding: deciding that a cache is "safe" or "unsafe" for the system.

The same cached data can be completely fine for one caller and unacceptable for another.

|  | High-volume writer | Low-volume reader |
|---|---|---|
| Rate | ~10⁶ / s | ~10² / s |
| Using a stale config means | the write lands in the wrong place — **and then expires on its own** | a wrong or empty answer — **a lost transaction** |
| So it should | use the cache | bypass it and read the source of truth |

Bypassing the cache on the rare path is affordable *precisely because it's rare*. Check the read-to-write ratio before assuming everything has to go through the cache. → [Replication and Read Consistency](/learn/system-design/replication-and-read-consistency)

And notice the first row: if the data written under a stale cache **expires by itself**, the staleness window costs you almost nothing. Caching plus expiring data is a much stronger combination than either alone. → [TTL as a Coordination Primitive](/learn/system-design/ttl-as-a-coordination-primitive)

---

## Invalidation

**TTL only.** Simplest thing that works; stale for up to the TTL.

**Explicit invalidation.** Fresh, but you need a delivery path to every node, and a missed message leaves that node permanently stale.

**Versioning.** The source returns a version or generation number alongside the data, and downstream systems echo it back. Now a stale decision becomes *detectable* rather than silent — the caller notices it used an old mapping and retries.

**Pub/sub invalidation.** Near-instant fan-out, at the cost of another dependency.

That third one is underrated. **Detectable staleness beats merely short staleness.** Shortening a TTL is hoping; a version number is knowing.

---

## Failure modes to name

**Thundering herd.** A hot key expires and a thousand requests all miss simultaneously, all hitting the database. Fix with request coalescing — one loader, everyone else waits on it.

**Stampede on expiry.** Many keys expire at the same instant because they were populated together. Fix by jittering the TTLs.

**Cache as a hard dependency.** If your system can't serve when the cache is down, it isn't a cache — it's a database without durability. Always have a degraded path, even a slow one.

---

## In an interview

Motivate the cache with the specific pressure — a read ratio, a hot key you can't predict — rather than "for performance". A cache without a reason reads as a reflex.

Then name what it costs: a staleness window and a second thing that can be down. And if two callers read the same data, say which of them can tolerate stale and which can't. That per-caller split is the point interviewers probe.

The trap: saying "add a cache" and moving on. The follow-up is always "what happens when it's stale?", so have the answer before they ask.

## Seen in
- 10 - Dynamic Resharding and the Shard Index — a sub-10MB shard directory cached on every server, background-refreshed, and deliberately bypassed on the path that can't tolerate staleness
- 02 - Ride Request Flow — caching third-party geocoding results

## Related
[Replication and Read Consistency](/learn/system-design/replication-and-read-consistency) · [TTL as a Coordination Primitive](/learn/system-design/ttl-as-a-coordination-primitive) · [Hotspots and Dynamic Resharding](/learn/system-design/hotspots-and-dynamic-resharding) · [CDN](/learn/system-design/cdn) · [Consistent Hashing](/learn/system-design/consistent-hashing) · [Proxies](/learn/system-design/proxies) · [Databases and DBMS](/learn/system-design/databases-and-dbms)

## Sources
- [Redis: Key eviction policies](https://redis.io/docs/latest/develop/reference/eviction/)
- [MDN: HTTP caching](https://developer.mozilla.org/en-US/docs/Web/HTTP/Caching)
- [AWS: Caching best practices](https://aws.amazon.com/caching/best-practices/)
- [Caffeine: Efficiency and eviction policies](https://github.com/ben-manes/caffeine/wiki/Efficiency)
