---
title: "Disaster Recovery"
summary: "Availability is about surviving the failures you expect — a disk, a machine, a process. Disaster recovery is about the ones you hope never happen: a datacenter fire, a region-wide cloud outage, a ransomware event, or an engineer running DROP TABLE against the wrong connection."
stage: 9
stageName: "Reliability and operations"
tier: "useful"
seq: 65
tags: ["disaster-recovery", "availability", "backups", "reliability"]
---

[Availability](/learn/system-design/availability) is about surviving the failures you expect — a disk, a machine, a process. Disaster recovery is about the ones you hope never happen: a datacenter fire, a region-wide cloud outage, a ransomware event, or an engineer running `DROP TABLE` against the wrong connection.

Different failures, different playbook. And the playbook starts with two numbers.

---

## The two dials

Everything about a DR strategy follows from these, so get them right before designing anything.

<figure class="sd-figure"><img src="/system-design/diagrams/disaster-recovery.svg" alt="Diagram: Disaster Recovery" loading="lazy" decoding="async" /></figure>

**RPO — Recovery Point Objective.** How much data are you willing to lose? Measured backwards from the disaster, to the last recoverable state. Nightly backups mean an RPO of 24 hours: a disaster at 11pm loses everything since last night.

**RTO — Recovery Time Objective.** How long may you be down? Measured forwards, from the disaster to service restored.

They're independent, and that matters. You can have a five-minute RPO with an eight-hour RTO — you lost almost no data, and it took all day to stand the system back up. You can also have the reverse.

And they're both business decisions, not engineering ones. The question isn't "what's achievable?" It's **"what does an hour of downtime actually cost us, and what does losing an hour of data cost us?"** For a bank those numbers are enormous. For an internal reporting tool they're close to zero, and spending on a hot standby would be waste.

---

## Four strategies, in increasing order of cost

**Backup and restore.** Data goes to durable storage; on disaster you provision new infrastructure and restore. RPO is your backup interval, RTO is hours to days. Cheapest by a wide margin, and completely appropriate for plenty of systems.

**Pilot light.** A minimal version of the environment runs continuously in another region — the database replicating, everything else switched off. On disaster you scale up the dormant pieces. RPO in minutes (replication is live), RTO in tens of minutes.

**Warm standby.** A scaled-down but *running* copy of the full stack in another region, continuously receiving replicated data. On disaster you redirect traffic and scale up. RPO in seconds, RTO in minutes.

**Multi-site active/active.** Both regions serve live traffic. A disaster is a loss of capacity rather than an outage. RPO and RTO near zero — and you're paying for two of everything, plus the genuinely hard problem of multi-region writes and conflict resolution. → [Replication and Read Consistency](/learn/system-design/replication-and-read-consistency)

Most organisations pick different strategies for different systems, and they should. The payments database gets warm standby; the analytics warehouse gets backup and restore.

---

## The backup rules that people learn the hard way

**A backup you have never restored is not a backup.** It's an untested assumption with a filename. Backups fail silently in a dozen ways: the job stopped running months ago, it's been writing zero-byte files, the encryption key is gone, the schema has drifted so far the dump won't load. **The only way to know a backup works is to restore it**, on a schedule, as a real exercise.

**Backups must be isolated from the thing they protect.** Ransomware that reaches your production credentials will encrypt your backups too if they're reachable with those credentials. That's what immutable and air-gapped backups exist for — object-lock storage that cannot be deleted before its retention expires, even by an administrator.

**Replication is not backup.** A replica faithfully reproduces everything, including your `DELETE FROM users` with no `WHERE` clause, in milliseconds. Replication protects against infrastructure failure. Only a point-in-time backup protects against *you*.

The practical shape is full backups periodically, incrementals between, and write-ahead log archiving for point-in-time recovery — so you can restore to 14:32, just before the bad migration.

---

## Failover, and the part everyone forgets

**Failover** is switching to the standby. It sounds like a button and it's a process: promote the standby database, repoint DNS or the load balancer, verify, and watch for what didn't come with you.

Two things reliably bite.

**Split-brain.** If the primary isn't truly dead — just unreachable — you now have two systems accepting writes, and reconciling them afterwards ranges from painful to impossible. This is why automatic failover needs fencing, and why plenty of mature organisations deliberately keep the final promotion manual. → [Clustering](/learn/system-design/clustering)

**Failback is harder than failover.** Once you're running in the standby region, getting back means syncing everything that happened while you were there. Teams rehearse failover and discover failback in production.

---

## Testing, or you don't have a plan

A DR plan that's never been executed is a document, not a capability. The failure modes are mundane and universal: the runbook references a server that was decommissioned, the only person who knows the procedure has left, the standby has drifted out of sync, or the recovery depends on a service that's also down.

**Game days** — scheduled exercises where you actually fail something over — are the only way to find these. Netflix's Chaos Monkey generalised this into continuously killing instances in production, on the theory that a failure you survive daily can't surprise you.

The related discipline is knowing your **dependency order**. If your application can't start without the config service, and the config service can't start without the database, restoring them in the wrong order means a lot of confused debugging during the exact hour you can least afford it.

---

## Where this shows up

- **Regulated industries** — finance and healthcare have mandated RPO/RTO targets and audited DR tests.
- **Major cloud outages**, which periodically remind everyone that a region is a single failure domain.
- **Ransomware response**, where immutable backups are increasingly the only thing standing between an organisation and paying.
- **Uber's state digest**, an unusual angle on the same problem: push trip state to driver phones so a lost datacenter can be reconstructed from the fleet. → 12 - How Uber Actually Does It

---

## In an interview

If you're asked about a region going down, lead with RPO and RTO rather than a technology. "What's the tolerance for data loss and downtime?" is the question that makes the rest of the answer follow, and most candidates jump straight to "multi-region active-active" without asking whether it's worth the cost.

Distinguishing replication from backup is a cheap, high-value point — replicas don't protect you from a bad `DELETE`.

And "we'd test it with scheduled failover exercises" is worth saying. It's the difference between someone who has drawn a DR diagram and someone who has been on call for one.

---

## Seen in
- Rate Limiter · Going Multi-Region — each region counts locally and shares its counts with the others every second or so, so one region's trouble never blocks another's decisions
- Web Crawler · Failure and Restartability — a weeks-long crawl has to survive losing machines, so progress is checkpointed and restartable
- Uber · How Uber Actually Does It — to survive losing a whole datacenter, dispatch pushes an encrypted state digest down to driver phones, which acts as a backup datastore

## Related
[Availability](/learn/system-design/availability) · [Replication and Read Consistency](/learn/system-design/replication-and-read-consistency) · [Clustering](/learn/system-design/clustering) · [SLA SLO SLI](/learn/system-design/sla-slo-sli) · [Storage](/learn/system-design/storage) · [Scalability](/learn/system-design/scalability)

## Sources
- [AWS: Disaster recovery options in the cloud](https://docs.aws.amazon.com/whitepapers/latest/disaster-recovery-workloads-on-aws/disaster-recovery-options-in-the-cloud.html)
- [Google SRE Book: Data Integrity — What You Read Is What You Wrote](https://sre.google/sre-book/data-integrity/)
- [PostgreSQL: Continuous archiving and point-in-time recovery](https://www.postgresql.org/docs/current/continuous-archiving.html)
- [Netflix Technology Blog: Chaos Engineering](https://netflixtechblog.com/the-netflix-simian-army-16e57fbab116)
