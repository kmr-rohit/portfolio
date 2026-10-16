---
title: "Cassandra and DynamoDB"
summary: "You're storing chat messages. The only queries are \"the latest 50 in chat 42\" and \"the 50 before this one\". You never join. You need a million writes a second, and you'd rather serve a slightly stale read than reject a write during a failover."
stage: 2
stageName: "The database core"
tier: "core"
seq: 13
tags: ["nosql", "cassandra", "dynamodb", "wide-column"]
---

You're storing chat messages. The only queries are "the latest 50 in chat 42" and "the 50 before this one". You never join. You need a million writes a second, and you'd rather serve a slightly stale read than reject a write during a failover.

That workload is almost exactly what wide-column stores are built for. Cassandra (open source) and DynamoDB (managed) share the same central idea: **you design the table around the query**, and the database spreads partitions across many machines with no leader.

---

## Partition key and clustering key

Every table has a **primary key** in two parts.

```sql
CREATE TABLE messages (
  chat_id    bigint,
  created_ts timestamp,
  message_id uuid,
  sender_id  bigint,
  content    text,
  PRIMARY KEY ((chat_id), created_ts, message_id)
) WITH CLUSTERING ORDER BY (created_ts DESC, message_id ASC);
```

`(chat_id)` is the **partition key**. It's hashed to pick which nodes hold the row, so all of chat 42 lives on one replica set. `created_ts, message_id` are **clustering keys**: rows within a partition are stored physically sorted by them.

<figure class="sd-figure"><img src="/system-design/diagrams/cassandra-and-dynamodb.svg" alt="Diagram: Cassandra and DynamoDB" loading="lazy" decoding="async" /></figure>

"Latest 50" reads the front of one sorted run on one node. "The 50 before X" is a seek and a sequential read. No index, no sort, no scatter. The data is already in the order the screen wants. DynamoDB calls the same pair the **partition key** and **sort key**.

**Query first.** In SQL you model the data, then write queries. Here you list your queries, then build a table for each. If you need messages by user *and* by chat, you keep two tables and write to both (or derive one from the other). Denormalisation is expected. → [Normalization and Denormalization](/learn/system-design/normalization-and-denormalization) · [Secondary Indexes at Scale](/learn/system-design/secondary-indexes-at-scale)

---

## No leader, tunable consistency

Data is placed on a **hash ring** (consistent hashing) and replicated to N nodes (usually 3). Any replica can accept a write, so there's no failover gap. → [Consistent Hashing](/learn/system-design/consistent-hashing)

You choose consistency per operation. With `R + W > N` (say quorum reads and writes with N=3, so W=2 and R=2), a read overlaps the latest write, giving read-your-writes without anyone being in charge. Lower it (`ONE`) for speed and staleness. This is the **AP** end of [CAP Theorem](/learn/system-design/cap-theorem): available under partition, eventually consistent otherwise. → [PACELC Theorem](/learn/system-design/pacelc-theorem)

The cost: there's no single place to decide "version 5 is taken". A unique-insert or "book this seat" check needs a conditional write (Cassandra lightweight transactions, DynamoDB conditional writes) or a different store. → [Transactions and Isolation](/learn/system-design/transactions-and-isolation)

---

## Why writes are cheap: the LSM tree

Cassandra writes to an in-memory **memtable** and an append-only commit log, then flushes the memtable to an immutable **SSTable** on disk. Writes are sequential appends. Reads may check the memtable and several SSTables (Bloom filters help skip files), and background **compaction** merges them.

Deletes write a **tombstone** marker, which sticks around until compaction and a grace period pass. Deleting lots of rows, or queuing patterns (write, read, delete), leave piles of tombstones that slow reads. This is a classic Cassandra trap.

---

## Hot and huge partitions

The partition is the unit of placement, so a bad key ruins the design.

- **Hot partition:** one key takes most traffic (a celebrity, a viral ad). Every request hits one replica set. Fix with a suffix or salt (`adId#0..15`) and merge on read. → [Hotspots and Dynamic Resharding](/learn/system-design/hotspots-and-dynamic-resharding)
- **Unbounded partition:** a busy chat grows forever (Discord saw partitions past 100 MB cause GC pauses). Add a **time bucket** to the partition key: `PRIMARY KEY ((chat_id, bucket), created_ts, …)` with `bucket = created_ts / 10 days`. Each chat is a series of bounded partitions.
- **Scatter queries:** a query without the partition key touches every node. Don't build access patterns that need it.

---

## DynamoDB specifics

- **Capacity per partition:** roughly 1,000 write units and 3,000 read units per second per partition (a 1 MB/s write ceiling). A hot key throttles no matter how much you provision. On-demand mode and adaptive capacity smooth the average, not one hot key.
- **Secondary indexes:** a **GSI** has its own partition key and is eventually consistent; an **LSI** shares the table's partition key and is local. → [Secondary Indexes at Scale](/learn/system-design/secondary-indexes-at-scale)
- **Conditional writes** (`attribute_not_exists`) give you the atomic check-and-set you need for dedup and claims. **Transactions** exist but cost more.
- **TTL** deletes expired items for free. **Streams** emit changes for CDC.
- **Single-table design** puts several entity types in one table under overloaded keys to serve a query in one read. It's powerful and hard to change later.

---

## When to choose it

Pick a wide-column store for **massive write volume, simple key-based access, known queries and a preference for availability**: messages, feeds, time series, sessions, activity logs. Don't pick it for ad-hoc queries, joins or multi-row transactions. A relational database with good indexes serves far more workloads than people expect. → [SQL vs NoSQL](/learn/system-design/sql-vs-nosql)

---

## In an interview

Name the partition key and the clustering key and say which query each serves. Then say what stops a partition getting hot or unbounded. Say what consistency you read and write at, and what you'd lose with a leader instead.

The trap is "use NoSQL for scale" with no key, no queries and no consistency story.

## Seen in
- Chat System — messages by `chatId` sorted by time, the time-bucket fix, and the per-user inbox
- News Feed — `Posts`, `Feed` and follower tables; why no leader mattered
- Google Drive — `IncomingFileChunks` and a per-user change journal
- YouTube — video metadata as a point lookup by id
- Yelp — location history for Nearby Friends

## Related
[NoSQL Databases](/learn/system-design/nosql-databases) · [Databases and DBMS](/learn/system-design/databases-and-dbms) · [Replication and Read Consistency](/learn/system-design/replication-and-read-consistency)
