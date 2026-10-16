---
title: "CAP Theorem"
summary: "CAP is the most-quoted and least-understood result in system design. Almost everything that goes wrong with it comes from one mistake: treating it as a permanent label you stick on a database, when it's actually a statement about what happens in the few seconds when a network link is down."
stage: 4
stageName: "Distributed systems and coordination"
tier: "core"
seq: 28
tags: ["cap", "consistency", "availability", "distributed-systems"]
---

CAP is the most-quoted and least-understood result in system design. Almost everything that goes wrong with it comes from one mistake: treating it as a permanent label you stick on a database, when it's actually a statement about what happens in the few seconds when a network link is down.

Let's build it from a situation where the choice is forced, and then take apart each of the three words.

---

## Two datacenters and a cut cable

You're running an online store. Inventory lives in a table:

```sql
CREATE TABLE inventory (
  sku        TEXT PRIMARY KEY,
  qty_on_hand INT NOT NULL
);
```

You run it out of two datacenters, East and West, each with a full copy, each accepting writes, replicating to the other. Customers hit whichever is closer. On a normal day this is lovely: a write in East shows up in West a few tens of milliseconds later, and nobody notices.

Here's the setup. Each side has a full copy, and the link between them is the only thing keeping them in agreement.

<figure class="sd-figure"><img src="/system-design/diagrams/cap-theorem.svg" alt="Diagram: CAP Theorem" loading="lazy" decoding="async" /></figure>

Now a fibre cut takes out the link between them. Both datacenters are healthy. Both have power, both have disks, both are happily serving traffic. They just can't talk to each other.

There is one unit of `SKU-42` left. A customer in Boston hits East and buys it. East decrements to zero. A customer in Portland hits West a second later and asks to buy the same unit.

**What should West do?**

---

## There are exactly two answers, and you have to pick one

**Answer one: refuse.** West says "I can't confirm inventory right now, try again later," and returns an error. It does this because it knows it can't see East, so it can't know whether `qty_on_hand = 1` is still true. Nobody oversells. But a healthy server just refused a request from a healthy customer over a network problem neither of them caused.

**Answer two: serve it.** West reads its local copy, sees `qty = 1`, and takes the order. The customer gets a confirmation. When the link heals, East and West compare notes and discover they've sold the same unit twice. Somebody gets an apology email.

That's it. That's the whole theorem. There is no third option, and the reason is almost embarrassingly simple: **to be certain you're returning the current value, you have to hear from everyone who might have changed it.** West cannot hear from East. The message cannot cross. So West either waits (and stops being available) or guesses (and stops being consistent).

Gilbert and Lynch turned that hand-wave into a proof in 2002. Their argument is essentially the paragraph you just read, run as a contradiction: assume a system that's both consistent and available under partition, partition it, write on one side, read on the other, and the read must return the new value — but no information about the write ever reached that side, so the system would have had to be clairvoyant.

<aside class="sd-callout sd-callout--note">



The theorem is stated for an *asynchronous* network — no clocks, no bound on message delay. Gilbert and Lynch also cover the partially synchronous model, where you do have clocks, and the result softens slightly: you can build a system that returns stale-but-bounded data. That's where things like Spanner's bounded-staleness reads live. The impossibility doesn't go away, it just gets a knob.

</aside>

---

## "Consistency" here is linearizability, not the C in ACID

This is the precision point that separates people who've read the paper from people who've read a blog post about the paper.

The C in CAP means **linearizability**: the system behaves as though there is exactly one copy of the data, and every operation takes effect at a single instant somewhere between when you called it and when it returned. Concretely — if your write returns success at 10:00:00.000, every read that *starts* after that instant sees it, no matter which node answers.

The C in ACID means something completely unrelated: **a transaction moves the database from one valid state to another**, where "valid" means your declared constraints hold — foreign keys, unique indexes, `CHECK (qty_on_hand >= 0)`. That's a property of your schema and your application's invariants. It's arguably not a database property at all; it got into the acronym because ACID is easier to say than AID.

