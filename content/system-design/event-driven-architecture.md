---
title: "Event-Driven Architecture"
summary: "Services usually start out calling each other directly. Checkout calls payments, payments calls inventory, everybody waits, and one slow service makes the whole click slow."
stage: 7
stageName: "Async and messaging"
tier: "core"
seq: 51
tags: ["architecture", "events", "messaging", "outbox"]
---

Services usually start out calling each other directly. Checkout calls payments, payments calls inventory, everybody waits, and one slow service makes the whole click slow.

Event-driven architecture is what you reach for when that chain of calls becomes the thing that's breaking. It's an architectural *style*, not a technology — the technology underneath is a broker ([Message Brokers](/learn/system-design/message-brokers)). The style is about who has to know about whom.

---

## A checkout that calls everybody

You're building an online store. A customer clicks **Place order**, and the order service does its job:

```
POST /orders
  ├─ 1. INSERT INTO orders                        15 ms
  ├─ 2. POST payment-service/charge              250 ms
  ├─ 3. POST inventory-service/reserve            40 ms
  ├─ 4. POST email-service/confirmation          120 ms
  ├─ 5. POST analytics-service/track              30 ms
  └─ 6. POST loyalty-service/award-points         25 ms
                                       total ≈  480 ms
```

This works, and you should not feel bad about shipping it. The flow is right there in one function. You can read it top to bottom, set a breakpoint, and follow a stack trace when it breaks. For a long time that's worth more than anything in this note.

Then three things go wrong, and they go wrong in a particular order.

**First, the latency adds up.** Every downstream call is on the customer's clock. Adding a seventh consumer makes checkout slower for everyone, so every new feature is a negotiation with the checkout latency budget.

**Second, the availability multiplies.** If each of those five services is up 99.9% of the time, your checkout is up `0.999^5 ≈ 99.5%` — about 3.6 hours of downtime a month, none of which is your fault. Calling a service synchronously means adopting its uptime as your own.

**Third, and worst: the email service goes down at 2am.** The customer's card has been charged. The stock is reserved. The order row is committed. And `POST /email-service/confirmation` times out, the whole handler throws, and checkout returns a 500. The customer, who has definitely been charged, sees "something went wrong" and clicks again.

Sending a receipt is the least important thing in that list, and it just failed a paid order.

---

## Trying the obvious fixes

**Fix one: make the unimportant calls fire-and-forget.** Kick steps 4–6 onto a thread pool and return as soon as payment and inventory are done. Latency drops, and email can't fail the order any more.

Then the pod gets rescheduled mid-request and the thread pool evaporates. Those receipts are gone — not retried, not logged, not recoverable, because the only record that they were owed lived in the memory of a process that no longer exists.

**Fix two: put the work on a queue.** Now the email job is durable, and a worker retries until it succeeds. This is genuinely most of the benefit, and for a lot of systems it's where you should stop.

But look at what the order service still has to do:

```python
order = db.insert(order)
payment.charge(order)
queue.send("email-jobs",     SendConfirmation(order.id))
queue.send("analytics-jobs", TrackOrder(order.id))
queue.send("loyalty-jobs",   AwardPoints(order.user_id, order.total))
```

It still names every consumer. When the fraud team wants to score new orders, they file a ticket against the order service. When marketing wants a campaign trigger, another ticket. The order service has become a place where other teams queue up to add a line of code, and each line is a chance to break checkout.

**The coupling was never about being synchronous.** It's that the order service is responsible for knowing who cares.

---

## Inverting it: announce the fact

So stop telling people what to do. Say what happened, once, and let whoever cares listen.

```python
order = db.insert(order)
broker.publish("orders", OrderPlaced(
    order_id=order.id, user_id=order.user_id,
    total=order.total, items=order.items, placed_at=now(),
))
```

That's the entire architectural move. The order service no longer has a list of consumers. It has a topic. Fraud scoring subscribes on Tuesday, and nobody deploys the order service.

Notice what the message says. Not *"send a confirmation email"* — that's an instruction, and it means the order service still decided that an email should happen. `OrderPlaced` is a statement about the world. The email service decided, all by itself, that order placement is something worth emailing about.

---

## Events, commands, and messages

That distinction is worth being precise about, because it's the difference between event-driven architecture and a queue with extra steps.

A **message** is the transport-level thing: an envelope with bytes in it that a broker moves from one place to another. Both of the others are messages. It's the wrapper, not the meaning.

