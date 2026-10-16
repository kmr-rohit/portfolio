---
title: "Orchestration and Choreography"
summary: "Once work is spread across services, something has to make sure a multi-step process actually finishes — all of it, in order, even when step three fails at 3am."
stage: 7
stageName: "Async and messaging"
tier: "core"
seq: 52
tags: ["workflows", "saga", "durable-execution", "microservices"]
---

Once work is spread across services, something has to make sure a multi-step process actually finishes — all of it, in order, even when step three fails at 3am.

There are exactly two ways to arrange that. Put one component in charge of the sequence, or let each service react to what the previous one did. The choice sounds stylistic. It isn't: it determines whether you can answer "what's the status of order 5512?" without reading four services' logs.

---

## A booking that's really four bookings

You're building a travel site. A customer books a trip, and behind that one button four separate things must happen, each against a different service with its own database:

1. Reserve the flight seat
2. Reserve the hotel room
3. Reserve the rental car
4. Charge the card

You start where everyone starts. One `BookingService` calls the other four in order, in one request handler:

```python
def book_trip(req):
    flight = flight_svc.reserve(req.flight)
    try:
        hotel = hotel_svc.reserve(req.hotel)
        try:
            car = car_svc.reserve(req.car)
            payment_svc.charge(req.card, total)
        except:
            car_svc.cancel(car); hotel_svc.cancel(hotel); flight_svc.cancel(flight)
            raise
    except:
        flight_svc.cancel(flight)
        raise
```

The nesting is ugly but the logic is right, and it works in testing. Then it meets production.

**The hotel service is slow one evening** and the request times out at 30 seconds. Your handler doesn't know whether the reservation happened. Cancel and you might cancel nothing, or you might cancel a real reservation you never told the customer about.

**The pod gets rescheduled between step 2 and step 3.** There is no `except` block any more, because there's no process. A flight and a hotel are reserved, the customer sees an error, and nothing anywhere knows those reservations need undoing. They sit there until someone notices in a reconciliation report next Tuesday.

**And you can't fix this with a transaction.** Four services, four databases, one of them a third-party vendor API. There's no `BEGIN` that spans them, and two-phase commit across vendor APIs isn't a thing you can build — see [Avoiding Distributed Transactions](/learn/system-design/avoiding-distributed-transactions) for why 2PC is the wrong hammer even when it is technically available.

The real requirement underneath all three failures is the same: **the process has to outlive the process.** The sequence of steps needs a durable existence somewhere, independent of whichever box happens to be running it.

---

## Choreography: nobody's in charge, everyone reacts

The first answer is to stop calling and start announcing. The booking service publishes a fact to a topic and returns. Each downstream service subscribes, does its bit, and publishes its own fact.

Follow the chain down. Each service only knows the event it listens for and the event it emits.

<figure class="sd-figure"><img src="/system-design/diagrams/orchestration-and-choreography-3.svg" alt="Diagram: Orchestration and Choreography - 3" loading="lazy" decoding="async" /></figure>

No service calls another. Each one subscribes to a topic, acts, and publishes. The [broker](/learn/system-design/message-brokers) holds every message durably, so a crashed hotel service means the message is redelivered when it comes back — not that the trip is lost ([Publish-Subscribe](/learn/system-design/publish-subscribe)).

This is genuinely good, and the benefits are real. Teams deploy independently. Adding a step — say a loyalty service that awards points once payment clears — means subscribing to `Charged` and touching nothing else. There is no central component to become a bottleneck, no shared codebase, no cross-team release train. It's [Event-Driven Architecture](/learn/system-design/event-driven-architecture) in its purest form.

Run it for six months and three specific problems show up.

**Where is booking 5512?** A customer calls. There's no place to look. The booking's state doesn't exist as a thing — it's implied by which events have been published so far, scattered across four services' logs and a broker's topics. Answering the question means correlating by booking id across four systems owned by three teams. Every incident starts with twenty minutes of archaeology.

**The workflow exists in no file.** Nobody wrote down "flight, then hotel, then car, then charge." That sequence is an emergent property of who happens to subscribe to what. To learn the order of steps you read four repositories' subscription configs and draw it yourself. Onboarding an engineer onto this is genuinely hard, and reordering steps means coordinated changes in two services.

