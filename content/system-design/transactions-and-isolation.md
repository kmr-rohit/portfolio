---
title: "Transactions & Isolation"
summary: "Your code moves money between two accounts with two UPDATE statements. Most days that's fine. Then one day the machine dies between them, or two requests run them at the same moment, and it isn't."
stage: 2
stageName: "The database core"
tier: "core"
seq: 9
tags: ["transactions", "acid", "isolation", "mvcc", "concurrency"]
---

Your code moves money between two accounts with two `UPDATE` statements. Most days that's fine. Then one day the machine dies between them, or two requests run them at the same moment, and it isn't.

Wrapping them in a transaction is the database's promise that the group behaves like a single operation. Most of that promise is easy to keep. One part of it, isolation, is where databases get genuinely interesting, and where most concurrency bugs live.

---

## The promise, and why you need it

You're moving £100 between two accounts:

```sql
UPDATE accounts SET balance = balance - 100 WHERE id = 1;
UPDATE accounts SET balance = balance + 100 WHERE id = 2;
```

The machine dies between those two statements. Money has left account 1 and arrived nowhere. There is no sequence of later operations that fixes this, because nothing recorded that the second half was supposed to happen.

Wrapping them in `BEGIN ... COMMIT` fixes it, and the four letters of ACID are the four separate promises that makes.

**Atomicity** — all of it happens or none of it does. The database keeps a write-ahead log of what it intended, so a crash mid-transaction rolls back cleanly on restart.

**Durability** — once `COMMIT` returns, the change survives a power cut. That's the WAL again, `fsync`'d to disk before the commit is acknowledged.

**Consistency** — the database's declared rules still hold: foreign keys, `CHECK` constraints, uniqueness. This is the odd one out. The database only enforces the invariants you *told* it about; "the books balance" is your job, not its.

**Isolation** — concurrent transactions don't see each other's half-finished work.

Atomicity and durability are mostly solved engineering. Isolation is a spectrum you have to choose a point on, and that choice has real consequences.

---

## Why isolation is hard

There's an obvious way to get perfect isolation: run transactions one at a time. That's **serial execution**, and it's trivially correct.

It's also unusable. One slow query blocks everything, and you get no benefit from having more than one CPU.

So databases run transactions concurrently and try to produce a result that *looks like* some serial order. The question is how hard they try, because trying harder costs throughput. Every isolation level is a different answer to "how much interleaving am I willing to allow?"

---

## The five things that go wrong

Each of these is a specific interleaving that a weaker level permits.

<figure class="sd-figure"><img src="/system-design/diagrams/transactions-and-isolation.svg" alt="Diagram: Transactions and Isolation" loading="lazy" decoding="async" /></figure>

### Dirty read

T2 updates a balance to 900 but hasn't committed. T1 reads it, sees 900, and acts on it. Then T2 rolls back.

T1 made a decision based on a number that never existed. This is the easiest anomaly to eliminate and almost every database blocks it by default.

### Non-repeatable read

T1 reads a balance and gets 500. T2 updates it to 900 and commits. T1 reads the same row again and gets 900.

Nothing here is uncommitted — both values were real. But T1 asked the same question twice inside one transaction and got two answers, which means any logic comparing the two is working with an inconsistent picture.

### Phantom read

Same idea, but for a *range* rather than a row. T1 counts matching rows and gets 4. T2 inserts a row that matches and commits. T1 counts again and gets 5.

No row T1 read has changed. A new one appeared. That's a different problem to solve, because you can't lock a row that doesn't exist yet — you have to lock the *predicate*, which is why databases use range or gap locks here.

### Lost update

Both transactions read `qty = 10`. Both compute `10 - 1`. Both write 9.

Two sales happened and inventory dropped by one. This is the classic read-modify-write race, and it's the one you're most likely to write by accident in application code.

### Write skew

The subtle one, and worth slowing down for.

A hospital requires at least one doctor on call. Alice and Bob are both on call and both want to go off. Alice's transaction counts on-call doctors, sees 2, decides that's fine, and sets herself off. Bob's transaction does exactly the same thing concurrently.

Both checks passed. Both writes were legal. Nobody is on call.

What makes this different from lost update is that the two transactions **wrote different rows**. Alice wrote her row, Bob wrote his. No conflict on any individual row, so most conflict-detection schemes see nothing wrong. The violated invariant spanned rows that neither transaction wrote.

---

## The isolation levels

The SQL standard defines four, each blocking more of the above:

| Level | Dirty read | Non-repeatable read | Phantom | Write skew |
|---|---|---|---|---|
| Read Uncommitted | ✗ allowed | ✗ | ✗ | ✗ |
| Read Committed | ✓ blocked | ✗ | ✗ | ✗ |
| Repeatable Read | ✓ | ✓ | depends | ✗ |
| Serializable | ✓ | ✓ | ✓ | ✓ |

Two things about that table are worth knowing, because they trip people up.

**"Repeatable Read" means different things in different databases.** The standard permits phantoms at this level. Postgres's implementation is snapshot isolation, which happens to block phantoms too — but still allows write skew. MySQL's InnoDB blocks phantoms with gap locks. Same name, different guarantees.

**Read Committed is the default almost everywhere** (Postgres, Oracle, SQL Server). Which means by default your application is exposed to non-repeatable reads, lost updates and write skew. If your code does read-modify-write and you never thought about isolation, you have a latent race.

---

## How databases actually implement this

### MVCC — the modern default

Rather than locking rows so nobody else can read them, **multi-version concurrency control** keeps several versions of each row and shows each transaction the version that was current when it started.

