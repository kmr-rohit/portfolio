---
title: "Idempotency"
summary: "A client sends a request. The request succeeds. The response gets lost on the way back."
stage: 4
stageName: "Distributed systems and coordination"
tier: "core"
seq: 31
tags: ["idempotency", "retries", "exactly-once", "reliability"]
---

A client sends a request. The request succeeds. The response gets lost on the way back.

From the client's point of view, that's indistinguishable from total failure — so it retries. Now the operation has happened twice.

You cannot prevent this. Networks lose responses and clients must retry. What you can do is make the second one harmless.

---

## Where duplicates come from

**Ambiguous failures**, as above. The single most common source, and the one you can never engineer away.

**At-least-once queues.** A consumer crashes after processing a message but before committing the offset, so the message is redelivered.

**Users.** Double-tapping a button. Reopening an app mid-request.

**Reconnects.** The client comes back on a different server that has no memory of the first attempt.

That last one is worth dwelling on, because it connects idempotency to a design decision you might not expect.

---

## The techniques

### Make the operation naturally idempotent

The cheapest fix by far. Prefer **absolute state over deltas**.

"Set position to X" applied twice gives the same result. "Move 5 metres forward" applied twice does not. "Set status to Shipped" is safe; "increment attempt count" isn't.

A surprising amount of duplicate-handling machinery exists only because someone modelled an operation as a delta when it could have been a state.

### Let a unique key be the mutex

If the business rule is "at most one open order per customer", make `customerId` the primary key of a table that only holds open orders. Now a duplicate request doesn't need detecting — it conflicts, and the database tells you.

**Put the invariant in durable, uniquely-keyed state rather than in a runtime check.**

### Check, then act — against durable state

```
existing = lookup(entityId)
if existing is open:  return/resume it      # not "create a second one"
else:                 create it
```

This only works if the state is **persisted**. If it lives in server memory, a client reconnecting to a different server sees nothing and cheerfully creates a duplicate.

Which means idempotency and statelessness are the same design decision. You can't have a reliably idempotent handler on a server that remembers things.

### Idempotency keys

The client generates a UUID per logical operation and sends it with the request. The server stores `(key → result)` and replays the stored result if the key comes back. This is the standard for payment APIs.

It needs a retention policy — you can't keep every key forever — and the window has to be longer than any client's retry budget.

### Conditional writes

`UPDATE ... WHERE state = :expected`. A replay finds the state already advanced, affects zero rows, and does nothing. Self-idempotent, and it doubles as your concurrency control. → [Avoiding Distributed Transactions](/learn/system-design/avoiding-distributed-transactions)

### Dedup windows

Track recently-seen message ids for a bounded period. Cheap, and correct as long as duplicates arrive inside the window — which for network retries they essentially always do.

---

## One habit worth forming

The best idempotent handler doesn't return an error on a duplicate. It **returns the existing result**, or resumes the operation already in flight.

From the client's point of view the retry simply worked, which is exactly what you want. Returning `409 Conflict` to a client that's retrying a request that already succeeded is technically correct and practically unhelpful.

---

## In an interview

Any time your design has a retry, a queue, or a reconnect, say how the receiver handles a duplicate. At-least-once delivery without an idempotent receiver is a bug, and naming it unprompted is a good signal.

Prefer absolute state over deltas where you can — "set status to Shipped" rather than "increment attempts" — and say that's why the operation is safe to repeat.

The trap: answering "how do you avoid duplicates?" with "exactly-once delivery". It doesn't exist over a real network. Say at-least-once plus dedup, and name the key you dedup on.

## Seen in
- 02 - Ride Request Flow — the check-then-act that prevents duplicate rides, and why it must read durable state
- 05 - Matching and Real-Time Push — a conditional update as a self-idempotent claim
- 06 - Location Sharing and Completion — at-least-once delivery with dedup at the receiver

## Related
[Avoiding Distributed Transactions](/learn/system-design/avoiding-distributed-transactions) · [Real-Time Server Push](/learn/system-design/real-time-server-push)
