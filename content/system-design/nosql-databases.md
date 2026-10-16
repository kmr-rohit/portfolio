---
title: "NoSQL Databases"
summary: "\"NoSQL\" is a terrible name for a real idea. It isn't one kind of database and it isn't about avoiding SQL — several of these speak SQL dialects. It's four different families, each of which exists because some access pattern was awkward to serve from a relational table."
stage: 2
stageName: "The database core"
tier: "core"
seq: 12
tags: ["nosql", "databases", "data-modeling"]
---

"NoSQL" is a terrible name for a real idea. It isn't one kind of database and it isn't about avoiding SQL — several of these speak SQL dialects. It's four different families, each of which exists because some access pattern was awkward to serve from a relational table.

The useful way in is to look at the pattern first and let the database follow.

---

## Where relational starts to hurt

You're running a product catalogue on Postgres. A product has attributes, and different categories have wildly different ones — a laptop has RAM and screen size, a T-shirt has size and colour, a book has an ISBN and a page count.

The relational options are all a bit miserable. One wide table with mostly-NULL columns. Or a table per category, and now "search all products" is a union across forty tables. Or entity-attribute-value, which works and makes every query a self-join.

None of this is fatal. Postgres has `JSONB` and it's genuinely good. But it's the first crack: **the relational model wants a fixed shape, and some data doesn't have one.**

The second crack is scale. You can shard Postgres, and [Sharding and Partitioning](/learn/system-design/sharding-and-partitioning) covers how — but joins across shards, cross-shard transactions and global uniqueness all get hard. Some systems were built assuming distribution from the start instead of acquiring it later.

---

## The four families

<figure class="sd-figure"><img src="/system-design/diagrams/nosql-databases.svg" alt="Diagram: NoSQL Databases" loading="lazy" decoding="async" /></figure>

### Key–value

The simplest possible contract: `GET(key)` returns a blob, `PUT(key, blob)` stores one. The store doesn't know or care what's inside.

That constraint is the point. With no queries across values, there's nothing to index and nothing to plan, so the lookup is a hash and the latency is microseconds. **Redis, DynamoDB, Memcached.**

You reach for it when you always have the key: sessions, caches, feature flags, rate-limit counters, the shard directory in [Caching Strategies](/learn/system-design/caching-strategies). You avoid it the moment you need to ask "which records have property X?", because the answer is a full scan.

### Document

A document store holds nested JSON-ish objects, addressed by id, and can index and query fields *inside* them. **MongoDB, DynamoDB's document mode, Couchbase, Firestore.**

The win is that an entity which would span five normalized tables becomes one document you fetch in one read. A blog post with its tags, author summary and comment count is a single round trip instead of a join.

Which is also the tradeoff. You've embedded the author's name in the post, so when they change it you're updating every post. That's denormalization, and everything in [Normalization and Denormalization](/learn/system-design/normalization-and-denormalization) about write amplification applies — you've chosen read speed and taken on consistency maintenance.

### Wide-column

The name is unhelpful. The mental model is a distributed, sorted, persistent map: each row has a partition key, and within a partition, rows are sorted by a clustering key. **Cassandra, HBase, ScyllaDB, Bigtable.**

What that buys you is enormous write throughput and efficient range scans within a partition — "give me all messages in this chat from the last hour" is one sequential read. The storage engine underneath is usually an LSM-tree, which is why writes are so cheap (see [Databases and DBMS](/learn/system-design/databases-and-dbms)).

The constraint is severe and worth stating plainly: **you query by partition key, or you scan.** There's no ad-hoc querying. Cassandra's own guidance is to design one table per query pattern, duplicating the data as many times as you have patterns.

### Graph

When the relationships *are* the data. "Friends of friends who like jazz" in SQL is a self-join per hop, and the planner's estimates get worse with every level. A graph database stores adjacency directly, so traversal is pointer-chasing. **Neo4j, Neptune, JanusGraph.**

Genuinely the right answer for social graphs, fraud rings and recommendation traversals. Genuinely overkill for anything with two levels of relationship.

---

## The modelling inversion

This is the part that actually changes how you work, more than any feature comparison.

**Relational:** model the data properly, normalize it, and query it however you like later. The schema is designed around the *entities*. New query? Write new SQL. Maybe add an index.