In Postgres, every row carries two hidden columns: `xmin`, the transaction that created this version, and `xmax`, the transaction that deleted it. An `UPDATE` doesn't overwrite — it writes a new row version and marks the old one's `xmax`. Each transaction gets a snapshot: a list of which transaction IDs were committed when it began. It then simply ignores any row version outside that snapshot.

The payoff is the property that makes MVCC worth the complexity: **readers never block writers, and writers never block readers.** A long analytical query doesn't stop anyone from writing, because it's reading old versions that nobody needs to touch.

The cost is the old versions. They accumulate until nothing can see them anymore, at which point they have to be cleaned up — that's what `VACUUM` is for, and a long-running transaction holding an old snapshot open is what causes table bloat.

### Two-phase locking — the pessimistic route

The older approach: take locks, and hold them until commit. "Two-phase" refers to a growing phase where you only acquire locks, then a shrinking phase where you only release them. Shared locks for reads, exclusive for writes.

This gives genuine serializability, and it gives you contention. Readers block writers and vice versa, and you now have deadlocks to deal with.

### Serializable Snapshot Isolation

What Postgres's `SERIALIZABLE` actually does. It runs optimistically like MVCC, but tracks the read/write dependencies between concurrent transactions and looks for the specific dangerous pattern that indicates a serialization failure. When it spots one, it aborts a transaction.

So it's fast when conflicts are rare, and it hands you a `40001 serialization_failure` error when they aren't. **Your application must be prepared to retry.** That's not optional — it's the contract.

---

## Optimistic versus pessimistic, and what you should do

**Pessimistic** — assume conflict, lock first. `SELECT ... FOR UPDATE` takes the row lock before you read it, so nobody else can touch it until you commit. Correct, and it holds a lock for the duration of whatever you do next — including, if you're careless, a network call.

**Optimistic** — assume no conflict, detect it at write time. Add a `version` column, and make the write conditional:

```sql
UPDATE inventory SET qty = 9, version = 4
 WHERE id = 42 AND version = 3;
```

Zero rows affected means someone beat you, and you re-read and retry. This holds no locks at all, which is why it scales better under low contention — and why it's the pattern behind the claim check in [Avoiding Distributed Transactions](/learn/system-design/avoiding-distributed-transactions).

The rough rule: **pessimistic when contention is high and retries are expensive, optimistic when contention is low.** A single hot row being fought over by a thousand clients will livelock under optimistic retries.

---

## Deadlocks

Two transactions each hold a lock the other wants. Neither can proceed.

Databases detect this with a wait-for graph and kill one of the transactions — your client gets an error and is expected to retry. This is normal operation, not a bug in the database.

You reduce them by **acquiring locks in a consistent order everywhere**. Most deadlocks come from one code path locking A then B while another locks B then A. Keeping transactions short helps too, since a lock you hold for 5ms is much harder to deadlock on than one you hold for 5 seconds.

---

## Where this shows up

- **Any inventory or booking system.** "Last item in stock" is the lost update problem wearing a costume.
- **Financial ledgers**, where write skew is the specific danger — balance checks that pass individually and violate a limit together.
- **Long-running reports** against a live OLTP database, which is exactly what MVCC's non-blocking reads exist for.
- **Distributed systems**, where "serializable" typically becomes "serializable within one partition" — the guarantee that makes a single-row conditional update sufficient. → [Avoiding Distributed Transactions](/learn/system-design/avoiding-distributed-transactions)

---

## In an interview

If you propose a read-modify-write anywhere, say how you're protecting it — a conditional update, `SELECT FOR UPDATE`, or an explicit isolation level. Volunteering this unprompted is a strong signal, because most candidates write the race and don't notice.

Know that Read Committed is the common default and what it leaves you exposed to. If you say "we'll use transactions" and the interviewer asks "at what isolation level?", the answer shouldn't be a surprise.

Write skew is the one worth having in your pocket. Being able to describe an anomaly that snapshot isolation *doesn't* prevent shows you understand the levels rather than having memorised their names.

---

## Seen in
- BookMyShow · Double Booking — two users grabbing the last seat is a lost update, fixed with a conditional update or a row lock
- Google Drive · Conflicting Edits — optimistic concurrency with a version check, because you can't hold a lock while someone edits offline for hours
- Rate Limiter · Making the Check Atomic — read-check-increment is a race; a Lua script in Redis makes it one atomic step
- Google Pay · The Double Tap — a unique constraint plus a transaction turns a double tap into one payment
- BookMyShow · Holding a Seat — why a long-held transaction is the wrong way to hold a seat, including the vacuum cost in Postgres

## Related
[ACID and BASE](/learn/system-design/acid-and-base) · [Avoiding Distributed Transactions](/learn/system-design/avoiding-distributed-transactions) · [SQL Databases](/learn/system-design/sql-databases) · [Databases and DBMS](/learn/system-design/databases-and-dbms) · [Idempotency](/learn/system-design/idempotency) · [Replication and Read Consistency](/learn/system-design/replication-and-read-consistency)

## Sources
- [PostgreSQL: Transaction Isolation](https://www.postgresql.org/docs/current/transaction-iso.html)
- [PostgreSQL: Concurrency Control / MVCC](https://www.postgresql.org/docs/current/mvcc-intro.html)
- [MySQL InnoDB Transaction Isolation Levels](https://dev.mysql.com/doc/refman/8.0/en/innodb-transaction-isolation-levels.html)
- [A Critique of ANSI SQL Isolation Levels (Berenson et al.)](https://www.microsoft.com/en-us/research/publication/a-critique-of-ansi-sql-isolation-levels/)
- [Serializable Snapshot Isolation in PostgreSQL (Ports & Grittner)](https://drkp.net/papers/ssi-vldb12.pdf)
