---
title: "Database Federation"
summary: "Your database is struggling. Before you shard it — which is close to irreversible — there's no a cheaper move that solves a surprising number of cases: split it by feature instead of by row."
stage: 3
stageName: "Scaling data"
tier: "core"
seq: 23
tags: ["federation", "databases", "scaling", "architecture"]
---

Your database is struggling. Before you shard it — which is close to irreversible — there's no a cheaper move that solves a surprising number of cases: **split it by feature instead of by row.**

---

## One database, several unrelated workloads

A typical application database after three years:

```
users          2 GB     read-heavy, tiny, every request touches it
orders        400 GB    write-heavy, transactional, the core of the business
analytics_events  4 TB  append-only, written constantly, read by batch jobs
sessions       8 GB     enormous churn, worthless after 30 minutes
```

These are four completely different workloads sharing one machine, one buffer pool, one connection pool and one backup schedule.

And they interfere. The nightly analytics job saturates the disk and every checkout slows down. The session table's constant churn causes vacuum pressure that affects everything. You want to tune `work_mem` for analytics and it's wrong for OLTP. You can't upgrade Postgres because the analytics team depends on an extension.

Notice that **none of this is a size problem**. `orders` at 400 GB is comfortable for one machine. The problem is four workloads with nothing in common sharing one set of resources.

---

## Split by domain

<figure class="sd-figure"><img src="/system-design/diagrams/database-federation.svg" alt="Diagram: Database Federation" loading="lazy" decoding="async" /></figure>

Federation — also called functional or vertical partitioning — gives each domain its own database:

```
users db       small, read-heavy, aggressive caching, many replicas
orders db      transactional, tuned for OLTP, careful backups
analytics db   columnar, cheap storage, no availability requirement
sessions db    Redis, no durability at all
```

Each is now sized, tuned, backed up and scaled for exactly what it does. The analytics job can't touch checkout latency because it isn't on the same hardware. You can move `sessions` to Redis without migrating anything else. You can run different database *engines* — which matters, because [SQL vs NoSQL](/learn/system-design/sql-vs-nosql) is rarely one answer for a whole system.

There's an organizational payoff too: each database now has one owning team, so schema changes stop being cross-team negotiations.

---

## Federation versus sharding

They're both "split the database", and they're different axes.

**Federation is vertical.** Different tables move to different databases. Each database has a *different schema*, and one domain's data lives entirely in one place.

**Sharding is horizontal.** The *same* table splits across machines by a key. Every shard has an *identical schema* and holds a subset of rows. → [Sharding and Partitioning](/learn/system-design/sharding-and-partitioning)

| | Federation | Sharding |
|---|---|---|
| Splits by | feature / domain | row key |
| Schemas | different per database | identical everywhere |
| Helps with | mixed workloads, team ownership | one table too big or too hot |
| Reversible? | fairly — merge them back | not really |
| Complexity | low | high |

The relationship is a ladder. Federation splits `orders` away from everything else. If `orders` *alone* then outgrows a machine, you shard it. **Federate first — it's cheaper, reversible, and it maps onto how your teams are organized.**

---

## What it costs you

Federation isn't free, and the costs are all the same cost wearing different hats: **you can no longer do things that span two databases.**

**Joins stop working.** `users JOIN orders` was one query. Now it's two round trips plus an application-side join. Realistically you denormalize — copy the user's display name onto the order — and take on the consistency maintenance that implies. → [Normalization and Denormalization](/learn/system-design/normalization-and-denormalization)

**Transactions stop working.** You can't atomically write to `users` and `orders` anymore. Everything in [Avoiding Distributed Transactions](/learn/system-design/avoiding-distributed-transactions) applies: order the writes so the reachable failure is harmless, or use a saga.

**Foreign keys stop being enforced.** `orders.user_id` no longer references anything the database can check. Nothing stops an order pointing at a deleted user except your discipline.

**Referential cleanup becomes a job.** Deleting a user used to cascade. Now it's an event, or a nightly reconciliation.

That list is exactly why you federate along *seams that already exist*. If two tables are joined in half your queries, they belong in the same database. Split where the queries don't go.

---

## Its relationship to microservices

If this sounds like database-per-service, that's because it is the same split. → [Monoliths and Microservices](/learn/system-design/monoliths-and-microservices)

Two things worth separating, though. You can federate databases while keeping a single deployable monolith — a modular monolith with separate datastores per module, which is often the sweet spot. And you can (disastrously) split into microservices while leaving them all sharing one database, which gives you the operational cost of distribution with none of the isolation.

Federation is the *data* half of the decoupling, and it's the half that carries most of the benefit. Doing it first is a good way to discover whether your service boundaries are real — if you can't cleanly split the data, you haven't found a real boundary yet.

---

## Where this shows up

- **Almost every system that has grown past its first database**, usually arrived at by accident rather than design.
- **Reporting and analytics** splitting off from OLTP — the most common first federation, and often via CDC into a warehouse.
- **Sessions and caches** moving to Redis, which people do without thinking of it as federation, though it is.
- **Microservice migrations**, where database-per-service is the same operation with a different name.

---

## In an interview

When someone asks how you'd scale a struggling database, federation should come before sharding in your answer. Most candidates jump straight to sharding, and reaching for the irreversible option first is the wrong instinct.

The strong version names the ladder: replicas → caching → federation → sharding, and says why each rung is cheaper than the next.

And be ready for the follow-up about cross-database joins and transactions, because that's the real cost. Saying "I'd federate along boundaries where queries don't already join" shows you know the constraint rather than discovering it later.

---

## Seen in
- URL Shortener · Sharding and Request Routing — splitting by function (links vs users vs analytics) comes up as the alternative to sharding one big table

## Related
[Sharding and Partitioning](/learn/system-design/sharding-and-partitioning) · [Monoliths and Microservices](/learn/system-design/monoliths-and-microservices) · [SQL vs NoSQL](/learn/system-design/sql-vs-nosql) · [Avoiding Distributed Transactions](/learn/system-design/avoiding-distributed-transactions) · [Normalization and Denormalization](/learn/system-design/normalization-and-denormalization) · [Scalability](/learn/system-design/scalability) · [Caching Strategies](/learn/system-design/caching-strategies)

## Sources
- [Microservices.io: Database per service](https://microservices.io/patterns/data/database-per-service.html)
- [Microsoft Azure Architecture Center: Data partitioning strategies](https://learn.microsoft.com/en-us/azure/architecture/best-practices/data-partitioning)
- [AWS: Database sharding and partitioning strategies](https://aws.amazon.com/what-is/database-sharding/)
