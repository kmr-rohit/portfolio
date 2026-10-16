---
title: "Geospatial Indexing"
summary: "You have a table of places — restaurants, drivers, scooters, delivery riders — and someone asks \"what's near me?\""
stage: 10
stageName: "Security and specialised"
tier: "breadth"
seq: 69
tags: ["geospatial", "geohash", "quadtree", "h3", "s2", "postgis"]
---

You have a table of places — restaurants, drivers, scooters, delivery riders — and someone asks "what's near me?"

It sounds like an indexing problem, and it is. It's just not one a normal index can solve.

---

## Why the obvious approach fails

Store latitude and longitude as columns, put a composite index on them, and write the query:

```sql
SELECT * FROM places
 WHERE lat BETWEEN 37.75 AND 37.79
   AND lng BETWEEN -122.45 AND -122.39;
```

That returns the right rows. It's also barely using the index.

A B-tree orders **one** dimension. Given an index on `(lat, lng)`, the engine range-scans on `lat` — genuine index work. But once it has that band of latitudes, it has no way to use the index for `lng`. It reads every row in the band and filters them one by one.

And a band of latitude 0.04° tall is a strip that wraps the entire planet. You pruned one dimension and brute-forced the other.

---

## The idea every solution shares

Proximity is two-dimensional. B-trees are one-dimensional. So:

**Every geospatial index is a scheme for projecting 2-D proximity onto a 1-D sortable key, in a way that keeps nearby things nearby.**

Once you've done that, an ordinary B-tree or sorted set answers proximity queries perfectly well. Geohash, S2, H3 and quadtrees are four different answers to the same question: how do you flatten the plane without destroying locality?

---

## Geohash — interleave the bits

Convert latitude and longitude to binary, interleave their bits, base32-encode the result.

```
37.7564, -122.4016  →  9q8yy9mf
```

Each extra character narrows the box: `9q8yy` is about 4.9 km across, `9q8yy9` about 1.2 km, `9q8yy9m` about 150 m. So points sharing a long prefix are physically close.

Which means the proximity query becomes a **range scan on a plain string index**:

```sql
WHERE geohash BETWEEN '9q8yy9' AND '9q8yy9~';
```

This is literally what Redis does. `GEOADD` doesn't store a special geo type — it encodes the coordinates into a **52-bit geohash integer** and uses it as the score in a sorted set. `GEOSEARCH` is a handful of range scans over that set. When someone asks why Redis is fast at geo queries, the answer is that it isn't doing geo queries.

---

## Quadtree — subdivide where it's crowded

Split a region into four quadrants. Recurse on any quadrant holding more than *k* points.

The nice property is that it's **density-adaptive**: a quadtree over a city and the open ocean automatically puts its depth where the data is. Lookup is an `O(log n)` descent to a leaf, then a walk across neighbouring leaves.

The catch is that the tree has to be *maintained*. That's fine for points that don't move. It's painful for points that move constantly, because every boundary crossing is a potential split or merge, and under a heavy write rate that becomes a contention nightmare.

---

## S2 — a better curve

Google's S2 projects the sphere onto a cube and orders cells along a **Hilbert curve** rather than geohash's Z-order (Morton) curve. Hilbert ordering preserves locality better: points close on the curve are more reliably close in space.

64-bit cell ids, 30 levels. Level 12 is roughly 3–6 km².

---

## H3 — hexagons

Uber's, and open-sourced. Structurally it's a quadtree with about seven children per cell instead of four, using hexagons, covering the globe across 16 resolutions.

The reason for hexagons is worth understanding. **On a square grid, "neighbour" means two different distances.** The cell above you shares an edge. The cell diagonally up-left shares only a corner, and its centre is 1.41× further away. So "everything within two cells" is a lumpy diamond, and any distance reasoning has built-in error.

**On a hexagonal grid there is exactly one neighbour distance.** All six are equidistant. That makes `k_ring(cell, k)` a genuine radius search.

Hexagons also have near-uniform area within a resolution, which matters when you're comparing densities across cells. Cell ids are 64-bit with the resolution encoded, so finding a parent is a bitwise operation.

Two caveats: you can't tile a sphere with hexagons alone, so twelve of H3's base cells are **pentagons** — don't hardcode six neighbours. And seven hexagons don't compose exactly into one larger hexagon, so the hierarchy is **approximate**; a child can spill outside its parent. Fine for bucketing, not for exact containment.

---

## R-tree and GiST — actual geometry

What PostGIS uses. A hierarchy of bounding boxes, which handles polygons and exact predicates (`ST_DWithin`, `ST_Contains`), not just points. This is the one that gives you a real circle rather than a cell-shaped approximation.

---

## Choosing between them

| | Geohash | Quadtree | S2 | H3 | R-tree/GiST |
|---|---|---|---|---|---|
| Cell shape | rectangle | square | quadrilateral | **hexagon** | bounding box |
| Density-adaptive | ✗ | ✅ | ✗ | ✗ | ✅ |
| Neighbour distances | 2 | 2 | 2 | **1** | n/a |
| Good as a **shard key** | ✅ (ranges) | ✗ (mutable) | ✅ | ✅ (splits cleanly) | ✗ |
| Exact geometry | ✗ | ✗ | ✗ | ✗ | ✅ |

---

## Two traps that always come up

**The edge problem.** Two points ten metres apart, on opposite sides of a cell boundary, share no prefix at all — their keys differ from the very first character. So a correct query is never one cell. It's the cell **plus its neighbours** (eight for squares, six for hexagons), then a filter on true distance.

Get this wrong and your query still returns results. They're just quietly missing the closest thing, which is the worst kind of bug to ship.

**Euclidean is not reachable.** The index gives you straight-line nearness. A point 500 metres away across an unbridged river might be fifteen minutes out.

The fix is to treat the index as **candidate generation** and a routing engine as **ranking** — cheap recall, expensive precision. If you've seen two-stage retrieval in search or recommendations, it's the same pattern.

---

## Layering, which is how real systems do it

The strongest designs use two levels:

A **cell id** (H3, S2, geohash) decides *which machine* holds the data. An **R-tree or GiST index** on that machine decides *which rows* actually satisfy the predicate.

Cheap approximate partitioning over exact local computation. Neither works alone — cells alone give you cell-shaped results, and exact geometry alone can't tell you which of a hundred nodes to ask.

---

## In an interview

Spend fifteen seconds on why a B-tree on `(lat, lng)` fails before naming any technique — it's what makes the rest sound derived rather than memorised.

Then give the unifying idea (every geo index flattens 2-D proximity onto a 1-D sortable key), pick *one* technique, and go deep on it. Listing geohash, quadtree, S2 and H3 in a row shows breadth and no depth.

Always mention the edge problem — query the cell *and* its neighbours — without being asked. Forgetting it returns plausible, wrong results, and interviewers know it's the classic miss.

## Seen in
- 04 - Driver Location Index — geohash, quadtree and H3 compared, plus the TTL trick
- 09 - H3 and Geo Sharding — an H3 cell used as a shard key rather than an index key
- 11 - Location Index High Level Design — H3 for routing, PostGIS for the exact radius

## Related
[Sharding and Partitioning](/learn/system-design/sharding-and-partitioning) · [TTL as a Coordination Primitive](/learn/system-design/ttl-as-a-coordination-primitive)
