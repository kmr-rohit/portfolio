---
title: "Elasticsearch"
summary: "Your product table has ten million rows and someone types \"wireless headphones\" into the search box. WHERE name LIKE '%headphones%' scans everything and finds nothing for \"headphone\" or \"earphones\". You need an index that understands words."
stage: 3
stageName: "Scaling data"
tier: "core"
seq: 24
tags: ["elasticsearch", "search", "lucene"]
---

Your product table has ten million rows and someone types "wireless headphones" into the search box. `WHERE name LIKE '%headphones%'` scans everything and finds nothing for "headphone" or "earphones". You need an index that understands words.

Elasticsearch is a distributed search engine built on **Lucene**. It stores documents as JSON, builds an **inverted index** over them, and spreads that index across machines.

<figure class="sd-figure"><img src="/system-design/diagrams/elasticsearch.svg" alt="Diagram: Elasticsearch" loading="lazy" decoding="async" /></figure>

---

## The inverted index

An ordinary index maps row → value. An inverted index maps **word → the documents that contain it**, each as a sorted **posting list**.

```
wireless  → [4, 19, 77]
headphone → [4, 77, 81]
```

A two-word query intersects the sorted lists. Before indexing, an **analyzer** tokenises text, lowercases, strips punctuation, and applies **stemming** ("headphones" becomes "headphone") and stop-word removal. That's why fuzzier queries still hit, and it's why the same analyzer must be used at index and query time. → Twitter Search · [Database Indexes](/learn/system-design/database-indexes)

**Scoring** is usually BM25: how often the term appears in the document, how rare it is across the corpus, and the document's length. You can also boost fields, or add a `function_score` to mix in likes, recency or distance.

---

## Shards and replicas

An index is split into **shards**, each a complete Lucene index over a subset of the documents. This is **document partitioning**: a shard can answer any query for its own documents entirely locally.

A search is **scatter-gather**: a coordinating node sends the query to every shard, each shard returns its own **top K** (ids and scores, not matches), and the coordinator merges those short lists into a global top K. Each shard must return K, not K/N, because the best K could all live on one. The bill is fan-out to every shard, which you contain with small responses, a `timeout` (return partial results, marked `timed_out: true`) and **replicas**.

**Replicas** are read-only copies of each shard, updated asynchronously. They multiply read throughput and provide failover. A search on a replica can be a second stale, which is fine for search.

Shard count is fixed at index creation (you can split or reindex later), so size it for the data and the growth. Too many small shards waste memory; too few can't spread. Time-based indexes (one per day) with `search` only on the recent ones bound the fan-out.

---

## Near-real-time, and why updates hurt

Lucene never edits a segment. New documents go to an in-memory buffer, and every second (the default **refresh**) the buffer becomes a new small **immutable segment**, which is when the document becomes searchable. Background **merges** combine segments.

Consequences you should be able to state:

- **Searchable in about a second, not instantly.** Fine for tweets, wrong for read-your-writes.
- **An update is a delete-mark plus a re-insert.** Changing a like count on a hot document churns segments. Batch updates and only re-index meaningful changes (say, a 5% move).
- **Use bulk requests.** Thousands of documents per call, not one per request. Upsert by id so a redelivery is harmless. → [Idempotency](/learn/system-design/idempotency)

---

## What it's for, and what it isn't

Use it for **full-text search, filtering, faceting and aggregations** over data that lives somewhere else. Don't use it as your primary datastore. It has no multi-document transactions, and it's tuned for search rather than durability guarantees. The usual shape is:

**source of truth (Postgres, Cassandra) → change data capture → Kafka → indexer → Elasticsearch.**

Keeping it in sync through CDC avoids a dual write, which would silently diverge if the second write failed. If the index is ever wrong, you rebuild it from the source. → [Kafka](/learn/system-design/kafka) · [CQRS](/learn/system-design/cqrs)

---

## Where it goes wrong

- **Deep paging:** page 50 needs every shard's top 1,000. Plain paging is capped (10,000 by default); use `search_after` with the last score and id.
- **Mapping explosions:** dynamic fields on user-supplied JSON create thousands of fields. Define mappings.
- **Hot shards:** one tenant or one time window gets all the traffic. Route or split.
- **Term partitioning is not what it does.** Putting each word on a different machine makes writes and multi-word queries cross the network. → Twitter Search
- **Semantic search:** for meaning rather than words, store embeddings and use approximate nearest-neighbour search, often alongside keywords.

---

## In an interview

Explain the inverted index in one sentence, then that shards are by document, so each query fans out and returns top-K. Then say how data gets in (CDC through Kafka, bulk upserts) and that it's a derived index, not the source of truth.

The trap is proposing Elasticsearch for a lookup by id. A key-value store is the right answer there.

## Seen in
- Twitter Search — document-partitioned index, refresh and segments, query-time scoring, top-K merge
- Yelp — text and filters, and the Postgres GIN alternative for a small dataset
- LinkedIn — Galene: query rewriting, static rank, three index segments
- BookMyShow — event search fed by CDC from Postgres
- Search Autocomplete — why prefix completion isn't this problem

## Related
[Database Indexes](/learn/system-design/database-indexes) · [Secondary Indexes at Scale](/learn/system-design/secondary-indexes-at-scale) · [NoSQL Databases](/learn/system-design/nosql-databases)