**Failure handling re-couples everything.** This is the fatal one. The car service fails — no cars left. The flight and hotel are already reserved and must be released. Who does that?

Somebody has to publish `CarReservationFailed`, and the flight service and hotel service each have to subscribe to it and cancel. So the flight service now contains code that knows cars exist. Add a fifth step and every earlier service needs a subscription to its failure event. The clean one-way flow you drew turns into a mesh, and the decoupling you bought choreography for quietly evaporates — in exactly the part of the system that's hardest to test.

There's a fourth problem that's easy to miss. **Nobody is watching the clock.** If the car service simply never responds — didn't fail, didn't succeed, the message got stuck in a DLQ — the booking sits half-complete forever. No component's job is to notice. Timeouts need an owner, and choreography doesn't have one.

---

## Orchestration: one component owns the sequence

So you put the sequence back in one place, but as a first-class, long-lived thing rather than a request handler.

An **orchestrator** owns the workflow. It sends commands to services and waits for replies. Services stay dumb: they expose `reserve` and `cancel` and know nothing about trips.

<figure class="sd-figure"><img src="/system-design/diagrams/orchestration-and-choreography.svg" alt="Diagram: Orchestration and Choreography" loading="lazy" decoding="async" /></figure>

Look at what this recovers.

**State lives in one place.** "Where is booking 5512?" is one query against the orchestrator. It says `AwaitingCarReservation, since 14:02`. Support can answer the phone. You can build a dashboard of workflows stuck in each step, which is the single most useful operational artefact in a system like this.

**The workflow is readable.** It's a sequence in one file, in order, that an engineer can read top to bottom. Changing the order is a one-file change.

**Failure handling stops being a mesh.** The car reservation failed, so the orchestrator — which already knows exactly what succeeded — calls `hotel.cancel` and `flight.cancel`. The flight service still doesn't know cars exist. Compensation logic sits with the only component that has the whole picture.

**Timeouts have an owner.** The orchestrator set the deadline, so the orchestrator notices when it passes.

The costs are equally real, and an interviewer will want both. Every new step is a change to the orchestrator, which means a shared component several teams need to modify — the coordination you removed from the code comes back as coordination between teams. Services become anaemic, holding data with the business logic pulled up into the orchestrator. And there's now one component whose failure stalls every in-flight booking.

That last one deserves its own section, because the naive orchestrator fails in a specific and instructive way.

---

## Why your orchestrator is a single point of failure

Here's a plausible first implementation of "wait 10 minutes for the vendor to confirm, then give up and compensate":

```python
def run(booking):
    flight = call(flight_svc.reserve, booking.flight)
    hotel  = call(hotel_svc.reserve, booking.hotel)
    time.sleep(600)                          # wait for vendor confirmation
    if not vendor_confirmed(hotel):
        call(hotel_svc.cancel, hotel)
        call(flight_svc.cancel, flight)
```

This is the same bug as the `try/except` you started with, dressed up. The orchestrator's knowledge of where booking 5512 has got to lives in local variables on one machine, and the timer lives in that machine's scheduler.

Kill the box at minute four. `flight` and `hotel` are gone. The timer is gone. Nothing will ever fire, nothing will ever compensate, and no error is logged anywhere because from the process's point of view nothing failed — the process simply ceased. You've built a centralised coordinator with all the coupling costs and none of the durability benefit.

<aside class="sd-callout sd-callout--warning">



**An in-memory timer is a single point of failure wearing a disguise.** It never raises an exception, never appears in an error budget, and never shows up in a load test. Anything that has to happen *later* needs a durable home: a row a sweeper can find, a delayed message on a broker, or a workflow engine that persists its timers. "We'll retry in 30 seconds" is only true if the intention to retry survives the process that formed it.

</aside>

The fix people reach for first is to persist the state: write `booking_state` to a table after every step, and run a sweeper that polls for workflows stuck past their deadline and resumes them. This is correct, and plenty of solid systems do exactly this. It's also a surprising amount of code — a state machine, a deadline index, a sweeper with its own leader election, retry counts, a poison-workflow quarantine. You end up building an orchestration engine the same way the photo site in [Message Brokers](/learn/system-design/message-brokers) ends up building a broker.

---

