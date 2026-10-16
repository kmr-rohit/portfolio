---
title: "Monoliths and Microservices"
summary: "Almost every system starts as one program. At some point someone proposes splitting it into services, and the conversation usually turns into a values debate instead of an engineering one."
stage: 8
stageName: "Services and infrastructure"
tier: "useful"
seq: 58
tags: ["architecture", "microservices", "monolith", "domain-driven-design"]
---

Almost every system starts as one program. At some point someone proposes splitting it into services, and the conversation usually turns into a values debate instead of an engineering one.

This note tries to keep it engineering. We'll build a monolith that genuinely works, find the specific pains that eventually make splitting worth it, and then be just as specific about the bill that arrives afterwards.

---

## A monolith that is genuinely working

You're running an online store. One repository, one build, one deployable artifact, one Postgres database. Inside it are modules for catalog, cart, checkout, payments, inventory, shipping and reviews. Eight engineers work on it.

Watch how cheap everything is.

Checkout needs to know whether an item is in stock. That's a function call.

```python
reservation = inventory.reserve(sku, qty)   # nanoseconds
```

It can't time out. It can't half-succeed. It can't return successfully to a caller that has already given up. If it throws, the stack trace has both checkout and inventory in it, and you know the answer before you've finished reading it.

Placing an order touches three tables, and correctness is one transaction.

```sql
BEGIN;
  UPDATE inventory SET available = available - 1 WHERE sku = 'BK-1024' AND available > 0;
  INSERT INTO orders (id, customer_id, sku, status) VALUES (...);
  INSERT INTO payments (order_id, amount, status) VALUES (..., 'pending');
COMMIT;
```

Either all three happen or none do. The database guarantees it. You wrote no reconciliation code, no retry logic, no compensating action, because there is nothing to reconcile.

The rest is the same story. Deploying is one artifact. Running locally is one process. A refactor that renames a field is one commit that the compiler checks end to end. Integration tests run against the real thing, not against mocks of six network dependencies.

**None of this is a starter kit you grow out of in six months.** Plenty of large, profitable companies run systems that look exactly like this, and Martin Fowler's position is that they're mostly right to: "the majority of software systems should be built as a single monolithic application" with "good modularity within that monolith."

So we need to be precise about what actually goes wrong, because "it got big" isn't a reason.

---

## The five pains that actually justify splitting

Fast-forward a few years. Same store, now 120 engineers across fourteen teams. Here is what specifically hurts.

**Independent deployability.** Every change to any module ships the entire artifact. The build takes 40 minutes, so changes queue up and go out in batches. When a bad commit in the reviews module causes an error spike, you roll back — and you roll back the payments fix that shipped in the same batch and had nothing to do with it. Teams start coordinating release windows, and the cadence collapses from "when it's ready" to "Tuesdays, if nothing else broke."

This is the one that shows up first and hurts the most, and it's the one microservices address most directly.

**Independent scaling.** Suppose the image-processing path is CPU-bound and is by far the biggest CPU consumer in the process, but only a small fraction of your traffic. To handle it at peak, you scale out the whole binary — every instance carrying the catalog code, the checkout code and the full memory footprint, just so a few of them can resize pictures. You're buying machines shaped for your worst-behaved module and using them for everything else.

**Blast-radius isolation.** A memory leak in the review-rendering code makes the process OOM. That process was also serving checkout. A module nobody would call business-critical has just taken payments offline, because in a monolith every module shares one heap, one thread pool and one fate.

**Team autonomy.** Fourteen teams in one codebase means fourteen teams sharing a merge queue, a dependency file, a test suite and a release calendar. Every upgrade of a shared library is a negotiation. Conway's law runs in both directions here: your architecture starts to mirror your org chart whether you want it to or not, and a single artifact forces a single conversation.

**Technology choice.** The recommendations team wants to run a Python model. The monolith is JVM. Their options are "rewrite the model", "shell out to a sidecar process nobody owns", or "don't". Committing to one runtime was free at eight engineers and expensive at 120.

<aside class="sd-callout sd-callout--note">



Notice that four of these five are organisational, not technical. Microservices are primarily a way of buying team independence with engineering complexity. If your problem isn't team independence, check whether you're buying the right thing.

</aside>

---

## The bill

Now the honest half. Every one of the cheap things from the first section just got expensive.

### The function call became a network call