A **command** is an instruction. It's imperative and usually future-tense — `ChargeCard`, `SendConfirmation`, `ReserveStock`. It has exactly one intended recipient, the sender expects it to be carried out, and the sender cares whether it was. A command going unhandled is a bug.

An **event** is a fact. It's past-tense and immutable, because the past doesn't change — `OrderPlaced`, `PaymentCaptured`, `StockReserved`. It's broadcast, not addressed. The publisher does not know or care who is listening, and an event with zero subscribers is perfectly fine.

| | Command | Event |
|---|---|---|
| Says | do this | this happened |
| Recipients | exactly one | zero or many, unknown to the sender |
| Who decides what happens | the sender | each consumer, for itself |
| Can it be rejected | yes — it may fail validation | no — it already happened |
| Coupling direction | sender knows the receiver | receiver knows the sender |

The trap Martin Fowler names is the **passive-aggressive command**: an event that's really an order in disguise. If you publish `OrderPlaced` and there is exactly one consumer, and you'd consider it a production incident if that consumer stopped listening, then you have a command wearing an event's costume. You've taken on all the debugging cost of events and none of the decoupling.

That's not automatically wrong — sometimes a command is simply the right thing, and you should send it as one, to a queue, addressed to its handler. Just don't tell yourself you decoupled anything.

<aside class="sd-callout sd-callout--tip">



Naming is the cheapest diagnostic in the interview. If you find yourself writing a past-tense verb, you're publishing an event. If it's imperative, you're sending a command. Say which one you mean out loud — interviewers notice, because most candidates use "event" for both.

</aside>

---

## Three levels of event-driven

"Event-driven" covers designs that look almost nothing alike. It's useful to think of them as increasing levels of commitment.

### Level 1: event notification

The event is a thin pointer. It carries an id and little else.

```json
{ "type": "OrderPlaced", "order_id": "ord_8812", "at": "2026-03-01T10:04:11Z" }
```

Consumers that need details call back: `GET /orders/ord_8812`. This is the cheapest thing that works, the payload is tiny, and there's exactly one copy of the order data in the world.

**Then you break it.** Every event fans out to six consumers, each of which immediately calls back into the order service. You published an event to reduce load, and you've multiplied read traffic on the thing you were protecting. Worse, the callback returns the order as it is *now*, not as it was when the event fired. A consumer processing a two-minute-old `OrderPlaced` after a cancellation reads a cancelled order and has no idea it's looking at the future.

And you're still coupled: if the order service is down, consumers can't do their work either. You removed the synchronous call on the write path and reintroduced it on the read path.

### Level 2: event-carried state transfer

Put the state in the event. The consumer never calls back.

```json
{ "type": "OrderPlaced", "order_id": "ord_8812",
  "user": { "id": "u_41", "email": "...", "tier": "gold" },
  "items": [ { "sku": "SKU-9", "qty": 2, "price_cents": 1999 } ],
  "total_cents": 3998, "at": "2026-03-01T10:04:11Z" }
```

Now the email service has everything it needs and can keep working while the order service is down — that's **temporal decoupling**, and it's the property people actually want from EDA. Each consumer maintains its own local replica of whatever slice of order data it needs, shaped for its own queries.

The cost is that the data is now in several places and each copy is stale by however far behind that consumer is. You've chosen availability over consistency, deliberately ([CAP Theorem](/learn/system-design/cap-theorem)). You also have to think about payload size, and about what happens to consumers when the schema changes, since they're now parsing your internals rather than calling your API.

### Level 3: event sourcing

Stop keeping current state at all. The log of events *is* the database, and any current state is derived from it. That's a much bigger commitment and it gets its own note — [Event Sourcing](/learn/system-design/event-sourcing).

The important thing here is that these are three separate decisions, not a ladder you must climb. Most production event-driven systems live at level 1 or 2 and never touch event sourcing.

---

## What you actually gain

**Decoupling of knowledge.** The producer's code contains no reference to any consumer. New consumers cost a subscription, not a deploy of the thing everyone depends on.

**Temporal decoupling.** Producer and consumer don't have to be up at the same time. The broker holds the event. This is what turns "the email service is down" from an incident into a backlog.

**Independent scaling.** Analytics can run twenty consumers and email can run two, sized to their own throughput rather than to the checkout path's.

**Load levelling.** A traffic spike lands in the broker's buffer instead of on the consumer's connection pool. The queue grows, latency grows, and nothing falls over.

**Resilience through isolation.** A crashing consumer stops one subscription. In the synchronous version it stopped checkout.

---

## What it genuinely costs

This is the half candidates skip, and it's the half that gets probed.

