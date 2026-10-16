---
title: "Event Sourcing"
summary: "Almost every database you've used stores the current state of things. Event sourcing stores the sequence of changes instead, and treats current state as something you compute."
stage: 7
stageName: "Async and messaging"
tier: "core"
seq: 54
tags: ["event-sourcing", "audit", "projections", "data-modeling"]
---

Almost every database you've used stores the *current* state of things. Event sourcing stores the sequence of changes instead, and treats current state as something you compute.

That sounds like a small bookkeeping difference. It isn't — it changes how you write, how you read, how you deploy, and what you can promise a regulator. It's powerful and it's frequently the wrong choice, and knowing both halves is the point of this note.

---

## A balance that can't explain itself

You're building the account ledger for a payments product. The obvious schema:

```sql
CREATE TABLE accounts (
  id            TEXT PRIMARY KEY,
  balance_cents BIGINT NOT NULL
);

UPDATE accounts SET balance_cents = balance_cents - 1500 WHERE id = 'acc_7';
```

This is fast, it's familiar, and every tool you own understands it. For a shopping cart it would be the end of the story.

Then support forwards you a ticket: *"Why is my balance &#36;1,385? I think you charged me twice."*

You open the row. It says `138500`. That is the only thing your database knows. Not how it got there, not what the previous value was, not which of the eleven things that touched this account last month was the duplicate. The `UPDATE` didn't just change the balance — **it destroyed the information about why**.

It gets worse. A bug shipped last Tuesday charged an overdraft fee twice for accounts in one region. You've fixed the code. Now: which accounts were affected, and by how much? You can't answer that from a table of current balances. The evidence was overwritten.

---

## The obvious fix, and why it isn't enough

Add an audit table. Write to both.

```sql
BEGIN;
  UPDATE accounts SET balance_cents = balance_cents - 1500 WHERE id = 'acc_7';
  INSERT INTO account_audit (account_id, delta_cents, reason, at)
       VALUES ('acc_7', -1500, 'overdraft_fee', now());
COMMIT;
```

Same database, one transaction, so at least they can't disagree because of a crash. This is a real improvement and plenty of systems stop here, correctly.

But the audit log is a **second-class citizen**, and second-class citizens rot.

Six months in, somebody runs a one-off correction script against `accounts` during an incident and doesn't write an audit row. A new endpoint ships with the `INSERT` forgotten. A backfill migration adjusts balances in bulk. Every one of those is invisible, and now your audit log and your balances disagree with no way to tell which is lying — because the balance is authoritative and the log is just commentary.

There's a subtler loss too. The audit row says the balance changed by `-1500`. It doesn't say *what happened*. `-1500` could be a fee, a transfer out, a reversal, a chargeback. You recorded the effect and threw away the intent, which is exactly the part support needed.

**So invert it. Make the log the thing that's true, and make the balance the commentary.**

---

## The event log as source of truth

Every change to the account is recorded as an immutable, past-tense fact, appended to that account's own stream. Nothing is ever updated in place, because facts about the past don't change.

```
stream: account-acc_7
  v1  AccountOpened      { owner: "u_41", currency: "USD" }
  v2  Deposited          { amount_cents:  50000, source: "ach_881" }
  v3  Deposited          { amount_cents: 120000, source: "ach_902" }
  v4  Withdrew           { amount_cents:  30000, to: "ext_acct_12" }
  v5  OverdraftFeeCharged{ amount_cents:   1500, rule: "OD-2" }
```

The balance isn't stored anywhere. It's a fold over the stream:

```python
def rehydrate(events):
    balance = 0
    for e in events:
        if   e.type == "Deposited":            balance += e.amount_cents
        elif e.type == "Withdrew":             balance -= e.amount_cents
        elif e.type == "OverdraftFeeCharged":  balance -= e.amount_cents
    return balance
# 50000 + 120000 - 30000 - 1500  =  138500
```

Now answer the support ticket: read the stream and hand it to them. Answer "which accounts got the double fee": scan for accounts with two `OverdraftFeeCharged` events with rule `OD-2` in that window, and compute the exact correction for each. Both questions became easy, and they became easy for the same reason — nothing was ever overwritten.

**The design rule that makes or breaks this is: record intent, not the resulting value.** `SeatsReserved &#123; count: 2 &#125;` is worth having. `RemainingSeats &#123; value: 42 &#125;` is a change log with the meaning stripped out — it tells you what the number became, not what someone did. Write the second kind and you've paid the full price of event sourcing for almost none of the benefit.

---

## Concurrency comes out for free

Two requests try to withdraw from `acc_7` at the same moment. In the `UPDATE` world you'd reach for a row lock or a `WHERE balance >= :amount` guard.

Here, each handler loads the stream, sees it ends at version 5, checks the business rule, and appends conditionally:

```python
events  = store.read("account-acc_7")          # ends at v5
balance = rehydrate(events)                    # 138500
if balance < amount: raise InsufficientFunds()
store.append("account-acc_7", Withdrew(amount), expected_version=5)
```

The first append succeeds and the stream is now at v6. The second one fails, because the store refuses to append at an expected version that no longer matches. That handler re-reads, re-evaluates against the new balance, and retries or rejects.

This is optimistic concurrency control on a single stream, and it's the same shape as the conditional write in [Avoiding Distributed Transactions](/learn/system-design/avoiding-distributed-transactions). It also means writes are pure appends — no read-modify-write, no row-level lock contention on a hot entity.

---

## Breaking it: replay gets slow

Five years in, `acc_7` has forty thousand events. Every request that touches this account replays forty thousand events to find out the balance. Your p99 is a disaster and it gets worse every day the account stays open.

The fix is **snapshots**. Every N events, persist the rehydrated state alongside the stream:

```
snapshot(account-acc_7, v39000) = { balance_cents: 902300, status: "open" }
```

To rehydrate, load the most recent snapshot and replay only what came after it — forty thousand events becomes a load plus a few hundred.

The thing to hold onto is that **a snapshot is a cache, not a record**. The stream is still the truth. You can delete every snapshot you have and regenerate them, and nothing is lost. Choosing N is the usual trade: more snapshots means more storage and faster rehydration.

---

## Breaking it again: you can't query anything

Here's the one that actually hurts.

Your risk team asks for every account that's been overdrawn in the last 30 days. In the old schema that's `SELECT id FROM accounts WHERE balance_cents &lt; 0` and you're done before lunch.

In an event-sourced store there is no `accounts` table to query. The only read the store really supports is *"give me the events for this entity id."* Answering the risk team's question means replaying every stream in the system.

So you build a **projection**: a process that subscribes to the event stream and maintains an ordinary table, shaped for that exact question.

One log feeds as many read models as you need. Each one is shaped for a single kind of question.

<figure class="sd-figure"><img src="/system-design/diagrams/event-sourcing.svg" alt="Diagram: Event Sourcing" loading="lazy" decoding="async" /></figure>

`account_balances` is a plain SQL table with plain indexes. Query it normally. It is a **read model derived from the log**, which is precisely the read side of [CQRS](/learn/system-design/cqrs) — this is why the two patterns show up together so often.

And this is where event sourcing pays you back in a way nothing else does. **Projections are disposable.** Six months from now, product wants a view of average daily balance by customer tier, and nobody thought to collect it. Write a new projector, point it at the beginning of the log, let it run. The data was always there; you just hadn't asked yet. Find a bug in a projection? Drop the table, replay, done — because the bug was in derived data, and derived data can be rebuilt.

Try either of those against a schema that only ever stored the current balance.

---

## What it buys you

**An audit trail that is the system, not a bolt-on.** It can't drift from the truth, because it *is* the truth. For payments, healthcare and anything a regulator reads, that's not a nice-to-have.

**Temporal queries.** "What was this balance on March 1st?" is a fold over events up to that timestamp. Ordinary databases can't answer this at all unless someone planned for it.

**Replay as a debugging and migration tool.** Fix a projection bug, rebuild. Build a view you didn't know you needed. Reproduce a production incident exactly, because you have the precise input sequence.

**Intent preserved.** `Moved home`, `Closed account`, `Deceased` are all "the address column changed" in a CRUD schema. Domain experts can read an event stream; they can't read a table of current values and reconstruct what happened.

**Write throughput on hot entities.** Appends don't contend the way update-in-place does.

---

## What it genuinely costs

**Old events are permanent, so schema changes are permanent too.** In a normal database you write a migration and every row is now in the new shape. You can't do that here — rewriting history destroys the audit trail that was the whole reason you're here. So a five-year-old `Deposited` event with a field you renamed still has to be readable by today's code, forever.

| Strategy | What you do | Cost |
|---|---|---|
| Tolerant reader | Ignore unknown fields, default missing ones | Only handles additive changes |
| Event versioning | Stamp a version, branch on it in the handler | Handler grows a branch per version, forever |
| Upcasting | Transform old shapes to current on read | Chain of transforms to maintain and test |
| In-place migration | Rewrite stored events | Breaks immutability — last resort |

**Projections are eventually consistent.** The write commits, the projector catches up a moment later. A user who submits a transfer and immediately loads their balance can see the old number. Every UI touching event-sourced data has to be designed for this.

**No ad-hoc queries.** Every question needs a projection built in advance, which means the cost of a new question is a deploy, not a `SELECT`. Your analysts, your ops team and your on-call all lose the ability to just poke the database.

**Replay has side effects unless you stop it.** Rebuilding a projection replays `PaymentCaptured` — and if the handler sends a receipt email or calls a payment API, you've just emailed ten thousand customers about transactions from 2021. Every external interaction needs to go through a gateway that knows when it's in replay mode and suppresses the call. This bites people in production and it's an excellent thing to raise unprompted.