```python
# before
reservation = inventory.reserve(sku, qty)

# after
resp = http.post("http://inventory/reserve", json={...}, timeout=0.25)
```

That second line has failure modes the first one didn't have. It can time out. It can return a connection error. It can succeed on the server and fail on the wire, so you don't know whether the reservation happened. It can succeed slowly enough that checkout has already returned an error to the user.

Every one of those needs a deliberate answer: a timeout (always, and shorter than you think), a retry policy, and — because retries on a "maybe it worked" failure will double-reserve stock — idempotency keys on the receiving side. → [Idempotency](/learn/system-design/idempotency), [Circuit Breakers](/learn/system-design/circuit-breakers)

And you need retries to be bounded, because the failure mode of naive retries is a retry storm: the inventory service slows down, every caller retries, the extra load makes it slower, and the whole thing collapses inward.

### Latency stops being free and starts compounding

A page that made a dozen in-process calls now makes a dozen network calls. Each hop adds serialisation, a round trip, and deserialisation.

The nastier part is the tail. If one backend call is slow at the 99th percentile, a page that makes one such call is slow 1% of the time. A page that fans out to ten of them is slow far more often, because it's only as fast as its slowest dependency. **Fan-out turns a rare tail into a common one.** This is why gateway aggregation and per-call deadlines exist.

### The transaction is gone

That `BEGIN ... COMMIT` spanned inventory, orders and payments. Those are three services with three databases now. There is no `COMMIT` that covers them.

Two-phase commit technically exists and is almost universally rejected in practice — it holds locks across a network for the duration of the slowest participant, and a coordinator crash leaves participants blocked. What you use instead is a **saga**: a sequence of local transactions, each with a compensating action if a later step fails.

<figure class="sd-figure"><img src="/system-design/diagrams/monoliths-and-microservices.svg" alt="Diagram: Monoliths and Microservices" loading="lazy" decoding="async" /></figure>

The compensations are the hard part. "Release stock" is easy. "Un-charge a card" is a refund, which is a different operation with a different failure mode, visible to the customer, and possibly subject to fees. You now write and test this code, and it is the code most likely to be wrong. → [Avoiding Distributed Transactions](/learn/system-design/avoiding-distributed-transactions)

### Debugging without a stack trace

A customer reports a failed checkout. In the monolith you grepped one log and read one stack trace. Now the request touched seven services, and each wrote its own logs, and none of them knows about the others.

The fix is **distributed tracing**: the entry point mints a trace ID, every service propagates it in outbound headers, and every operation emits a span with its parent's ID. A tracing backend stitches the spans into one timeline so you can see that the call took 900ms because the shipping service spent 800ms waiting on a third-party rate quote.

This is not optional infrastructure that you add later when you have time. Without it, "which service is slow" becomes an afternoon of guessing, every time.

### Operational overhead multiplies

Forty services means forty CI pipelines, forty deployment configs, forty sets of dashboards and alerts, forty secret rotations, forty dependency-upgrade backlogs, and an on-call story for each. Local development, which used to be one process, now needs either a way to run everything or a way to run one thing against shared environments.

None of these are hard individually. That's the trap — each one is a small, reasonable cost, multiplied by forty.

### You can no longer change two things at once

In a monolith, renaming a field is one commit. Across a service boundary, the caller and the callee deploy separately, so at some point during the rollout one side is new and the other is old. That's not an edge case, it's the normal state of every deploy.

So every change to a shared contract becomes a multi-step dance — **expand, migrate, contract**:

1. Add the new field alongside the old one. Deploy the provider. Both fields work.
2. Move every consumer to the new field. Deploy them, in any order.
3. Once nothing reads the old field, remove it. Deploy the provider again.

Three releases, spread over days or weeks, to do what used to be one commit. Skip a step and you break a caller mid-rollout.

### Consistency becomes something users can see

With one database, a write was visible to the next read. With services exchanging events, the inventory service knows about the sale immediately and the search index knows about it a second later. A customer who just bought the last copy may still see it listed as available.

Often that's fine. Sometimes it's a double-sold ticket. The work is deciding, per interaction, which staleness is acceptable — and that's design work you didn't have to do before. → [Replication and Read Consistency](/learn/system-design/replication-and-read-consistency)

---

## The modular monolith, which is what most teams actually want

Look back at the two lists. The pains are mostly about **deployment and organisation**. The bill is almost entirely about **the network**.

