---
title: "Durable Execution and Sagas"
summary: "An order needs five steps: reserve stock, charge the card, book shipping, send the email, update loyalty points. Each step calls a different service. Something will fail halfway, and the worker running the sequence will sometimes die. Where does the \"what step am I on?\" live?"
stage: 7
stageName: "Async and messaging"
tier: "core"
seq: 56
tags: ["saga", "temporal", "workflow", "orchestration"]
---

An order needs five steps: reserve stock, charge the card, book shipping, send the email, update loyalty points. Each step calls a different service. Something will fail halfway, and the worker running the sequence will sometimes die. Where does the "what step am I on?" live?

If it lives in the worker's memory, a crash loses it, and you get a half-finished order with nobody responsible. This is a **multi-step process**, and the standard answers are a **saga** for the logic and **durable execution** for the machinery.

<figure class="sd-figure"><img src="/system-design/diagrams/durable-execution-and-sagas.svg" alt="Diagram: Durable Execution and Sagas" loading="lazy" decoding="async" /></figure>

---

## Why not a transaction?

Inside one database, `BEGIN ... COMMIT` makes the five steps atomic. Across five services and a payment provider there is no such thing. A bank won't hold a prepared transaction open for you, and **two-phase commit** puts a coordinator on the critical path, holds locks, and blocks everyone if it dies. → [Avoiding Distributed Transactions](/learn/system-design/avoiding-distributed-transactions)

A **saga** replaces atomicity with **compensation**: a sequence of local steps, each committing on its own, each with a compensating action that offsets it if a later step fails.

```
1. reserve stock      compensate: release stock
2. charge card        compensate: refund
3. book shipping      compensate: cancel booking
4. send email         compensate: none (you can't unsend)
```

Rules that make sagas work:

- **Compensation isn't rollback.** A refund is a real new transaction that appears on the customer's statement next to the charge. Both events happened.
- **Put the irreversible step last.** You can un-reserve stock, but not un-send an email.
- **Sagas have no isolation.** Between steps 2 and 3, the order is visibly half-done. The UI needs a word for it ("Processing").
- **Every step and every compensation must be idempotent**, because retries will repeat them. → [Idempotency](/learn/system-design/idempotency)

---

## Orchestration or choreography

**Choreography:** each service reacts to events and emits its own. No central controller. It's decoupled, and the overall flow is hard to see, test or change.

**Orchestration:** one **orchestrator** knows the whole flow, calls each step, tracks state and triggers compensations. The flow is explicit and observable. The orchestrator becomes a component you must keep highly available. → [Orchestration and Choreography](/learn/system-design/orchestration-and-choreography)

For flows with many steps, timeouts and retries, orchestration usually wins.

---

## Durable execution: workflow code that can't lose its place

Writing an orchestrator by hand means persisting state after every step, resuming after crashes, scheduling timers and retrying with backoff. Engines like **Temporal** (and AWS Step Functions, Azure Durable Functions) do that for you.

You write the workflow as ordinary code:

```python
def order_workflow(order):
    reserve(order)                      # activity
    try:
        charge(order)
        ship(order)
    except Failure:
        release(order)                  # compensation
        raise
    send_email(order)
```

The engine records **every step's result in a durable history**. If the worker dies mid-workflow, another worker replays the history to rebuild the exact position and continues. Completed steps aren't re-run; their recorded results are reused. Timers (`sleep(3 days)`) survive restarts, and retries follow a policy you declare (exponential backoff, maximum attempts).

Two rules the code must follow:

- **Workflow code must be deterministic** (no random numbers, no wall-clock reads, no direct I/O), because it's replayed. Side effects go in **activities**.
- **Activities must be idempotent**, because "ran but the acknowledgement was lost" means they may run again.

---

## When to reach for it

- **Long-running processes:** video transcoding DAGs, onboarding flows, payments, deployments, anything measured in minutes to days. → [Long-Running Tasks](/learn/system-design/long-running-tasks)
- **Anything with timers:** "cancel the order if unpaid in 30 minutes".
- **Human steps:** wait for an approval signal.
- **Fan-out and fan-in with retries:** a transcode of 1,500 segment tasks, then assemble.

You don't need it for a two-step flow that can be an outbox row and an idempotent consumer. A queue with retries plus a status column covers a lot.

---

## The write you must get right: the outbox

A common step is "update the database *and* publish an event". With two systems and no shared transaction, either order can leave them disagreeing. Write both in **one local transaction**: the state change and an `outbox` row. A relay publishes outbox rows to the broker at-least-once. → [Event-Driven Architecture](/learn/system-design/event-driven-architecture) · [Kafka](/learn/system-design/kafka)

```sql
BEGIN;
  UPDATE payments SET state='SUCCESS' WHERE id=? AND state='SENT';
  INSERT INTO outbox(topic, payload) VALUES ('payment.succeeded', ?);
COMMIT;
```

---

## In an interview

Say "saga with compensations, irreversible step last, every step idempotent", then whether you orchestrate (usually) and what stores the state (a durable workflow engine, or a state column plus a sweeper). Say what happens if the orchestrator dies: it resumes from durable history.

The trap is proposing two-phase commit across services, or a saga with no compensation for the step that can fail.

## Seen in
- YouTube — the transcoding DAG on a workflow engine, idempotent tasks by deterministic key
- Google Pay — the payment saga, reversal versus rollback, outbox
- BookMyShow — payment plus booking with a reconciler instead of 2PC
- Uber — a durable workflow for the "offer, wait, retry" matching loop
- Notification System — scheduled sends and retry topics
- Job Scheduler — durable timers and at-least-once execution
- Robinhood — order lifecycle across broker and exchange

## Related
[Avoiding Distributed Transactions](/learn/system-design/avoiding-distributed-transactions) · [Idempotency](/learn/system-design/idempotency) · [Orchestration and Choreography](/learn/system-design/orchestration-and-choreography) · [Event Sourcing](/learn/system-design/event-sourcing)
