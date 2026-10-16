---
title: "HLD Delivery Framework"
summary: "You're given a one-line prompt (\"design Instagram\") and 45 minutes. The most common way to fail isn't a missing technology. It's spending forty minutes on the wrong thing, or drawing boxes before anyone has agreed what the system does. A framework doesn't make you smart; it stops you from wandering."
stage: 0
stageName: "The interview"
tier: "core"
seq: 1
tags: ["framework", "interview", "process"]
---

You're given a one-line prompt ("design Instagram") and 45 minutes. The most common way to fail isn't a missing technology. It's spending forty minutes on the wrong thing, or drawing boxes before anyone has agreed what the system does. A framework doesn't make you smart; it stops you from wandering.

<figure class="sd-figure"><img src="/system-design/diagrams/hld-delivery-framework.svg" alt="Diagram: HLD Delivery Framework" loading="lazy" decoding="async" /></figure>

The same six moves work for almost every problem in this vault. The times are a budget, not a rule; you'll flex them.

---

## 1. Requirements (~5 min)

Turn a vague sentence into a spec you can design against.

- **Functional:** the three to five things the system must do, phrased as "users can...". Say what's **out of scope** aloud (search, payments, recommendations). It's cover for later.
- **Non-functional:** the qualities that will shape the design, with numbers where you can: scale, latency, availability versus consistency, durability. Say which matters most. "Highly available and strongly consistent" is a wish; the honest answer is different guarantees for different parts.

Two or three sharp questions beat ten generic ones. Ask the ones whose answer changes the design: *is it read-heavy or write-heavy? what happens if we lose an update? how fresh must it be?*

## 2. Core entities and API (~5 min)

List the nouns (`User`, `Post`, `Follow`) and the operations on them. Sketch the API for the main flows:

```
POST /posts            {text, mediaKeys}        -> postId
GET  /feed?cursor=     -> [Post], nextCursor
```

Mention the boring correctness details in one breath: identity comes from the auth token (never the body), state-changing calls take an **idempotency key**, lists use **cursor** pagination. That's most of API design at this level. → [Idempotency](/learn/system-design/idempotency)

## 3. Estimate what matters (~3–5 min)

Do only the arithmetic that **changes a decision**: request rate and its peak, read:write ratio, bytes per second, storage per year. Round hard and say your assumptions. If the answer is "one machine", say so and move on to what's actually hard. → [Back-of-the-Envelope Estimation](/learn/system-design/back-of-the-envelope-estimation)

## 4. High-level design (~10 min)

Draw the simplest thing that meets the functional requirements, then walk one request through it end to end. Boxes: clients, a load balancer or gateway, stateless services, databases and caches, queues where work is asynchronous.

Rules that keep it honest:

- Start with the **data model and the queries**: which access paths need to be one read?
- Keep services **stateless**; put state in stores.
- Name the datastore and *why* (the query it serves, the consistency it needs). → [SQL vs NoSQL](/learn/system-design/sql-vs-nosql)
- Trace the **write path** and the **read path** separately.

Don't over-draw. This diagram is the scaffolding for the next step.

## 5. Deep dives (~15 min)

This is where the score is. Pick the **two or three hardest parts** and take them properly. How do you know what's hard? The estimate and the requirements told you:

- A number that breaks a single machine (2M writes/s, 380 MB/s of reads).
- A correctness rule (no double booking, no double charge).
- A hot key or a celebrity.
- A failure that must be survivable (a crash between two writes).

Use the shape that works in every note in this vault: **try the obvious thing, show it working, break it with a specific scenario, fix it, then say what the fix costs.** Then pause and let the interviewer steer; a good interviewer will point at the part they care about. Follow them.

Look for the recurring moves: colocate the contenders so one shard settles a race; order writes so the failure is harmless; make the retry idempotent; split by lifetime (durable versus ephemeral); trade durability where losing data is cheap. → [Dealing with Contention](/learn/system-design/dealing-with-contention) · [Scaling Reads](/learn/system-design/scaling-reads) · [Scaling Writes](/learn/system-design/scaling-writes)

## 6. Wrap-up (~3–5 min)

Summarise the design in a few sentences, name the **trade-offs you made and what you'd revisit**, and answer failure questions: "what if this dies here?" If you know the weak spots of your design, say them before you're asked. Volunteering a weakness is worth more than defending a flaw.

---

## In an interview

| Level | What they look for |
|---|---|
| Mid | A working design; sensible data model and API; can explain choices |
| Senior | Finds the hard part unprompted; deep in one or two areas; handles trade-offs and failures |
| Staff+ | Frames the problem, sets the direction, spots the non-obvious risk, connects to real systems, keeps the conversation productive |

The signals in every level: **clarity** (structured, in order), **judgement** (choices with reasons and costs), **depth where it counts**, and **responsiveness** to hints.

---

## Common traps

- Jumping to boxes before requirements.
- Spending fifteen minutes on the easy parts because they're easy.
- Reaching for a technology name with no reason ("we'll use Kafka").
- Performing scale anxiety for a problem that's actually small.
- Ignoring failure: every arrow between two systems can lose or duplicate a message.
- Ignoring the interviewer's hints.

## Seen in
- URL Shortener — the framework at its plainest: two functions, one estimate, one hard part
- BookMyShow — the estimate (50,000 seats vs 14M attempts) picks the deep dives
- Google Pay — deep dives chosen by correctness rules, not scale
- Connect Four — the LLD version of the same discipline

## Related
LLD Delivery Framework · [Back-of-the-Envelope Estimation](/learn/system-design/back-of-the-envelope-estimation) · 00 - Concepts Index