**Bad events are immortal.** Ship a bug that writes wrong events and fixing the code doesn't fix history. You correct it with a **compensating event** — a new fact that reverses the old one — which is honest and auditable, and also means your stream now contains a permanent record of your mistake.

**Deleting personal data is genuinely hard.** An append-only, immutable store is close to the opposite of what a right-to-erasure request requires. You can't delete one event without punching a hole in the stream that versioning and rehydration depend on. Two workable approaches: keep personal data *outside* the event store and reference it by id, so deletion happens in an ordinary table; or use **crypto-shredding** — encrypt personal fields with a per-subject key, and delete the key, which leaves the event structurally intact and permanently unreadable. Both need to be designed in from day one. Neither is something you retrofit under a 30-day deadline.

<aside class="sd-callout sd-callout--warning">



"It's immutable and auditable" is the easy half of the answer. If you propose event sourcing for anything holding user data and don't mention deletion, expect the interviewer to go straight there. Crypto-shredding or externalised PII — pick one and say why.

</aside>

---

## Be honest: it's usually the wrong choice

Microsoft's own pattern documentation opens with a warning rather than a pitch, and it's worth repeating: event sourcing changes how you store data, handle concurrency, evolve schemas and query state; it's expensive to migrate to *and* expensive to migrate away from; and for most systems, traditional data management is sufficient.

Reach for it when the history is the product: a ledger, a payments flow, a trading book, a medical record, anything where "how did we get here" is a question someone will be legally required to answer. Reach for it when you need temporal queries or replay-driven view building as a first-class capability.

Don't reach for it for user profiles, catalogues, configuration, or CRUD screens. Don't reach for it on a team that hasn't run an event-driven system before — the failure mode isn't that it doesn't work, it's that it works until the first schema change and then consumes the roadmap.

And it isn't all-or-nothing. Event-source the payment ledger; leave the settings page as a boring table.

<aside class="sd-callout sd-callout--note">



An event store is not a message broker. Kafka is excellent at fanning events out to consumers, but it has no per-entity stream read and no optimistic append-on-expected-version, which are the two things the write path here depends on. Use a purpose-built event store (or an append-only table in Postgres) as the system of record, and a broker as the distribution layer.

</aside>

---

## Where this shows up

- **Git.** A repository is an append-only log of commits; a working tree is a projection. `git log` is a temporal query and a rebase is a rewrite of history that everyone correctly treats as dangerous.
- **Database write-ahead logs.** Postgres commits to the WAL first and the heap is derived from it. Replicas rebuild state by replaying the log — event sourcing inside the engine you use every day.
- **Double-entry bookkeeping.** Centuries older than any of this. You never erase a ledger line; you post a correcting entry. That's a compensating event.
- **Order and shipment tracking.** `Placed → Picked → Packed → Shipped → Delivered` is naturally a stream, and the history is what customers actually want to see.

---

## In an interview

Bring it up when the requirements contain the word audit, or compliance, or "we need to know what changed and when," or when the business genuinely asks historical questions. Don't bring it up as a general-purpose scaling answer.

Expect three pushes. *How do you query it* — projections, and say they're rebuildable. *How do you handle a five-year-old event whose schema changed* — tolerant reader, versioning, upcasting, and never rewrite. *How do you delete a user* — crypto-shredding or PII outside the log.

The strongest move available is scoping it: event-source one aggregate where history matters and leave the rest CRUD. Candidates who propose it for the whole system usually can't defend the costs, and interviewers know it.

## Seen in
- Collaborative Editor · The Op Log and Snapshots — the op log is the source of truth, with periodic snapshots so replay doesn't start from the beginning
- Google Pay · The Payment State Machine — every state transition is kept as history, because support, audit and reconciliation all need the "when" and "why"
- Ad Click Aggregator · Late Clicks and Reconciliation — the stored click log is what makes recovery possible: replay an hour after an outage, recount in a nightly batch

## Related
[CQRS](/learn/system-design/cqrs) · [Event-Driven Architecture](/learn/system-design/event-driven-architecture) · [Message Brokers](/learn/system-design/message-brokers) · [Idempotency](/learn/system-design/idempotency) · [Transactions and Isolation](/learn/system-design/transactions-and-isolation) · [Avoiding Distributed Transactions](/learn/system-design/avoiding-distributed-transactions) · [Normalization and Denormalization](/learn/system-design/normalization-and-denormalization)

## Sources
- [Event Sourcing — Martin Fowler](https://martinfowler.com/eaaDev/EventSourcing.html)
- [Event Sourcing pattern — Azure Architecture Center](https://learn.microsoft.com/en-us/azure/architecture/patterns/event-sourcing)
- [What do you mean by "Event-Driven"? — Martin Fowler](https://martinfowler.com/articles/201701-event-driven.html)
- [CQRS — Martin Fowler](https://martinfowler.com/bliki/CQRS.html)
