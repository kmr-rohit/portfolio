---
title: "Normalization and Denormalization"
summary: "Normalization is the discipline of storing each fact in exactly one place. Denormalization is deliberately breaking that rule to make reads cheaper. Both are correct answers to different questions, and the interesting work is knowing which question you're being asked."
stage: 2
stageName: "The database core"
tier: "core"
seq: 15
tags: ["data-modeling", "databases", "denormalization"]
---

Normalization is the discipline of storing each fact in exactly one place. Denormalization is deliberately breaking that rule to make reads cheaper. Both are correct answers to different questions, and the interesting work is knowing which question you're being asked.

Most people can recite "1NF, 2NF, 3NF" and can't say what goes wrong without them. So let's not define them. Let's take a table that looks perfectly reasonable, watch it corrupt itself, and fix it one step at a time. The normal forms will fall out as the names of the fixes.

---

## A table that looks fine

You're building the checkout for an online store. You need to record orders, so you make a table that holds everything about an order:

```
orders
| order_id | customer_email  | customer_name | ship_zip | ship_city   | items          | item_prices |
|----------|-----------------|---------------|----------|-------------|----------------|-------------|
| 1001     | ada@example.com | Ada L.        | 62704    | Springfield | SKU-9,SKU-3    | 1999,499    |
| 1002     | ada@example.com | Ada L.        | 62704    | Springfield | SKU-3          | 499         |
| 1003     | grace@ex.com    | Grace H.      | 94110    | San Fran    | SKU-9,SKU-12   | 1999,2500   |
```

One table, one insert per order, no joins. For a demo it's perfect. Three specific things will now go wrong, and they have names.

**Update anomaly.** Ada changes her display name. That name lives in every row she's ever appeared in — 60 rows after a year. You update 59 of them and one write fails. Your database now contains two different names for one person, and nothing in the schema says which is right.

**Insert anomaly.** Marketing wants to add next season's SKU-40 at £30 so the catalogue page can show it. Where does it go? The only place a product and its price exist is inside an order row. **You cannot record a product until somebody buys one.**

**Delete anomaly.** Order 1002 is cancelled and you delete the row. Look at what left with it: nothing else in the table references SKU-3 at £4.99 — wait, order 1001 does. Delete that too and SKU-3 ceases to exist entirely. Deleting a *transaction* destroyed a *product*.

All three have the same root cause. **Facts about different things are tangled together in one row**, so you can't touch one without touching the others. Normalization is the process of untangling them, and it happens in a specific order.

---

## First normal form: one value per cell

Look at `items` and `item_prices`. They're lists crammed into single fields, and they're coupled by position — the second price belongs to the second SKU, and nothing enforces that. One bad write and the list lengths differ, and now every price in that order is off by one.

It's also unqueryable. "Who bought SKU-3?" becomes `WHERE items LIKE '%SKU-3%'`, which is a substring search no B-tree can serve, and which also matches SKU-30 and SKU-31. → [Database Indexes](/learn/system-design/database-indexes)

**1NF says: no repeating groups. Each cell holds one atomic value, and a one-to-many relationship gets its own table.** Microsoft's classic write-up puts it as "eliminate repeating groups in individual tables" and "create a separate table for each set of related data."

An order has many line items, so line items get a table:

```
orders
| order_id | customer_email  | customer_name | ship_zip | ship_city   |

order_items
| order_id | sku    | qty | product_name  | unit_price_cents |
|----------|--------|-----|---------------|------------------|
| 1001     | SKU-9  | 1   | Desk lamp     | 1999             |
| 1001     | SKU-3  | 1   | Cable tidy    | 499              |
| 1002     | SKU-3  | 1   | Cable tidy    | 499              |
```

Now "who bought SKU-3" is an indexable equality predicate, and an order can have forty lines without a schema change.

<aside class="sd-callout sd-callout--note">



The "atomic value" rule is older than JSON columns and arrays, and modern databases genuinely do index inside them — Postgres GIN over `jsonb`, for instance. That doesn't make 1NF obsolete; it makes it a judgement call. If you'll query, join or constrain on the elements, they want to be rows. If the blob is opaque payload you always read whole, a column is fine.

</aside>

---

