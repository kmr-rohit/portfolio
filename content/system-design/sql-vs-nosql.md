---
title: "SQL vs NoSQL"
summary: "This gets framed as a rivalry. It isn't one, and treating it as one is how people choose a database for the wrong reason and find out eighteen months later."
stage: 2
stageName: "The database core"
tier: "core"
seq: 14
tags: ["databases", "sql", "nosql", "decision"]
---

This gets framed as a rivalry. It isn't one, and treating it as one is how people choose a database for the wrong reason and find out eighteen months later.

What follows is a decision procedure, not a scoreboard.

---

## The question people think they're answering

"Which one is better at scale?"

That question has no answer, because both scale and they scale by giving up different things. Postgres scales by adding replicas, then federating, then sharding — and gets harder at each step. Cassandra scales by adding nodes almost linearly — and was never able to do a join or an ad-hoc query in the first place.

Neither is winning. They front-loaded their costs differently.

---

## The question that actually decides it

**Do you know your access patterns, and will they hold still?**

That's the fork almost every real decision comes down to.

A relational database assumes you'll model the entities properly and work out the queries later. Normalize, index, write whatever SQL next quarter needs. You're paying — in join cost and a fixed schema — for the option to ask questions you haven't thought of yet.

A NoSQL store assumes you already know the questions. You shape the data to serve them, often duplicating it several ways, and you get enormous speed on exactly those patterns. You've also spent the option value: a query you didn't plan for means a new index, a migration, or a rewrite. → [NoSQL Databases](/learn/system-design/nosql-databases)

So the real question isn't about scale. It's **how confident are you that you know what you'll be asked?**

---

## Working down the list

<figure class="sd-figure"><img src="/system-design/diagrams/sql-vs-nosql.svg" alt="Diagram: SQL vs NoSQL" loading="lazy" decoding="async" /></figure>

**Are the access patterns stable and narrow?** If you can't answer that confidently, take the relational database. Its forgiveness is worth more than any benchmark, because the thing most likely to hurt you is a requirement nobody's mentioned yet.

**Does anything need a multi-row invariant?** Money moving between accounts, inventory that mustn't oversell, uniqueness across rows. That's what transactions and constraints are for, and enforcing them in application code over an eventually-consistent store is a genuinely hard distributed systems problem you'd be volunteering to solve yourself. → [Transactions and Isolation](/learn/system-design/transactions-and-isolation)

**Is a single node genuinely too small?** This is where people jump early, and the bar is far higher than the folklore suggests. A modern Postgres instance handles terabytes and tens of thousands of writes per second. Most interview systems — and most real ones — never leave that envelope.

Notice the ordering. Scale is the *third* question, not the first.

---

## Exhaust the cheap options first

Before either answer there's a ladder, and every rung is reversible:

**Read replicas** if you're read-heavy. A **cache**, usually the biggest win per unit of effort ([Caching Strategies](/learn/system-design/caching-strategies)). Fix the **indexes**, because a missing one is very often the actual problem ([Database Indexes](/learn/system-design/database-indexes)). **Connection pooling**. **Federate** by feature so different domains live on different databases ([Database Federation](/learn/system-design/database-federation)). A **bigger machine**, which is unfashionable and frequently correct.

Sharding and a datastore migration are the two rungs you can't easily walk back. Do them last.

---

## What each is genuinely better at

Relational wins on **ad-hoc querying** — anything analytical, anything where a human will want to ask a new question next week. On **multi-row invariants** enforced by the database rather than hoped for. On **referential integrity**. And on **operational familiarity**, which is badly underrated: your team already knows how to back it up, tune it and debug it at 3am.

NoSQL wins on **sustained write throughput**, particularly LSM-backed stores taking a firehose. On **horizontal scale as a default** rather than a project. On **variable or fast-evolving shape**. And on **predictable single-digit-millisecond latency** for a known key, which a query planner won't always give you.

| | Relational | NoSQL |
|---|---|---|
| Best when | queries will change | queries are known and narrow |
| Scaling path | replicas → federation → sharding | add nodes |
| Invariants | enforced by the database | enforced by you |
| Ad-hoc queries | yes | no, or slowly |
| Cost of getting it wrong | slow queries you can index | a migration or a rewrite |

---

## Lines that are no longer true

**"NoSQL doesn't do transactions."** MongoDB, DynamoDB and Cassandra all have some form now. → [ACID and BASE](/learn/system-design/acid-and-base)

**"SQL can't scale horizontally."** Vitess, Citus, Aurora, Spanner and CockroachDB exist. Uber runs a document store on sharded MySQL. → 12 - How Uber Actually Does It

**"NoSQL means no schema."** It means schema-on-read. The structure still exists; your application enforces it instead of the database.

**"NoSQL is faster."** At the patterns it was designed for. A Postgres primary-key lookup is also very fast.

---

## The answer is usually "both"

This isn't one choice for one system. It's a choice per workload, and a real system has several.

Orders and payments in Postgres, where the invariants live. Sessions and rate-limit counters in Redis, where you only ever have a key. Chat history in Cassandra, where the write volume is. Search in Elasticsearch, because inverted indexes are a different problem entirely.

That's the same reasoning as the three storage tiers in Uber · High Level Design: the workloads differ by orders of magnitude and want opposite things, so they don't share a database.

---

## Where this shows up

- **Almost every system design interview**, usually phrased as "what database would you use?"
- **Polyglot persistence** in any large production system — nobody serious runs one datastore for everything.
- **The migration decision**, when a relational database is straining and someone proposes a rewrite that a cache and three indexes would have prevented.

---

## In an interview

The strongest answer is usually the least dramatic. *"Postgres. Write volume is a few thousand a second, I need a transaction across these two tables, and the access patterns will move as the product does. If writes hit the tens of thousands I'd shard by tenant, and here's the key I'd use."*

That reads as judgement. "NoSQL, for scale" reads as a reflex.

Saying out loud that this choice matters less than candidates think — and then naming the specific property that *would* change your mind — is a real seniority signal. And if you name a NoSQL store, expect "why not Postgres?" every single time. Have the one property ready.

---

## Seen in
- Chat System · Storing Message History — a write-heavy, append-only history keyed by conversation and time is where a wide-column store wins
- Google Drive · High Level Design — file metadata stays relational because of hierarchy and permissions; chunks go to object storage

## Related
[SQL Databases](/learn/system-design/sql-databases) · [NoSQL Databases](/learn/system-design/nosql-databases) · [Databases and DBMS](/learn/system-design/databases-and-dbms) · [ACID and BASE](/learn/system-design/acid-and-base) · [Transactions and Isolation](/learn/system-design/transactions-and-isolation) · [Sharding and Partitioning](/learn/system-design/sharding-and-partitioning) · [Database Federation](/learn/system-design/database-federation) · [Caching Strategies](/learn/system-design/caching-strategies)

## Sources
- [PostgreSQL: JSON types](https://www.postgresql.org/docs/current/datatype-json.html)
- [Amazon DynamoDB: From SQL to NoSQL](https://docs.aws.amazon.com/amazondynamodb/latest/developerguide/SQLtoNoSQL.html)
- [Martin Fowler: Polyglot Persistence](https://martinfowler.com/bliki/PolyglotPersistence.html)
- [Uber: Evolving Schemaless into a Distributed SQL Database](https://www.uber.com/en-US/blog/schemaless-sql-database/)