That raises an obvious question: can you get the boundaries without the network? Mostly, yes. That's a modular monolith — one deployable artifact, but with internal module boundaries enforced as strictly as if they were services.

Concretely, it means:

- Each module owns its own tables. No other module reads them directly.
- Modules talk through explicit public interfaces. Everything else is package-private.
- No cross-module joins in SQL. If checkout needs catalog data, it asks the catalog module.
- The boundaries are enforced by tooling, not by good intentions — separate build targets, dependency rules in the build file, architecture tests that fail CI on a forbidden import, separate database schemas with separate database users.

That last point matters most. **A boundary nobody enforces isn't a boundary**, it's a comment. The reason monoliths turn into mud isn't that monoliths are bad, it's that nothing stops module A from importing module B's internals at 5pm on a Friday.

You still get ACID transactions, stack traces, one deploy and one process. You lose independent deployability and independent scaling — which, if that's your actual pain, means this isn't enough. But if your actual pain is "the code is a mess", this fixes it and microservices don't.

| | One deploy unit | ACID across modules | Independent scaling | Boundary enforced by |
|---|---|---|---|---|
| Big-ball-of-mud monolith | yes | yes | no | nothing |
| Modular monolith | yes | yes | no | the build and CI |
| Microservices | no | no | yes | the network |

---

## Start with the monolith, extract services

The default advice is to begin monolithic and split later, and the reason isn't caution for its own sake.

Fowler's observation from watching a lot of both: "Almost all the successful microservice stories have started with a monolith that got too big and was broken up," while nearly every project he saw that started as microservices ended up in serious trouble.

The mechanism behind that is simple. **Service boundaries are expensive to move and you don't know where they go yet.** Inside a monolith, moving a boundary is a refactor your IDE can do. Across services, moving a boundary means a data migration, two API changes, a coordinated deploy, and probably a period where both versions run. Drawing lines before you understand the domain means drawing them wrong and then paying that price to fix them.

The extraction pattern that works is the **strangler fig**: pick one module at a well-understood edge, put a façade in front of the functionality, stand up the new service behind it, move traffic over, then delete the old code. Repeat. The monolith stays as a substantial core and shrinks over time — and it may well never disappear, which is fine.

Pick the first extraction for a reason. Good candidates are modules with a genuinely different scaling profile, a clean data boundary, and few callers. Bad candidates are whatever is most tangled, which is exactly where enthusiasm usually points.

---

## Where do the boundaries actually go?

The failure mode is splitting by technical layer or by database table: a "user service", an "order service", a "notification service", one per noun.

It looks tidy and it usually produces a mess, because features don't respect nouns. "Add gift wrapping at checkout" touches the order noun, the pricing noun, the shipping noun and the notification noun — so a one-week feature becomes four services, four teams, four deploys and a release-ordering problem.

**The test of a boundary is whether a typical change fits inside it.** If most features touch one service, the boundaries are good. If most features touch four, they're wrong, no matter how clean the diagram looks.

Domain-driven design gives you the vocabulary for this. A **bounded context** is a region of the system within which a word has one consistent meaning. Notice that "product" means different things in different parts of your store: to catalog it's a title, description and images; to pricing it's a price, a currency and a set of discount rules; to shipping it's weight and dimensions; to inventory it's a count per warehouse. Trying to build one Product object that serves all four produces a class with sixty fields that four teams fight over.

Four bounded contexts, each with its own smaller, coherent notion of a product, is the better carve — and those contexts are your candidate service boundaries. They usually line up with business capabilities ("fulfil an order") rather than with entities ("order").

---

## Database per service

Here's the rule that makes the split real, and the one most commonly skipped: **each service's data is private, reachable only through that service's API.**

It's tempting to skip it. Two services, one shared database, no data duplication, and you can still join. Watch what happens.

The orders team adds a `NOT NULL` column to the `orders` table. The shipping service, which also writes to that table, starts failing on insert. Nobody on the orders team knew shipping wrote there. Now a schema change requires a survey of every service that touches the table, plus a coordinated deploy.

That's the whole game. **If you can't change your schema without asking permission, you can't deploy independently, and independent deployability was the reason you split.** A shared database quietly re-couples everything you just spent a year decoupling.