## Durable execution: the modern answer

Durable execution engines — Temporal, its ancestor Cadence, AWS Step Functions — take that state machine and make it the platform's problem, so you can write the workflow as ordinary sequential code and have it survive anything.

The trick is worth understanding, because "it's magic" is not a Staff-level answer. The engine records **every step of the workflow as an event in a durable event history**. When the process running your workflow dies, another worker picks it up and **replays** the history from the start: it re-executes your workflow function, but instead of actually calling the flight service again, it feeds the recorded result from history straight back. Replay races through the work already done and then continues from exactly where the crash happened, with all your local variables reconstructed.

That's why workflow code must be **deterministic**. The same history must produce the same sequence of decisions on replay, so `random()`, `datetime.now()` and direct network calls are forbidden inside the workflow body — the engine provides deterministic substitutes. Real side effects go into **activities**: ordinary functions that talk to the outside world, whose results are recorded in history, and which the platform retries on their own configurable policy.

Timers are recorded as events too, so they're durable. `await sleep(timedelta(days=30))` is a legitimate thing to write. No thread is blocked for a month; the engine simply has an event that says "wake this workflow on the 14th," and it fires whether or not any particular machine survives until then. That single capability replaces an enormous amount of cron-and-sweeper code.

Step Functions expresses the same idea as a JSON state machine with `Retry` and `Catch` clauses on each state, and gives you a visual execution history you can click through — genuinely the fastest way to debug a stuck workflow. The durability numbers are the pitch: Standard workflows run for up to **one year** with exactly-once workflow execution, at 2,000 executions/second; Express workflows run for up to **five minutes** with at-least-once execution, at 100,000/second. The "exactly-once" there is about the workflow's own steps, not about your activity's side effects — an activity that calls Stripe still needs [Idempotency](/learn/system-design/idempotency).

Two neighbours worth naming so you don't misuse them. **Airflow** orchestrates scheduled DAGs — it's built for data pipelines that run nightly, not for a workflow started per customer request. **Camunda** and other BPMN engines orchestrate long-running business processes with human approval steps, and shine when non-engineers need to read and change the process diagram.

---

## Sagas and compensating transactions

Both styles above are implementations of one pattern, and it's worth naming it precisely because interviewers use the word.

A **saga** is a sequence of local transactions, each committing in its own service's database, with a **compensating transaction** defined for each step that can undo it. There's no distributed commit and no global rollback. If step 4 fails, you run the compensations for steps 3, 2 and 1 in reverse.

<figure class="sd-figure"><img src="/system-design/diagrams/orchestration-and-choreography-2.svg" alt="Diagram: Orchestration and Choreography - 2" loading="lazy" decoding="async" /></figure>

A compensation is not a rollback, and the difference matters. A rollback erases history; a compensation is a *new* transaction that semantically undoes the old one. You can't un-charge a card — you issue a refund, and both the charge and the refund are permanently visible. You can't un-send an email — you send a correction. Designing a workflow means designing these undos deliberately, and some steps genuinely have no undo, which is why irreversible steps belong last.

Choreography-based sagas have each service publish events that trigger the next local transaction, including the failure events that trigger compensations. Orchestration-based sagas have a coordinator issue the commands and, on failure, issue the compensations. Same pattern, different distribution of knowledge, and everything in the two sections above applies.

The honest weakness of sagas is **isolation**, the I that ACID gives you and sagas don't. Between step 1 and step 4, other transactions can see a half-finished saga: the flight is reserved but unpaid. Another booking flow reads that seat as taken, or a report counts revenue that's about to be compensated away. There's no serialisability here.

The usual countermeasures are worth knowing by name. A **semantic lock** marks the record with an in-progress status (`PENDING_PAYMENT`) so other readers know not to trust it yet. **Commutative updates** — using increment/decrement rather than absolute writes — make the order of concurrent operations stop mattering. **Re-reading the value before committing** catches the case where something changed underneath you, which is the conditional-write technique from [Avoiding Distributed Transactions](/learn/system-design/avoiding-distributed-transactions).

And every compensation must itself be idempotent and retryable, because the thing that runs compensations is exactly the thing that just proved it can crash.

---

## Choosing between them