## Second normal form: depend on the *whole* key

`order_items` has a composite primary key: `(order_id, sku)`. Now look at `product_name`.

Does the product's name depend on which order it's in? No. It depends on `sku` alone — **half** of the key. That's a **partial dependency**, and it brings the anomalies straight back into the new table:

- Rename "Cable tidy" to "Cable organiser" and you rewrite every line item that ever contained it. Forty thousand rows for a copy edit.
- You still can't create SKU-40 before someone orders it.

**2NF says: in 1NF, and every non-key column depends on the whole primary key, not part of it.** Pull the partial dependency out:

```
products
| sku    | product_name    | list_price_cents |
|--------|-----------------|------------------|
| SKU-9  | Desk lamp       | 1999             |
| SKU-3  | Cable organiser | 499              |

order_items
| order_id | sku    | qty | unit_price_cents |
```

A rename is now one row. A new product is one insert, orders or no orders.

**But notice what stayed behind.** `unit_price_cents` is still on `order_items`, and at a glance that looks like the same violation — price depends on `sku`, doesn't it?

It doesn't. `products.list_price_cents` is *what the thing costs today*. `order_items.unit_price_cents` is *what this customer was charged in March*. Those are two different facts that happen to be equal at the moment of sale. If you "normalize away" the second one, then every discount, every price rise and every promotion silently rewrites history, and your revenue reports change when marketing edits the catalogue.

This is worth internalising because it's the single most common misdiagnosis in schema review: **a duplicated value is only redundancy if it's the same fact. A point-in-time snapshot is a different fact.** Shipping addresses on orders, tax rates on invoices, the terms you agreed to at signup — all the same shape.

---

## Third normal form: don't depend on a non-key column

Back to `orders`:

```
orders
| order_id | customer_email  | customer_name | ship_zip | ship_city |
```

The primary key is `order_id`. Does `customer_name` depend on `order_id`? Only indirectly — it depends on *which customer* the order belongs to. That's a **transitive dependency**: key → customer → name.

Which is why we're still stuck with the very first anomaly we found. Ada renames herself and we're updating every row she appears in.

**3NF says: in 2NF, and every non-key column depends on the key and nothing else.** Or as the Microsoft rule puts it, "eliminate fields that don't depend on the key." Give the customer an identity of their own:

```
customers
| customer_id | email           | name     |

orders
| order_id | customer_id | ship_zip | ship_city |
```

One row per customer. A rename is one write. And a customer can exist before they order anything, which the marketing team will need about ten minutes after launch.

Here's the final schema, and every one of the three anomalies is now structurally impossible:

```
customers ──< orders ──< order_items >── products
```

**What about `ship_city` depending on `ship_zip`?** That's a textbook transitive dependency too, and by the rules it wants its own `postcodes` table. Almost nobody does this, for two good reasons: the shipping address is a point-in-time fact about the order (same argument as the price), and maintaining a global postcode table is a worse problem than the one it solves. The docs are honest about this — "adhering to the third normal form, while theoretically desirable, isn't always practical" — and note that third normal form "is considered the highest level necessary for most applications." BCNF, 4NF and 5NF exist; you will not be asked to apply them.

So the rule of thumb everyone quotes — *every non-key attribute depends on the key, the whole key, and nothing but the key* — is a fine mnemonic, but only after you've watched the three anomalies it prevents.

---

## And now the whole thing goes into reverse

The store launches. The product page shows the product, its category, its seller, its average rating, its review count and its top three reviews. On a normalized schema that's:

```sql
SELECT p.*, c.name, s.name, s.rating,
       (SELECT avg(stars) FROM reviews r WHERE r.sku = p.sku),
       (SELECT count(*)   FROM reviews r WHERE r.sku = p.sku)
FROM products p
JOIN categories c ON c.id = p.category_id
JOIN sellers    s ON s.id = p.seller_id
WHERE p.sku = 'SKU-9';
```

Six tables to render one page. At 50 requests per second, that's nothing — the joins are indexed, everything's in cache, it returns in 4 ms.

At 50,000 requests per second it's a different animal, and for three separate reasons.

**Read amplification.** One logical read has become six physical ones, plus two aggregates that scan the reviews for that product. You didn't 6× your traffic, you 6×'d your database's work per unit of traffic.

