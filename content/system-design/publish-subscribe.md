---
title: "Publish-Subscribe"
summary: "A queue exists so that one piece of work gets done by one machine. Publish-subscribe exists for the opposite situation: one thing happened, and several independent parts of the system each need to know about it."
stage: 7
stageName: "Async and messaging"
tier: "core"
seq: 48
tags: ["messaging", "pubsub", "fan-out", "decoupling"]
---

A queue exists so that one piece of work gets done by one machine. Publish-subscribe exists for the opposite situation: one thing happened, and several independent parts of the system each need to know about it.

The shift is small to draw and large in consequence. The producer stops naming who should be told and starts naming what occurred.

---

## Four teams want to know about the same ticket sale

You're running a ticketing site. When someone buys a seat, a single service handles the purchase and writes the row.

At first, one other thing needs to happen afterwards: send a confirmation email. You put a queue between them ([Message Queues](/learn/system-design/message-queues)), the purchase service enqueues, the email worker consumes, everyone's happy.

Then the requests start arriving.

The **fraud team** wants every purchase scored within a minute, so they can freeze suspicious accounts. The **inventory service** needs to invalidate its cached seat map for that event, so the next visitor doesn't see a sold seat as available. The **data team** wants every purchase landing in the warehouse for revenue reporting. And the **loyalty service** wants to credit points.

Four consumers. One event. Let's try the thing you'd try first.

---

## Attempt one: the producer enqueues to everybody

You give each team a queue and have the purchase service write to all of them.

```python
def complete_purchase(order):
    db.save(order)
    email_queue.send(order)
    fraud_queue.send(order)
    inventory_queue.send(order)
    analytics_queue.send(order)
    loyalty_queue.send(order)     # added last Thursday
```

This works. It genuinely works — messages arrive, each team scales its own consumers independently, nothing is lost.

It's the *maintenance* that rots. Every new consumer is a pull request against the purchase service, a code review from a team that doesn't care about loyalty points, and a deploy of your most business-critical write path. The purchase service now has five queue clients in its config and a list of every downstream team in its source code.

And that list is wrong within a quarter. Somebody deletes the loyalty service and forgets to remove the send, so a queue silently fills with millions of messages nobody reads. Somebody adds a sixth consumer and can't ship it until the purchase team finds room in their sprint.

**The producer knowing its consumers is the coupling.** The queue removed the *runtime* coupling — the purchase service no longer waits on the email service. It didn't remove the *design-time* coupling, because adding a consumer still means changing the producer.

---

## Attempt two: point all five consumers at one queue

So you make one `purchases` queue and have all five teams read from it. The purchase service does one send. Problem solved.

Run it for thirty seconds and look at what happened.

Order 1 went to the email worker. Order 2 went to the fraud scorer. Order 3 went to the analytics loader. Every message was delivered to exactly one consumer, which is precisely what a queue is *for* — competing consumers, work distributed, each job done once.

Except these five aren't competing. They're not five workers doing the same job. They're five different jobs that each need every message. One in five customers got an email. Four in five purchases were never scored for fraud. The seat map is wrong most of the time.

**A queue distributes work. It does not broadcast facts.** You need a primitive whose default is "everyone gets a copy," and a queue's default is the exact opposite.

---

## Topics and subscriptions

Publish-subscribe replaces the queue with a **topic** and gives every interested party its own **subscription** to it.

The producer publishes one message to the topic. The broker makes a copy for each subscription. Each subscription behaves like that team's private queue — its own backlog, its own acknowledgements, its own retry behaviour, its own dead-letter queue.

<figure class="sd-figure"><img src="/system-design/diagrams/publish-subscribe.svg" alt="Diagram: Publish-Subscribe" loading="lazy" decoding="async" /></figure>

Now add the loyalty service. The loyalty team creates a subscription. They deploy. They start receiving purchases.

Nobody touched the purchase service. No pull request, no review, no deploy of the critical write path. **That's the property people mean when they say pub/sub decouples producers from consumers, and it is a stronger statement than the one a queue supports.** A queue decouples them in time; a topic also decouples them in knowledge. The purchase service publishes `TicketPurchased` and genuinely does not know, and does not need to know, who is listening.

The message changes shape to match. With per-consumer queues you tend to write commands — `SendConfirmationEmail`, `ScoreForFraud` — because you know who's on the other end. With a topic you write facts — `TicketPurchased`, with the order id, the event id, the seat, the amount, the timestamp. Each subscriber decides for itself what that means. That reframing is the seed of [Event-Driven Architecture](/learn/system-design/event-driven-architecture).

---

## Consumer groups: fan-out between, fan-in within

There's an obvious objection. The email subscription still needs forty workers to keep up on a big on-sale. Did we just lose the competing-consumers property we liked about queues?

No — the two compose, and this is the mechanism that makes pub/sub practical at scale.