**NoSQL:** know your queries first, then shape the data to serve them. The schema is designed around the *access patterns*.

DynamoDB single-table design takes this to its logical end: multiple entity types share one table, with composite partition and sort keys arranged so that each access pattern is a single query. It looks deranged if you're expecting third normal form, and it's the correct way to use that database.

The cost is inflexibility. A new access pattern you didn't plan for can mean a migration or a new secondary index, and getting it badly wrong means a rewrite. **Relational databases are forgiving about queries you didn't anticipate. NoSQL databases are not.**

---

## "Schemaless" is schema-on-read

You'll hear that these databases have no schema. They don't have a schema *the database enforces*.

The structure still exists — your code reads `order.customer.email` and will break if that path isn't there. What's changed is who enforces it and when. Schema-on-write catches the bad record at insert time with a clear error. Schema-on-read catches it in production, in whichever service happened to read it.

That's a reasonable trade when the shape genuinely varies or evolves fast. It's a bad trade made by accident when someone just didn't want to write a migration. And you still end up writing validation — you've moved it, not removed it.

---

## What they gave up, and mostly got back

The early pitch was that dropping ACID was the price of scale. That's largely stale now.

MongoDB has multi-document ACID transactions. DynamoDB has transactions and optional strongly-consistent reads. Cassandra has tunable consistency per query and lightweight transactions for compare-and-set. Meanwhile Postgres has `JSONB` with GIN indexes, and scales horizontally with extensions.

So the honest position is the one in [ACID and BASE](/learn/system-design/acid-and-base): this is a dial, not two camps, and most systems now let you pick a point on it per operation.

What still genuinely differs is the **default shape** — what the database makes easy versus what it makes possible. Cassandra makes a million writes a second easy and an ad-hoc join impossible. Postgres is the reverse. That difference is real and it's what you should be choosing on.

---

## Where this shows up

- **Session and cache tiers** in almost every large system — key–value, universally.
- **Chat and messaging history**, which is the canonical wide-column workload: enormous write volume, always read by conversation and time range.
- **Product catalogues and CMS content**, where the shape varies per item type.
- **Uber's Docstore**, a document store built over MySQL, offering strict serializability per partition — see 12 - How Uber Actually Does It.

---

## In an interview

Don't announce a database. Describe the access patterns, then name one that fits and say what you'd give up. "Reads are always by conversation id and time range, writes are huge, I never need a join — that's a wide-column shape, so Cassandra, and I'm accepting that ad-hoc queries are off the table."

Be ready for "why not Postgres?" on every NoSQL choice, because for most interview-scale problems Postgres genuinely would work. The strong answer names the specific property you need that it doesn't give you cheaply.

And avoid the "NoSQL scales, SQL doesn't" line. It's the fastest way to sound like you learned this from a 2012 blog post.

---

## Seen in
- 12 - How Uber Actually Does It — Schemaless and Docstore, a document store built on MySQL, plus Cassandra in the push platform

## Related
[SQL Databases](/learn/system-design/sql-databases) · [SQL vs NoSQL](/learn/system-design/sql-vs-nosql) · [Databases and DBMS](/learn/system-design/databases-and-dbms) · [ACID and BASE](/learn/system-design/acid-and-base) · [Normalization and Denormalization](/learn/system-design/normalization-and-denormalization) · [Sharding and Partitioning](/learn/system-design/sharding-and-partitioning) · [CAP Theorem](/learn/system-design/cap-theorem)

## Sources
- [Amazon DynamoDB: Best practices for designing and using partition keys](https://docs.aws.amazon.com/amazondynamodb/latest/developerguide/bp-partition-key-design.html)
- [DynamoDB: Single-table design guidance](https://docs.aws.amazon.com/amazondynamodb/latest/developerguide/bp-general-nosql-design.html)
- [Apache Cassandra: Data modelling](https://cassandra.apache.org/doc/latest/cassandra/developing/data-modeling/intro.html)
- [MongoDB: Data modelling introduction](https://www.mongodb.com/docs/manual/data-modeling/)
- [PostgreSQL: JSON types](https://www.postgresql.org/docs/current/datatype-json.html)
