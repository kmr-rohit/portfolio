---
title: "CQRS"
summary: "Command Query Responsibility Segregation. Terrible name, simple idea: the shape that's good for writing data is rarely the shape that's good for reading it, so stop making one model do both."
stage: 7
stageName: "Async and messaging"
tier: "core"
seq: 53
tags: ["cqrs", "architecture", "read-models", "eventual-consistency"]
---

Command Query Responsibility Segregation. Terrible name, simple idea: **the shape that's good for writing data is rarely the shape that's good for reading it, so stop making one model do both.**

---

## The tension that motivates it

You run an e-commerce backend. Orders live in a properly normalized schema — orders, line items, customers, addresses, products, payments. Eight tables, foreign keys, every fact stored exactly once. It's a good schema. Writes are easy to keep correct because there's only ever one place to update.

<figure class="sd-figure"><img src="/system-design/diagrams/cqrs.svg" alt="Diagram: CQRS" loading="lazy" decoding="async" /></figure>

Then the business asks for a seller dashboard: revenue by product by week, with refund rates and average fulfilment time.

That query joins six of those tables and aggregates across millions of rows. It takes eleven seconds. So you add indexes — and now every order insert has six indexes to maintain. You add a materialized view, and now it's stale. You denormalize a couple of columns onto `orders`, and now you have two places to update and a consistency problem.

Each fix makes writes worse to make reads better. **The two workloads want opposite things from the same schema, and you only have one schema.**

---

## The move

Stop pretending one model can serve both. Split them.

**Commands** change state. `PlaceOrder`, `CancelOrder`, `RefundLineItem`. They go to a write model that stays normalized, keeps its constraints, and is optimized for correctness.

**Queries** return data. They hit a *separate* read model, shaped exactly for the screen that needs it — pre-joined, pre-aggregated, denormalized without guilt, because nothing writes to it directly.

The seller dashboard gets its own table where each row is already a product-week summary. The query becomes a single indexed lookup. And because nothing else writes to that table, denormalizing it costs you nothing in write complexity.

Note what's *not* required here. CQRS doesn't demand two databases, event sourcing, or a message bus. The minimum version is two sets of classes over one database — commands using rich domain objects, queries using flat DTOs and hand-written SQL. Most of the benefit, almost none of the cost.

---

## Keeping the read model current

Once the models are genuinely separate stores, something has to update the read side.

**Synchronously, in the same transaction.** Both stay in lockstep. Requires them to be in the same database, and every write now pays for every read model it feeds. Fine for one or two; doesn't scale to ten.

**Asynchronously, via events.** The write side emits `OrderPlaced`, a projector consumes it and updates the read model. Decoupled and scalable — add a new read model by adding a consumer, with zero changes to the write side. → [Event-Driven Architecture](/learn/system-design/event-driven-architecture)

**Via change data capture.** Tail the write database's log and project from that. The write side doesn't even know projections exist. → [Secondary Indexes at Scale](/learn/system-design/secondary-indexes-at-scale)

The last two both mean lag.

---

## The bill: your UI now lies

This is the part that decides whether CQRS is worth it, and it's routinely underplayed.

A user places an order, gets redirected to their order list, and **their order isn't there**. The write committed, the projection hasn't caught up, and the read model is two hundred milliseconds behind.

That's not a bug you can fix in the backend. It's inherent. You handle it in one of three ways:

**Read your own writes from the write model.** The user's own view of their own order comes from the authoritative store; everyone else's aggregate views come from the read model. Usually the right answer. → [Replication and Read Consistency](/learn/system-design/replication-and-read-consistency)

**Lie optimistically in the UI.** The client already knows what it submitted, so render it immediately and reconcile when the projection lands. What most modern frontends do anyway.

**Show the truth.** "Your order is processing." Honest, sometimes acceptable, often not.

---

## When it's worth it

CQRS is worth it when the read and write workloads genuinely diverge. Reads outnumber writes by orders of magnitude and are shaped completely differently. Several distinct read shapes exist over the same data. The read side needs to scale independently. Or the write side has genuinely complex domain logic that flat query DTOs would obscure.

It's not worth it for straightforward CRUD, and that's most software. If your reads are "fetch this entity by id" and your writes are "update this entity", the two models are the same model and splitting them buys you two of everything for no gain.

<aside class="sd-callout sd-callout--warning">

<p class="sd-callout-title">The failure mode</p>

CQRS is one of the most over-applied patterns in this list. Greg Young, who named it, has spent years telling people it's a pattern for one bounded context with genuinely complex read/write asymmetry — not an application architecture.

Applied wholesale to a CRUD app, it doubles your code, adds eventual consistency you didn't need, and makes debugging materially harder. The cost is immediate and the benefit is hypothetical.

</aside>

---

## Its relationship to event sourcing

These two get taught together so consistently that people assume they're one thing. They aren't, and the distinction is worth holding.

[Event Sourcing](/learn/system-design/event-sourcing) is about how you *store* the write model — as a log of events rather than current state.

CQRS is about *separating* read and write models.

They fit well: if your write model is an event log, you can't query it usefully, so you need projections — which is CQRS. That's why they travel together.

But you can do either alone. CQRS over two ordinary SQL tables is common and useful. Event sourcing with a single model is possible, just awkward.

---

## Where this shows up

- **Read replicas** are the mildest form of this idea — same schema, but reads are physically separated from writes.
- **A search index** next to your primary database is textbook CQRS, even though nobody calls it that. Elasticsearch *is* a read model.
- **Analytics pipelines** — OLTP writes feeding an OLAP store via CDC.
- **Materialized views**, which are CQRS with the database doing the projecting.

---

## In an interview

Don't lead with the acronym. Lead with the problem: *"reads and writes want different shapes here, so I'd keep the write model normalized and build a denormalized read model for the dashboard, updated asynchronously."* That's CQRS, described in a way that shows you know why.

Then volunteer the consistency cost before you're asked, and say how the UI handles it. That's the part that separates having read about the pattern from having lived with it.

And know when to say no. If asked "should we use CQRS?" for a CRUD system, "no, and here's why" is the stronger answer.

---

## Seen in
- News Feed · Precomputing the Feed — the textbook case: `Posts` is the write model, `Feed` is a read model kept up to date asynchronously
- Search Autocomplete · High Level Design — the trie is rebuilt offline from the query log and swapped in, so readers never see a half-built list
- LinkedIn · People You May Know — the write side is a batch pipeline on different storage; the read side is a point lookup by member id
- Ad Click Aggregator · The Minute View — raw clicks are the write model; the per-minute aggregates advertisers query are a derived read model

## Related
[Event Sourcing](/learn/system-design/event-sourcing) · [Event-Driven Architecture](/learn/system-design/event-driven-architecture) · [Normalization and Denormalization](/learn/system-design/normalization-and-denormalization) · [Replication and Read Consistency](/learn/system-design/replication-and-read-consistency) · [Secondary Indexes at Scale](/learn/system-design/secondary-indexes-at-scale) · [Databases and DBMS](/learn/system-design/databases-and-dbms)

## Sources
- [Martin Fowler: CQRS](https://martinfowler.com/bliki/CQRS.html)
- [Greg Young: CQRS Documents](https://cqrs.files.wordpress.com/2010/11/cqrs_documents.pdf)
- [Microsoft Azure Architecture Center: CQRS pattern](https://learn.microsoft.com/en-us/azure/architecture/patterns/cqrs)
- [Microservices.io: CQRS](https://microservices.io/patterns/data/cqrs.html)