A subscriber isn't a machine. It's a **consumer group**: a named set of processes that collectively act as one logical subscriber. Inside a group, the broker distributes messages so each one goes to exactly one member — competing consumers, exactly as in a queue. Across groups, each group gets its own full copy of the stream.

<figure class="sd-figure"><img src="/system-design/diagrams/publish-subscribe-2.svg" alt="Diagram: Publish-Subscribe - 2" loading="lazy" decoding="async" /></figure>

Both groups see all nine messages. Neither group processes any message twice. Fan-out is *between* groups, fan-in is *within* one.

Kafka names this literally — a consumer group, with each partition assigned to exactly one member of the group. SNS gets there by fanning a topic out to several SQS queues, where each queue is the group and its consumers compete for it. Google Pub/Sub uses a subscription as the group, with multiple subscriber clients pulling from it.

Scaling a group has a ceiling worth knowing: in Kafka, a group can't usefully have more consumers than the topic has partitions, because a partition only ever goes to one member. Adding the thirteenth consumer to a twelve-partition topic gets you an idle process. [Message Brokers](/learn/system-design/message-brokers) has the partition and rebalance mechanics.

---

## What happens to a message with nobody listening

Now break the new design. The fraud service is down for two hours during a deploy gone wrong.

What happens to the 400,000 purchases published in those two hours depends entirely on a property people gloss over: whether the subscription is **durable** or **ephemeral**.

An **ephemeral** subscription only exists while the subscriber is connected. Redis Pub/Sub is the clearest example — the broker pushes each published message to whoever is connected right now and then forgets it. The docs are direct about the semantics: it is at-most-once, and "if the subscriber is unable to handle the message (for example, due to an error or a network disconnect) the message is forever lost." Two hours of fraud events simply never existed as far as Redis is concerned.

A **durable** subscription is a server-side object that outlives the subscriber. The broker keeps accumulating messages against it while nobody is connected, and when the fraud service comes back it works through the backlog. Kafka, SNS-to-SQS and Google Pub/Sub all behave this way.

Kafka is worth calling out because it achieves this differently, and the difference matters. Kafka doesn't copy the message per subscriber at all. There is one log, retained for a configured period — commonly seven days — and each consumer group stores an **offset**, a position in that log. Reading doesn't delete anything; the Kafka documentation states it plainly, that events "are not deleted after consumption." A group that was down for two hours just resumes from its old offset and catches up.

That also means a Kafka consumer group can move its offset *backwards* and re-read. Deploy a fixed fraud model and replay a week of purchases through it. No producer involved, no data re-sent. Ephemeral pub/sub cannot do this even in principle, and neither can a queue, because in both cases the message is gone once it's been handled.

<aside class="sd-callout sd-callout--warning">



Redis Pub/Sub looks like Kafka on a whiteboard and behaves nothing like it. If a message being lost during a subscriber restart is unacceptable, Redis Pub/Sub is the wrong tool and Redis Streams (or an actual durable broker) is the right one. Candidates lose real credibility by drawing "Redis pub/sub" under a requirement that says "must not lose events."

</aside>

The other thing durable subscriptions buy you is **isolation between subscribers**. Because each subscription has its own backlog and its own cursor, the analytics loader falling six hours behind has no effect whatsoever on how fast confirmation emails go out. With one shared queue, a slow consumer would have been everyone's problem.

---

## Filtering: not everyone wants everything

Your ticketing platform grows to forty event types on one topic — purchases, refunds, seat holds, price changes, venue updates. The loyalty service cares about two of them and is now paying to deserialise the other thirty-eight.

There are two ways out, and the choice is a real design decision.

**Topic per event type.** `purchases`, `refunds`, `seat-holds`. Subscribers subscribe only to what they want. Simple, and the topic name doubles as documentation. It stops being simple at a few hundred topics, and it makes "give me everything about this order" require subscribing to a dozen places.

**One topic, server-side filtering.** The subscriber declares a predicate and the broker only delivers matching messages. SNS does this with a JSON **filter policy** on the subscription, evaluated against either the message attributes or the message body, and a subscription with no policy receives everything by default. Google Pub/Sub has an equivalent filter expression. RabbitMQ's topic exchanges take it furthest, with routing-key patterns like `purchase.eu.*` matched against bindings — that's exchange machinery, and it lives in [Message Brokers](/learn/system-design/message-brokers).

The important asymmetry: **Kafka has no server-side filtering.** A consumer reads the whole partition and discards what it doesn't want. That's a deliberate design choice — the broker does almost nothing per-message so it can do a great many messages — but it means Kafka pushes you toward topic-per-type, and toward fewer, coarser topics with filtering in a stream processor.

---

## So which one do you want?

Here's the whole comparison, now that you've seen both fail in the ways they fail.