**Eventual consistency, everywhere.** The moment you publish instead of call, some part of your system is behind. The customer places an order and their order list doesn't show it for 200ms. That's not a bug you can fix; it's the design. It has to be handled in the UI, in your APIs, and in every consumer that makes a decision from a replica.

**Debugging without a stack trace.** A synchronous failure gives you one trace through six services. An event-driven failure gives you a message that was published, and silence. You need a correlation id stamped on every event and propagated through every consumer, plus distributed tracing, or you are reading six sets of logs by timestamp and guessing.

**No single place the flow lives.** Here's the thing Fowler warns about most, and it's real. "What happens when an order is placed?" has no answer in any file. It's spread across six subscribers in six repos, and the only way to know the current answer is to inspect the broker's subscription list. You've traded an explicit flow you could read for an implicit one you have to reconstruct.

**Ordering is only as good as your partitioning.** Brokers don't give you global order. Kafka's guarantee is per-partition: events with the same key go to the same partition, and a consumer reads that partition in exactly the order it was written. So `OrderPlaced` then `OrderCancelled` for the same order stay in order *if* you key by `order_id`. Key by something else, or spread one entity across partitions, and a consumer can process the cancellation first.

**Duplicates are normal, not exceptional.** Delivery is at-least-once. A consumer that crashes after doing its work but before acknowledging will see the message again. If that consumer charges a card, you just charged twice. Every consumer has to be idempotent — this is not optional, and it's why [Idempotency](/learn/system-design/idempotency) is the note that pairs with this one.

**Schema evolution across teams.** Once five services parse your event, its shape is a public API. Adding a field is fine if consumers ignore unknown fields. Removing or renaming one breaks people who are not in your standup.

<aside class="sd-callout sd-callout--warning">



The classic interview failure is drawing Kafka between two boxes and calling the design decoupled. The interviewer's follow-up is almost always "what happens if this consumer processes the same event twice?" or "how do you know the order of these two events?" Have an answer ready before you draw the arrow.

</aside>

---

## The dual-write problem

Now the part that most people miss, and that separates a real answer from a whiteboard one.

Look again at the handler that started all this:

```python
order = db.insert(order)                       # write 1: your database
broker.publish("orders", OrderPlaced(order))   # write 2: the broker
```

Those are **two different systems**, and there is no transaction spanning them. So walk through the crash.

**Crash between the two lines.** The order is committed and visible in your database. No event was ever published. No email, no stock reserved, no loyalty points — forever. Nothing in the system is even aware something is missing, because the order row looks completely normal.

**Flip the order — publish first, then insert.** Now the publish succeeds and the insert fails. Six consumers act on an order that does not exist. Inventory is reserved for nothing. A confirmation email goes out for an order the customer can't find.

**"Publish after the commit, and retry if it fails."** Retry where? The process that was going to retry is the one that died. And if the publish actually succeeded but the acknowledgement was lost, your retry publishes a duplicate.

**"Use a distributed transaction across the database and the broker."** In principle XA can do this. In practice it's a bad trade for exactly the reasons in [Avoiding Distributed Transactions](/learn/system-design/avoiding-distributed-transactions) — and most brokers, Kafka included, aren't XA participants at all. This door is mostly closed.

There's no clever ordering that fixes this. The problem is structural: you're trying to make two independent systems agree atomically.

---

## The fix: the transactional outbox

So stop writing to two systems. Write to one, twice.

Add a table in the *same database* as your business data, and write the event into it inside the same local transaction:

```sql
BEGIN;
  INSERT INTO orders (id, user_id, total_cents, status)
  VALUES ('ord_8812', 'u_41', 3998, 'PLACED');

  INSERT INTO outbox (id, aggregate_type, aggregate_id, type, payload)
  VALUES (gen_random_uuid(), 'order', 'ord_8812', 'OrderPlaced',
          '{"order_id":"ord_8812","total_cents":3998, ...}'::jsonb);
COMMIT;
```

One transaction, one database, ordinary ACID atomicity. The order and the intent to publish now commit or fail together. There is no window.

Then a separate process — the **message relay** — moves outbox rows to the broker. Two ways to build it:

**Polling publisher.** A loop does `SELECT * FROM outbox WHERE published_at IS NULL ORDER BY id LIMIT 100`, publishes each row, marks it published (or deletes it). Trivially easy to write and understand. It costs you a constant trickle of queries against your primary and a little latency from the poll interval.