**The aggregates don't stay cheap.** `count(*)` over reviews costs more as the product gets more popular. Your most valuable pages are your slowest ones, which is precisely backwards.

**Joins stop being local.** This is the one that actually forces the decision. On one machine a join is a hash table in RAM. Once `products` and `reviews` live on different shards — or different services — that join isn't a join any more. It's a network round trip, and possibly a scatter-gather across every shard. → [Sharding and Partitioning](/learn/system-design/sharding-and-partitioning)

Normalization optimises for **write correctness**: each fact in one place, so it can't disagree with itself. It is indifferent to how many places you have to look to answer a question. Once reads dominate — and in most consumer systems they dominate by two or three orders of magnitude — you start paying that indifference on every request.

---

## Denormalizing: three moves, increasing in commitment

**Copy a column.** Put `category_name` on `products`. One join gone. Cheap to do, cheap to keep honest if the source rarely changes — category names change roughly never.

**Precompute an aggregate.** Store `review_count` and `rating_sum` on the product row and update them when a review is written. The `count(*)` and `avg()` disappear entirely. This is the highest-leverage version, because you've turned an O(reviews) operation into an O(1) read.

**Materialise the whole view.** Build a `product_page` record that already contains everything the page needs, shaped exactly like the response. One key lookup, zero joins. This is the full commitment: you now maintain a second representation of your data whose only job is to serve one access pattern. Taken to its conclusion, with a separate write model and read model kept in sync by a stream of events, this is [CQRS](/learn/system-design/cqrs).

The progression is the same in each case. **You move work from read time to write time.** Reads got cheaper and more predictable. Writes got more expensive and much more complicated.

---

## What denormalization actually costs

**Write amplification.** A new review used to be one insert. Now it's an insert plus an update to the product's counters plus a rewrite of the materialised page record. And every one of those extra writes is also touching indexes. → [Database Indexes](/learn/system-design/database-indexes)

**Contention you didn't have.** Every review on a hot product now updates the *same* product row. That row becomes a lock hotspot, and concurrent updates serialise on it. The classic fix is to shard the counter — keep N sub-counters and sum them on read — but notice you've now introduced a small distributed-systems problem into what was a `count(*)`. → [Hotspots and Dynamic Resharding](/learn/system-design/hotspots-and-dynamic-resharding)

**You own an invariant the database used to own.** This is the real cost, and it's permanent. In 3NF, "the category name is correct" was guaranteed by there being exactly one copy. With the copy on `products`, correctness is now a property of your application code, your deploy process, your backfill scripts and your failure handling. Every path that writes a category name has to write both. Forever. Including the one your teammate adds next quarter.

So the question is never "is this denormalized?" — it's **"how do the copies get fixed when they drift, and how far apart can they drift in the meantime?"** Have an answer before you propose it.

| Sync strategy | Consistency | Cost |
|---|---|---|
| Same transaction | Copies never disagree | Both tables must be in one database; write latency is the sum |
| Database trigger | Same transaction, implicitly | Invisible logic; surprising under bulk loads and migrations |
| Async via CDC or events | Eventually consistent, lag from ~ms to unbounded under backlog | Decoupled and scalable; reads can be stale |
| Periodic reconciliation job | Converges, on the job's schedule | Cheapest to build; a safety net under the other three, not a substitute |

The dividing line that matters: **if a correctness decision reads the copy, it can't be async.** "Does this user already have an open order?" cannot be answered from a view that's 800 ms behind, because 800 ms is long enough for someone to open a second one. Derived read models, search indexes, analytics and caches are fine. Uniqueness checks and anything gating a claim are not. → [Secondary Indexes at Scale](/learn/system-design/secondary-indexes-at-scale)

<aside class="sd-callout sd-callout--warning">



"We'll denormalize for performance" without a named access pattern is the mistake interviewers are listening for. Denormalization is per-query: you name the read, show what it costs normalized, then duplicate exactly the fields that read needs. Duplicating fields speculatively gets you all of the write cost and none of the benefit.

</aside>

---

## In NoSQL, denormalized is the starting position