Private data can mean private tables, a private schema, or a separate database server — the isolation level varies, but the access rule doesn't. It also lets each service pick a store that fits: a relational database for orders, a search engine for catalog, a key-value store for sessions. → [Database Federation](/learn/system-design/database-federation)

The costs are real and you should be able to name all three:

- **No joins across services.** "Orders with customer names" becomes either API composition (fetch orders, then fetch the customers, join in application code) or a read model built from events. → [CQRS](/learn/system-design/cqrs)
- **No foreign keys across services.** Referential integrity becomes something your code maintains, and orphaned references become a thing that happens.
- **No transactions across services.** Which is where sagas come back in.

---

## The distributed monolith

This is what you get when you take on the bill and never collect the benefits.

The symptoms are specific:

- Services share a database, so nobody can change a schema alone.
- Services must be deployed together, in a particular order, or things break.
- One user request travels through a synchronous chain of six or eight services, so the availability of the request is the *product* of their availabilities and its latency is the *sum* of theirs.
- A typical feature requires changes in four repositories and a release-coordination meeting.

You now have network calls that fail, no distributed tracing budget, forty pipelines, and sagas — plus the coordination costs of the monolith you were trying to escape. It is strictly worse than either endpoint.

Almost always the root cause is boundaries drawn along the wrong lines: by noun, by table, or by whoever happened to own the code. The fix is usually to merge services back together, not to add more.

<aside class="sd-callout sd-callout--warning">



"We're moving to microservices" with no discussion of data ownership is the single reliable predictor of a distributed monolith. If the migration plan doesn't say which service owns which tables, there isn't a migration plan.

</aside>

---

## Where this shows up

- **A payments or checkout path extracted first**, because its compliance and audit requirements differ so much from the rest of the system that isolating it is worth the network cost on its own.
- **ML and search components split out early**, because they need different hardware and a different runtime — usually the least controversial extraction in any system.
- **Teams that split by noun and merge back**, which is common enough that "we went back to a modular monolith" is now a normal engineering-blog genre rather than an admission of defeat.
- **Kubernetes-shaped infrastructure**, where the per-service overhead (deploy config, health checks, discovery, rollout) is low enough to make forty services operationally plausible. → [VMs and Containers](/learn/system-design/vms-and-containers), [Service Discovery](/learn/system-design/service-discovery)

## In an interview

If they ask "monolith or microservices", don't pick a side immediately. Ask what's actually forcing the split — deploy cadence, scaling shape, team count — and design against that. Answering "microservices, because scale" without naming a pain is the most common weak answer.

Have the counter-argument ready. Interviewers often push with "why not just a monolith?", and the strong reply names the specific pain and the specific bill: "independent deploys are the win here; the cost is that this order flow becomes a saga, so let me show you the compensations."

For a Staff-level bar, the boundary discussion matters more than the services themselves. Say where the bounded contexts are and why, and say which service owns which data. Drawing seven boxes without saying who owns the `orders` table is the answer that gets probed.

If you propose splitting, be ready for "what breaks in the meantime?" Strangler-fig extraction, expand-migrate-contract for the contract change, and a period where both paths run — that's the expected shape.

## Seen in
- LinkedIn · High Level Design — hundreds of services glued by Rest.li, D2 discovery and "super blocks" that hide clusters of services behind one facade

## Related
[N-Tier Architecture](/learn/system-design/n-tier-architecture) · [API Gateway](/learn/system-design/api-gateway) · [Service Discovery](/learn/system-design/service-discovery) · [Database Federation](/learn/system-design/database-federation) · [Avoiding Distributed Transactions](/learn/system-design/avoiding-distributed-transactions) · [Circuit Breakers](/learn/system-design/circuit-breakers) · [Idempotency](/learn/system-design/idempotency) · [Event-Driven Architecture](/learn/system-design/event-driven-architecture) · [CQRS](/learn/system-design/cqrs) · [Orchestration and Choreography](/learn/system-design/orchestration-and-choreography)

## Sources
- [Martin Fowler — MonolithFirst](https://martinfowler.com/bliki/MonolithFirst.html)
- [Martin Fowler — Microservice Premium](https://martinfowler.com/bliki/MicroservicePremium.html)
- [microservices.io — Database per Service](https://microservices.io/patterns/data/database-per-service.html)
- [Karan Pratap Singh — System Design: Monoliths and Microservices](https://www.karanpratapsingh.com/courses/system-design/monoliths-microservices)