| | Choreography | Orchestration |
|---|---|---|
| Who knows the sequence | nobody — it's emergent | one component, in one file |
| "Where is order 5512?" | correlate logs across N services | one query |
| Adding a step | subscribe to an event; no other change | change the orchestrator |
| Failure and compensation | failure events couple services back together | coordinator runs compensations; services stay dumb |
| Timeouts | no owner | the coordinator's job |
| Team coupling | low | moderate — shared component |
| Fails by | becoming impossible to reason about | becoming a bottleneck and a god object |

The practical rule most teams land on: **choreography for broadcasting facts, orchestration for driving a process.** Two or three steps that don't need undoing, where the downstream services are genuinely independent, are fine as events. A five-step business transaction with money in it, compensations, deadlines and a support team who'll be asked about it wants a coordinator — and, once it has one, wants that coordinator's state to be durable.

Most real systems are both. The order pipeline is orchestrated; the `OrderCompleted` fact it emits at the end is choreographed to eight subscribers who don't participate in the process at all.

<aside class="sd-callout sd-callout--tip">



A strong interview move is to name the seam. "I'll orchestrate the payment-and-fulfilment saga with a durable workflow, because it needs compensation and a deadline. Everything downstream of `OrderCompleted` — email, analytics, loyalty — is fan-out on a topic, because those don't affect the outcome and shouldn't be able to fail it."

</aside>

---

## Where this shows up

- **Checkout and fulfilment pipelines.** Charge, reserve stock, allocate a warehouse, create a label, notify. Compensations are refunds and stock releases, and the whole thing needs a status page.
- **Account provisioning in B2B SaaS.** Create tenant, provision a database, set up billing, seed data, invite users. Minutes to hours long, with partial-failure cleanup — a natural durable workflow.
- **Anything with a human in the loop.** Approvals and KYC reviews mean workflows that sleep for days. Step Functions' task-token callback and Temporal's signals are built for this.
- **Data pipelines.** Airflow DAGs orchestrating extract-transform-load steps on a schedule, with retries and backfills per task.

---

## In an interview

Introduce this the moment a design has a multi-step process that spans services and can fail in the middle. Say the words "saga" and "compensating transaction" — they're the vocabulary the question is testing.

Expect "what if the coordinator crashes halfway through?" That's the whole question. The answer is that state and timers are durable — a persisted state machine a sweeper can resume, or a workflow engine with an event history and replay. Naming Temporal or Step Functions here is cheap and lands well.

Expect "why not just use a distributed transaction?" Point at coordinator blocking and locks held across the network, then move on — [Avoiding Distributed Transactions](/learn/system-design/avoiding-distributed-transactions) is the fuller argument.

The most common mistake is a coordinator holding progress in memory with a `sleep` for the timeout. The second is choosing choreography for a process with compensations, then discovering that every service needs to subscribe to every other service's failure events.

---

## Seen in
- 02 - Ride Request Flow — a two-step saga deliberately ordered so the compensation is a no-op, which is the cheapest saga there is
- 05 - Matching and Real-Time Push — the offer timeout as a durable workflow rather than an in-memory timer, so the state survives the server that created it

---

## Related
[Message Queues](/learn/system-design/message-queues) · [Publish-Subscribe](/learn/system-design/publish-subscribe) · [Message Brokers](/learn/system-design/message-brokers) · [Event-Driven Architecture](/learn/system-design/event-driven-architecture) · [CQRS](/learn/system-design/cqrs) · [Avoiding Distributed Transactions](/learn/system-design/avoiding-distributed-transactions) · [Idempotency](/learn/system-design/idempotency) · [Rate Limiting](/learn/system-design/rate-limiting) · [Circuit Breakers](/learn/system-design/circuit-breakers) · [TTL as a Coordination Primitive](/learn/system-design/ttl-as-a-coordination-primitive)

## Sources
- [microservices.io — Saga pattern (choreography vs orchestration, compensating transactions)](https://microservices.io/patterns/data/saga.html)
- [Temporal — Understanding Temporal (durable execution, event history, replay, determinism)](https://docs.temporal.io/evaluate/understanding-temporal)
- [AWS Step Functions — What is Step Functions? (Standard vs Express, retry and catch, callbacks)](https://docs.aws.amazon.com/step-functions/latest/dg/welcome.html)