Everything above framed denormalization as deviating from a normalized baseline. In a document or wide-column store there is no such baseline, because the engine usually can't join at all. AWS is direct about the difference:

> "In RDBMS, you design for flexibility without worrying about implementation details or performance... In DynamoDB, you design your schema specifically to make the most common and important queries as fast and as inexpensive as possible."

And the sequencing is inverted:

> "For an RDBMS, you can go ahead and create a normalized data model without thinking about access patterns... By contrast, you shouldn't start designing your schema for DynamoDB until you know the questions it will need to answer."

So you don't model entities and then derive queries. You enumerate queries and then derive storage, keeping related data together so one read serves one screen — which is why DynamoDB advice tends toward "as few tables as possible," and why MongoDB says that because "you can use embedded documents and arrays to capture relationships between data in a single document structure instead of normalizing across multiple documents and collections, multi-document transactions are not necessary for many practical use cases."

That's the deal in one sentence. **Embedding buys you single-read access and single-document atomicity; it costs you the ability to change a shared fact in one place.** Embed the seller's name in ten million product documents and a rename is a ten-million-document migration.

The practical shape most teams land on: embed what's owned by the parent and read with it (line items in an order, comments-so-far on a post), reference what's shared and mutable (the seller, the category), and accept that when access patterns change you will be rewriting data, not just rewriting queries. → [NoSQL Databases](/learn/system-design/nosql-databases) · [SQL Databases](/learn/system-design/sql-databases)

---

## Where this shows up

- **Any product page or feed backed by a normalized OLTP schema.** The join count creeps up one feature at a time until someone builds a read model.
- **Counters on hot objects** — likes, views, followers, review counts. Almost always denormalized, almost always the first place lock contention appears.
- **Analytics and warehousing**, where star schemas deliberately denormalize dimensions onto fact tables because the read pattern is scans and aggregations, not point updates.
- **Any schema on a sharded database**, where the join you'd have written locally is now a cross-machine call and duplicating the column is the cheaper option.

## In an interview

Start normalized. It's the defensible default, it shows you know where the facts live, and it gives you something concrete to denormalize *from*.

Then denormalize out loud, per access pattern: name the read, say what it costs normalized, say exactly which fields you're duplicating and how they're kept in sync. "I'll store `review_count` on the product and update it in the same transaction as the review insert" is a complete answer. "We'd denormalize for performance" is not.

Expect them to push on staleness. Know the dividing line: derived read models can be async, correctness checks cannot.

If the store is NoSQL, invert the order — enumerate access patterns first, then design keys. Presenting a 3NF schema for DynamoDB and then bolting on indexes to make it work is the tell that you're translating rather than modelling.

## Seen in
- 03 - Data Model and Sharding — two lookup tables built by hand as denormalized copies of a base table, and an explicit decision about how far behind they're allowed to drift

## Related
- [Database Indexes](/learn/system-design/database-indexes) — the other lever on read cost; an index is itself a denormalized copy the database maintains for you
- [SQL Databases](/learn/system-design/sql-databases) · [NoSQL Databases](/learn/system-design/nosql-databases) — the two starting positions this note moves between
- [CQRS](/learn/system-design/cqrs) — denormalization taken to its conclusion: a separate read model with its own storage
- [Transactions and Isolation](/learn/system-design/transactions-and-isolation) — how you keep two copies honest inside one database, and what it costs
- [ACID and BASE](/learn/system-design/acid-and-base) — and what you settle for when they're in two
- [Secondary Indexes at Scale](/learn/system-design/secondary-indexes-at-scale) · [Sharding and Partitioning](/learn/system-design/sharding-and-partitioning) · [Caching Strategies](/learn/system-design/caching-strategies)

## Sources
- [Microsoft Learn: Database normalization description](https://learn.microsoft.com/en-us/office/troubleshoot/access/database-normalization-description)
- [AWS: NoSQL design for DynamoDB](https://docs.aws.amazon.com/amazondynamodb/latest/developerguide/bp-general-nosql-design.html)
- [MongoDB: Transactions](https://www.mongodb.com/docs/manual/core/transactions/)
- [PostgreSQL: Index Types (GIN and jsonb)](https://www.postgresql.org/docs/current/indexes-types.html)