The two words are unrelated. A single-node Postgres gives you ACID's C *and* is trivially linearizable, because one copy is definitionally coherent. A three-node Cassandra cluster read at `CL=ONE` gives you neither. A sharded MySQL fleet with per-row constraints gives you ACID's C on every row and no linearizability across rows at all.

While we're being precise: linearizability and **serializability** are also different things. Serializability is about transactions — several transactions touching several objects produce a result equal to *some* serial order. Linearizability is about a single object and *real time* — the order has to match the order things actually happened. You can have either without the other. Having both is called strict serializability, and it's what Spanner sells. → [Transactions and Isolation](/learn/system-design/transactions-and-isolation)

---

## Partition tolerance isn't something you get to decline

Every CAP diagram is a Venn diagram with three circles and three intersections, which strongly implies CA is a thing you can choose. It mostly isn't, and this is where the "PostgreSQL is a CA database" line comes from.

Think about what choosing CA would actually mean. P is not a feature you build. P is a *thing the universe does to you*. "We're not partition tolerant" translates to "we are assuming the network never drops a message," and the network does not care about your assumption. Fibre gets cut. A switch reboots. A GC pause makes a node look dead for eight seconds. Somebody pushes a bad firewall rule.

So: if your data lives on more than one machine that communicates over a network, you will be partitioned eventually, and on that day your system will do one of the two things West did. It will refuse, or it will guess. Which means it was CP or AP all along — you just hadn't found out which yet.

Abadi makes the sharper version of this point: **CA and CP are indistinguishable in practice.** A "CA" system that stops accepting writes when the network breaks is behaving exactly like a CP system. The only genuinely CA systems are the ones that aren't distributed — a single Postgres instance on one machine really is CA, because a single machine has no internal network to partition. Add one streaming replica in another rack and you've now made a choice, whether or not you noticed.

So the practical form of CAP is the only form worth carrying into an interview: **during a partition, does this operation refuse or does it guess?**

---

## The choice only exists *during* a partition

This is the part almost everyone drops, and it's the part that makes CAP usable rather than just quotable.

Partitions are rare. In a well-run single-region deployment you might see one a year. Brewer's own retrospective a decade after his original talk makes exactly this point: CAP "prohibits only a tiny part of the design space — perfect availability and consistency in the presence of partitions, which are rare." The other 99.9% of the time, there is no partition, and **you get consistency and availability both.** Nothing is being traded.

So these statements are wrong, and you hear them constantly:

- *"It's CP, so it's slow."* No. CP says nothing about latency. A CP system on a healthy network answers as fast as its disks and its network allow. (Latency does have a real tradeoff against consistency — it's just not this one. That's [PACELC Theorem](/learn/system-design/pacelc-theorem).)
- *"It's AP, so reads are always stale."* No. An AP system on a healthy network converges in milliseconds and reads are current in every way you'd notice. AP describes what it does when the link breaks.
- *"We chose AP, so we gave up consistency."* You gave up consistency *during partitions*. That's a much smaller thing to have given up, and it's why the choice is affordable at all.

Brewer's framing is more useful than the two-out-of-three one. Treat a partition as a mode your system enters and exits, in three steps: **detect** that a partition has started, **enter partition mode** where you deliberately limit which operations are allowed, and **recover** when the link comes back — reconciling divergent state and compensating for anything you got wrong while you were guessing.

Notice what that last step implies. The AP store's apology email isn't a failure of the design. It's a planned part of it.

<aside class="sd-callout sd-callout--note">



How does a node even know it's partitioned? It doesn't. It has a timeout. Brewer puts it neatly: a partition is a time bound on communication. If the other side doesn't answer within *T*, you declare a partition and enter partition mode. So *you* choose where the line sits — a short timeout means you'll declare partitions during ordinary latency spikes, a long one means you'll block real requests for a long time before deciding anything. There's no way to tell "dead" from "slow" from the outside, and this is the same wall consensus protocols run into.

</aside>

---

## Real systems don't have one answer — they have one per operation

