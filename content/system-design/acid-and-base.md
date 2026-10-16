---
title: "ACID and BASE"
summary: "Two acronyms that get taught as opposing philosophies. They're really two ends of a dial, and most interesting systems sit somewhere in the middle — often in different places for different operations."
stage: 2
stageName: "The database core"
tier: "core"
seq: 10
tags: ["acid", "base", "consistency", "distributed-systems"]
---

Two acronyms that get taught as opposing philosophies. They're really two ends of a dial, and most interesting systems sit somewhere in the middle — often in different places for different operations.

---

## Start with what ACID buys you

You're running an online store on one Postgres instance. Someone checks out: you decrement stock, write an order row, and record a payment. Three writes that must all happen or none.

ACID is the four promises a transaction makes, and it's worth being precise because one of them isn't what people think.

**Atomicity** — all of it or none of it. A crash halfway rolls back.

**Isolation** — concurrent transactions don't see each other's half-finished work. This is the one with real depth, and it gets its own note: [Transactions and Isolation](/learn/system-design/transactions-and-isolation).

**Durability** — once `COMMIT` returns, a power cut can't undo it.

**Consistency** — and here's the odd one out. It means *your declared constraints still hold*: foreign keys, `CHECK`, `UNIQUE`. The database enforces the rules you told it about, and nothing else. "The books balance" or "there's always a doctor on call" are invariants only your application knows about.

Consistency is arguably in the acronym because ACID is a nicer word than AID. Joe Hellerstein has made roughly that point. It's worth knowing, because the `C` in ACID and the `C` in [CAP Theorem](/learn/system-design/cap-theorem) mean **completely different things**, and conflating them is one of the most common interview errors there is.

---

## Now put it on five machines

Everything above assumes one node. The moment you replicate across a continent, atomicity and isolation stop being local.

Making a transaction atomic across machines means a coordinator, a prepare round, and locks held across the network while you wait for the slowest participant — and if the coordinator dies mid-flight, participants block. That's two-phase commit, and it's why [Avoiding Distributed Transactions](/learn/system-design/avoiding-distributed-transactions) exists as a note.

Making every replica agree before acknowledging a write means every write pays the latency of your slowest replica, and a network partition means you can't accept writes at all.

So there's a real decision to make. And for a lot of workloads — a product catalogue, a follower count, a "who's online" list — the coordination isn't worth what it costs.

---

## BASE is what's left when you stop coordinating

<figure class="sd-figure"><img src="/system-design/diagrams/acid-and-base.svg" alt="Diagram: ACID and BASE" loading="lazy" decoding="async" /></figure>

**Basically Available** — the system answers something, even during a partition. Possibly stale, possibly a degraded answer, but not an error.

**Soft state** — replicas may disagree right now, even with no writes in flight, because updates are still propagating.

**Eventually consistent** — stop writing, wait, and all replicas converge on the same value.

Notice that BASE isn't a protocol or a set of guarantees you implement. It's a *description of what you get* once you've decided coordination is too expensive. ACID tells you what the database promises; BASE tells you what it's stopped promising.

"Eventually" is also doing a lot of work in that phrase. It usually means milliseconds. Under load or during a partition it's unbounded, which is exactly when you'd most like to know.

---

## Why "ACID vs NoSQL" is a dead framing

The clean split you'll read about — SQL is ACID, NoSQL is BASE — hasn't been true for years.

MongoDB added multi-document ACID transactions in 4.0. DynamoDB has transactions and lets you ask for a strongly consistent read on any query. Cassandra gives you tunable consistency per query through R and W, plus lightweight transactions for compare-and-set. Meanwhile Spanner and CockroachDB provide strict serializability across continents, and Postgres and MySQL both scale horizontally with the right extensions.

The more useful framing is the dial in the diagram above: **how much coordination are you willing to pay for, on this particular operation?** A payment gets strong consistency. The same system's recommendation feed doesn't.

That's the same conclusion [Replication and Read Consistency](/learn/system-design/replication-and-read-consistency) arrives at from the replication side — consistency is chosen per code path, by what breaks if the answer is stale.

---

## Choosing, in practice

Reach for **strong consistency** when a stale or conflicting read causes real damage: money, inventory that can oversell, anything enforcing uniqueness, and any read that gates a concurrency decision.

Reach for **eventual consistency** when the data is high-volume, tolerant of being seconds old, and cheap to be wrong about: counters, feeds, caches, analytics, presence, recommendations.

And when you can, buy the middle: **session guarantees**. Read-your-writes means a user always sees their own update even though the system is eventually consistent globally. That's usually what people actually want when they ask for "consistency", and it's dramatically cheaper than the real thing. → [Replication and Read Consistency](/learn/system-design/replication-and-read-consistency)

---

## Where this shows up

- **Payment and ledger systems** — strong consistency, no negotiation.
- **Shopping carts and inventory** — usually eventually consistent, with a strongly-consistent check at checkout.
- **Social feeds and follower counts** — eventual, and nobody notices.
- **Multi-region deployments**, where the coordination cost is measured in cross-continent round trips rather than microseconds.

---

## In an interview

Never say "it's ACID" or "it's BASE" about a whole system. Say which operations need which, and why. That single move separates people who've read about this from people who've had to decide it.

Be ready for the `C` trap: if you use "consistency" without saying whether you mean ACID's constraint-checking or CAP's linearizability, a good interviewer will ask, and the answer needs to be immediate.

And know one concrete example of a system with tunable consistency — DynamoDB's optional strong reads, or Cassandra's R + W > N. It's the cleanest evidence that this is a dial and not a camp.

---

## Seen in
- BookMyShow · Double Booking — the seat itself needs a strongly consistent, transactional write, even though the rest of the catalogue can be eventually consistent
- Google Pay · The Ledger — money movement is the case where ACID is non-negotiable; balances are derived from append-only entries inside one transaction

## Related
[Transactions and Isolation](/learn/system-design/transactions-and-isolation) · [CAP Theorem](/learn/system-design/cap-theorem) · [PACELC Theorem](/learn/system-design/pacelc-theorem) · [Replication and Read Consistency](/learn/system-design/replication-and-read-consistency) · [Avoiding Distributed Transactions](/learn/system-design/avoiding-distributed-transactions) · [NoSQL Databases](/learn/system-design/nosql-databases) · [SQL Databases](/learn/system-design/sql-databases)

## Sources
- [PostgreSQL: Transactions](https://www.postgresql.org/docs/current/tutorial-transactions.html)
- [Amazon DynamoDB: Read consistency](https://docs.aws.amazon.com/amazondynamodb/latest/developerguide/HowItWorks.ReadConsistency.html)
- [Apache Cassandra: Configuring consistency levels](https://cassandra.apache.org/doc/latest/cassandra/architecture/dynamo.html)
- [MongoDB: Transactions](https://www.mongodb.com/docs/manual/core/transactions/)
- [Eric Brewer, "CAP Twelve Years Later"](https://www.infoq.com/articles/cap-twelve-years-later-how-the-rules-have-changed/)