**Transaction log tailing (CDC).** A connector like Debezium reads the database's own replication log and turns every insert into the outbox table into a broker message. No polling load, lower latency, and the application code doesn't change at all. It's more infrastructure to run, and it's the standard production answer. Debezium's outbox router expects roughly the columns above: `aggregatetype` selects the topic, `aggregateid` becomes the message key, `payload` is the body.

That `aggregate_id`-as-key detail is doing real work. Because it's the partition key, every event about `ord_8812` lands on the same partition, so consumers see that order's events in the order they were committed.

**What the outbox does not give you is exactly-once.** The relay can publish a row and crash before marking it done, and then publish it again. So you get at-least-once delivery, faithfully ordered per aggregate, and duplicates are your consumer's problem — which brings us back to [Idempotency](/learn/system-design/idempotency). The usual consumer-side mirror is an **inbox** table: record each processed event id in the same transaction as the work it caused, and skip ids you've already seen.

The one honest weakness is that it's a convention, not a mechanism. Nothing stops a new developer from writing to `orders` and forgetting the outbox row. Keep the write behind one repository method that always does both.

---

## Orchestration still exists

Events are great at "this happened, do whatever you like about it." They're worse at "these six steps must happen in order, and if step four fails we have to undo steps one through three."

When a business process has a *shape* — a sequence, a deadline, a rollback path — burying it in six subscribers means nobody can find it and nobody owns it. That's the moment to pull the flow back into something explicit: an orchestrator or a durable workflow engine that holds the state of the process and issues commands. See [Orchestration and Choreography](/learn/system-design/orchestration-and-choreography) for how to choose, and [Avoiding Distributed Transactions](/learn/system-design/avoiding-distributed-transactions) for the compensation mechanics.

Mixing the two is normal and correct. Orchestrate the transaction, broadcast events about what it did.

---

## Where this shows up

- **Order pipelines in e-commerce.** `OrderPlaced` fans out to fulfilment, fraud, email, analytics and recommendations, all of which were added years after checkout was written.
- **Kafka as a company-wide backbone.** Events are retained for days or weeks rather than deleted on consumption, so a new team can subscribe and replay history to bootstrap its own store.
- **AWS S3 → SNS/SQS → Lambda.** An upload publishes a fact; thumbnailers, virus scanners and indexers each subscribe. The uploader knows about none of them.
- **Change data capture pipelines.** Debezium turning row-level changes into events is event-driven architecture retrofitted onto a database that was never designed for it.

---

## In an interview

Bring it up when you see fan-out — one action that several unrelated subsystems care about — or when a non-critical dependency is sitting on a critical path.

Say what level you mean. "I'll publish a thin `OrderPlaced` and let consumers call back" and "I'll publish the full order state so consumers keep local replicas" are different designs with different failure modes, and naming which one you chose is a strong signal.

Volunteer the dual-write problem before you're asked. Describing the outbox unprompted is one of the highest-value thirty seconds available on this topic, because most candidates draw the arrow to Kafka and never notice the gap.

The most common mistake is claiming decoupling while designing a command. If exactly one consumer exists and its absence would be an incident, call it a command and move on.

---

## Seen in
- 05 - Matching and Real-Time Push — Kafka with commit-after-match, and why anything that must happen later needs a durable home
- 03 - Data Model and Sharding — CDC-derived read models, and the line between derived views and the correctness path
- 06 - Location Sharing and Completion — pub/sub fan-out replacing a directory lookup on the hot path

## Related
[Message Brokers](/learn/system-design/message-brokers) · [Publish-Subscribe](/learn/system-design/publish-subscribe) · [Message Queues](/learn/system-design/message-queues) · [Orchestration and Choreography](/learn/system-design/orchestration-and-choreography) · [Idempotency](/learn/system-design/idempotency) · [Event Sourcing](/learn/system-design/event-sourcing) · [CQRS](/learn/system-design/cqrs) · [Avoiding Distributed Transactions](/learn/system-design/avoiding-distributed-transactions) · [Monoliths and Microservices](/learn/system-design/monoliths-and-microservices)

## Sources
- [What do you mean by "Event-Driven"? — Martin Fowler](https://martinfowler.com/articles/201701-event-driven.html)
- [When to Use Event Driven Architecture in System Design Interviews — Hello Interview](https://www.hellointerview.com/blog/event-driven-architecture)
- [Pattern: Transactional outbox — microservices.io](https://microservices.io/patterns/data/transactional-outbox.html)
- [Outbox Event Router — Debezium documentation](https://debezium.io/documentation/reference/stable/transformations/outbox-event-router.html)
- [Apache Kafka introduction — partitions, keys and ordering](https://kafka.apache.org/intro)