Here's the trap, and it's the single most common way a CAP answer goes wrong in an interview: saying **"I'll use Cassandra because it's AP"** as though AP were a fixed property of the software, like the language it's written in.

It isn't. In every serious distributed store, the C-vs-A behaviour is a **per-request parameter**.

**DynamoDB.** Every read carries an optional `ConsistentRead` flag. Leave it off — the default — and you get an eventually consistent read served from any replica, which stays available even if the partition's leader is unreachable, and costs half as much. Set it to true and you get a strongly consistent read that reflects every prior successful write, which means it has to reach the leader, which means it can fail when the leader can't be reached. Same table. Same client. Two different CAP answers, chosen per call, and the cheap one is the default so you're opted into AP unless you say otherwise.

**Cassandra.** You set a consistency level per statement. The default is `ONE`. Quorum is `(replication_factor / 2) + 1`, so with RF=3 a `QUORUM` write goes to 2 nodes and a `QUORUM` read reads 2. Because `R + W > RF`, those two sets must overlap in at least one node, so the read is guaranteed to see the write. Drop either side to `ONE` and the overlap guarantee evaporates — but now the operation survives losing two of the three replicas.

So our store isn't "a CP system" or "an AP system." It's a set of decisions:

```
browse product page      -> stale is fine, never refuse         -> AP (CL=ONE)
add to cart              -> stale is fine, it's per-user        -> AP (CL=ONE)
read inventory count     -> "about 12 left" is fine             -> AP (CL=ONE)
decrement inventory      -> overselling costs real money        -> CP (QUORUM, or a LWT)
place payment            -> never, ever double-charge           -> CP
```

Four of those five stay up during the fibre cut. One of them refuses. That's the design.

The version of this that shows real judgement is noticing the asymmetry in *cost*: the AP operations are the high-volume ones and the CP operation is the rare one. You can afford a quorum round-trip on the thousand inventory decrements a second. You could not afford it on the million page views.

<aside class="sd-callout sd-callout--warning">



"CP" doesn't mean "correct" either. A CP system under partition returns errors, and errors have to go somewhere. If your checkout flow calls a CP inventory service with no retry, no timeout budget and no queue in front of it, the partition takes down checkout entirely. Choosing C means choosing to handle unavailability in the caller — not choosing to stop thinking about failure. → [Circuit Breakers](/learn/system-design/circuit-breakers)

</aside>

---

## Choosing A means signing up for reconciliation

The fibre cut heals. East says `qty_on_hand = 0`. West says `qty_on_hand = 0`. Both are "right", and together they're wrong — two units left the warehouse and only one existed.

This is the bill for choosing availability, and it comes due at recovery time, not at partition time. You have to decide what the merged state is, and the honest options are a short list:

**Last write wins.** Compare timestamps, keep the newer value, throw the other away. It's one line of code and it is *lossy by construction* — the discarded write was a real customer action. It also depends on clocks agreeing across datacenters, which they don't, exactly. Fine for a user's display name. Not fine for a counter.