| | Queue | Topic (pub/sub) |
|---|---|---|
| Who gets a message | exactly one consumer | every subscription gets a copy |
| Producer knows the consumer | yes — it names the queue | no — it names the event |
| Adding a consumer | changes the producer | changes nothing |
| Message shape | usually a command (*do this*) | usually a fact (*this happened*) |
| Adding machines | more throughput | more copies, unless they share a group |
| Typical failure | slow consumer backs up shared work | nobody notices a subscriber died |

Reach for a queue when the message is a job that one worker should do: transcode this video, charge this card, generate this invoice. Reach for a topic when the message is a fact that several parties interpret differently: this ticket was sold, this user signed up, this price changed.

Two reflexes are worth building. If you're about to add a second consumer to a queue for a *different* purpose, you want a topic. And if every subscriber to a topic is doing the same job, you wanted a queue.

The compromise nearly everyone lands on in practice is the hybrid: publish to a topic, and give each subscriber a durable queue behind it. SNS-to-SQS is exactly this shape. You get fan-out from the topic and per-consumer buffering, acknowledgements, retries and dead-letter queues from the queue — all the reliability machinery from [Message Queues](/learn/system-design/message-queues), applied per subscriber.

---

## What pub/sub costs you

Nothing comes free, and interviewers will go looking for these.

**Nobody knows who's listening.** That's the feature, and it's also why changing an event's schema is frightening. Adding an optional field is safe; renaming one breaks consumers you've never met. Teams that run on events end up with a schema registry and a compatibility policy, because the alternative is finding out in production.

**Debugging spans everybody.** "Why didn't this customer get their points?" now means checking the publish, the subscription, that subscription's backlog, and the loyalty consumer — four systems owned by three teams. Correlation ids on every message are not optional.

**Ordering is per-partition at best**, the same as for queues, and fan-out makes it worse: two subscribers can process the same two events in opposite orders because they're independent. Anything order-sensitive needs a key, and needs each consumer to tolerate out-of-order arrival.

**Duplicates are still duplicates.** Every durable pub/sub system is at-least-once by default. Each subscriber needs to be idempotent on its own — [Idempotency](/learn/system-design/idempotency) applies per subscription, not once globally.

---

## Where this shows up

- **A user signs up** and six things must happen: welcome email, CRM record, trial provisioning, analytics, fraud baseline, referral credit. One `UserSignedUp` topic, six subscriptions, no coupling.
- **Cache invalidation.** A write publishes the key that changed; every app server subscribes and evicts locally. This is the classic Redis Pub/Sub use case, and it's correct precisely because a missed invalidation is survivable ([Caching Strategies](/learn/system-design/caching-strategies)).
- **Feeding a read model.** The write side publishes events; a projector subscribes and maintains a denormalised query store — the plumbing under [CQRS](/learn/system-design/cqrs).
- **Change data capture.** Debezium reads the database's replication log and publishes row changes to Kafka topics, letting search indexes, caches and warehouses all subscribe to the same stream of truth.

---

## In an interview

Introduce a topic the moment a second, *different* consumer appears for the same event. Naming that transition — "two consumers with different jobs, so this becomes a topic rather than a queue" — is most of the point.

Be ready for "what if a subscriber is down for an hour?" That's the durable-versus-ephemeral question, and the answer is a durable subscription with its own backlog, or a retained log with a per-group offset.

The most common mistake is drawing one queue with several different services reading from it. That's not fan-out, it's accidental load balancing across services that each needed the full stream.

The second most common is proposing Kafka for everything. Kafka is superb when you want retention and replay. If you want per-message retries, priorities and a dead-letter queue, a queue-based broker is less work and less operational risk.

---

## Seen in
- 06 - Location Sharing and Completion — two servers subscribe to a per-ride topic so neither has to look up where the other one is, trading a directory read for a broker hop

---

## Related
[Message Queues](/learn/system-design/message-queues) · [Message Brokers](/learn/system-design/message-brokers) · [Orchestration and Choreography](/learn/system-design/orchestration-and-choreography) · [Event-Driven Architecture](/learn/system-design/event-driven-architecture) · [CQRS](/learn/system-design/cqrs) · [Rate Limiting](/learn/system-design/rate-limiting) · [Idempotency](/learn/system-design/idempotency) · [Caching Strategies](/learn/system-design/caching-strategies) · [Real-Time Server Push](/learn/system-design/real-time-server-push)

## Sources
- [Redis Pub/Sub — delivery semantics and pattern subscriptions](https://redis.io/docs/latest/develop/pubsub/)
- [Amazon SNS message filtering](https://docs.aws.amazon.com/sns/latest/dg/sns-message-filtering.html)
- [Apache Kafka — introduction (topics, partitions, retention)](https://kafka.apache.org/intro)
- [Google Cloud Pub/Sub — subscription types](https://cloud.google.com/pubsub/docs/subscriber)
- [Hello Interview — Kafka deep dive](https://www.hellointerview.com/learn/system-design/deep-dives/kafka)