**Keep both and let the application decide.** Return the conflicting versions to the caller (Dynamo's original design does this with vector clocks) and let business logic merge them. Amazon's classic example is the shopping cart: union the two carts, and the worst outcome is a deleted item reappearing. That's a much better failure than losing an item.

**Use a data type that can't conflict.** If your operations commute — "add 1", "add to set" — then merging is just applying both, in any order, and there's nothing to resolve. That's what CRDTs are. Counters, sets and registers built this way converge without any application logic at all.

**Compensate.** Accept the double-sale and fix it downstream: cancel the order, refund the customer, restock. This is what most commerce systems actually do, and it's why the operations team exists.

Notice how this reframes the decision. It isn't "consistency versus availability" in the abstract — it's "is refusing this request worse than reconciling it later?" For a cart, reconciliation is trivial and refusal costs a sale. For a payment, reconciliation means a chargeback, and refusing is obviously cheaper. → [Idempotency](/learn/system-design/idempotency)

---

## Where this shows up

- **Multi-region deployments.** Any time data is replicated across regions with active writers on both sides, you own this decision explicitly. DynamoDB global tables make it a configuration choice: multi-Region eventual consistency (the default, AP-flavoured, typically replicating within a second) or multi-Region strong consistency, which replicates synchronously before the write returns.
- **Spanner.** Google's own position is that Spanner is technically CP — partitions do happen inside Google, and when they do Spanner chooses consistency and gives up availability. It just achieves more than five nines, largely by running on a private global network with controlled redundancy, so most teams can treat it as if partitions don't exist. "Effectively CA" is an availability *number*, not an escape from the theorem.
- **Service discovery and membership.** Consul, etcd and ZooKeeper are CP — under partition the minority side stops serving. Gossip-based membership like SWIM is AP — every node keeps answering from whatever it last heard, and different nodes can disagree about who owns what. → [Service Discovery](/learn/system-design/service-discovery)
- **DNS.** The canonical AP system. A record change propagates on TTL expiry and resolvers all over the world disagree in the meantime. Nobody minds, because DNS never refuses to answer. → [DNS](/learn/system-design/dns)

---

## In an interview

Bring it up in non-functional requirements, and name the *operation*, not the system: "checkout needs strong consistency, the product catalogue doesn't." That sentence alone puts you ahead of most candidates.

The two mistakes that cost you: calling something "a CA system," and declaring one CAP stance for your whole design. Both signal that CAP is a memorised triangle rather than a tool.

Expect the pushback "but does this specific read need to be linearizable?" Have an answer per read path — and be honest that most of them don't, because [Replication and Read Consistency](/learn/system-design/replication-and-read-consistency) is usually a cheaper conversation than consensus.

If you say a system is CP, be ready to say what the caller does with the error. If you say AP, be ready to say how conflicts get reconciled when the partition heals. Not having an answer to the second question is how "we'll use last-write-wins" quietly becomes "we lose writes."

---

## Seen in
- 12 - How Uber Actually Does It — Ringpop is explicitly AP: they'd rather serve with occasional errors than refuse
- 10 - Dynamic Resharding and the Shard Index — the same table read two ways, one of which can't tolerate disagreement
- Uber · Requirements and Estimation — different parts of one system getting different guarantees

## Related
[PACELC Theorem](/learn/system-design/pacelc-theorem) · [Replication and Read Consistency](/learn/system-design/replication-and-read-consistency) · [ACID and BASE](/learn/system-design/acid-and-base) · [Transactions and Isolation](/learn/system-design/transactions-and-isolation) · [Consistent Hashing](/learn/system-design/consistent-hashing) · [Availability](/learn/system-design/availability)

## Sources
- [Brewer's Conjecture and the Feasibility of Consistent, Available, Partition-Tolerant Web Services — Gilbert & Lynch, 2002](https://groups.csail.mit.edu/tds/papers/Gilbert/Brewer2.pdf)
- [CAP Twelve Years Later: How the "Rules" Have Changed — Eric Brewer, IEEE Computer / InfoQ](https://www.infoq.com/articles/cap-twelve-years-later-how-the-rules-have-changed/)
- [Problems with CAP, and Yahoo's little known NoSQL system — Daniel Abadi](https://dbmsmusings.blogspot.com/2010/04/problems-with-cap-and-yahoos-little.html)
- [DynamoDB read consistency — AWS documentation](https://docs.aws.amazon.com/amazondynamodb/latest/developerguide/HowItWorks.ReadConsistency.html)
- [Configuring data consistency — Cassandra / DataStax documentation](https://docs.datastax.com/en/cassandra-oss/3.0/cassandra/dml/dmlConfigConsistency.html)
- [Inside Cloud Spanner and the CAP Theorem — Eric Brewer, Google Cloud](https://cloud.google.com/blog/products/databases/inside-cloud-spanner-and-the-cap-theorem)
- [CAP Theorem for System Design Interviews — Hello Interview](https://www.hellointerview.com/learn/system-design/deep-dives/cap-theorem)
