---
title: "Long-Running Tasks"
summary: "A user uploads a two-hour video and clicks \"publish\". Transcoding takes forty minutes. If your API holds the HTTP request open, the request times out, a deploy kills the worker, and the user stares at a spinner. Some work simply takes longer than a request, and the design has to say so."
stage: 7
stageName: "Async and messaging"
tier: "core"
seq: 57
tags: ["pattern", "jobs", "queues", "workflow"]
---

A user uploads a two-hour video and clicks "publish". Transcoding takes forty minutes. If your API holds the HTTP request open, the request times out, a deploy kills the worker, and the user stares at a spinner. Some work simply takes longer than a request, and the design has to say so.

The pattern is the same whether it's transcoding, report generation, a bulk email, an import, an ML training run or a crawl: **accept quickly, do the work elsewhere, and let the caller ask about progress.**

<figure class="sd-figure"><img src="/system-design/diagrams/long-running-tasks.svg" alt="Diagram: Long-Running Tasks" loading="lazy" decoding="async" /></figure>

---

## The shape

1. **Accept and acknowledge fast.** The API validates the request, writes a **job row** (`jobId`, status `PENDING`, input), enqueues it, and returns `202 Accepted` with the `jobId`.
2. **Work asynchronously.** Workers pull from a durable queue and run the job.
3. **Report status.** The caller polls `GET /jobs/&#123;id&#125;` (or receives a webhook or a push over SSE/WebSocket). The row moves `PENDING → RUNNING → SUCCEEDED / FAILED`.
4. **Make the result retrievable.** Store outputs somewhere durable (object storage) and return a pointer. → [Handling Large Blobs](/learn/system-design/handling-large-blobs)

**Idempotent submit:** accept a client-supplied idempotency key so a retried submit returns the existing job, not a second one. → [Idempotency](/learn/system-design/idempotency)

---

## Workers die; jobs shouldn't

Workers crash, get preempted and get redeployed. Three habits keep the job alive.

- **At-least-once delivery.** If a worker doesn't finish, the queue redelivers. Use a **visibility timeout** or **lease**: a claimed job is invisible for N seconds and returns to the queue if not completed or renewed. → [Message Queues](/learn/system-design/message-queues)
- **Heartbeats.** A long task renews its lease. If heartbeats stop, the job is reclaimed. (Set the lease longer than a normal heartbeat gap, or a slow worker causes duplicate execution.)
- **Idempotent execution.** Since a job may run twice, each step must be safe to repeat. Make outputs a pure function of the task (`videoId/720p/seg_00042`), so a retry or a slow duplicate writes the same bytes to the same key.

---

## Break it into tasks

One monolithic job is slow (it can't use more machines), loses everything on failure, and shows a single status: "running".

Split it into **many small independent tasks**: cut a video at keyframes into segments, each an independent encode; page a crawl into per-host queues; shard a report by date range. Now you can:

- **Parallelise** across the fleet.
- **Retry just the failed piece** (one four-second segment, not two hours).
- **Show progress** (1,240 of 1,500 segments done).
- **Speculate** on stragglers (launch a duplicate of the slowest task, take whichever finishes first; safe because tasks are idempotent).

Some steps depend on others, so the tasks form a **DAG**: inspect → split → fan out → fan in (assemble) → manifest → mark READY. Write the outputs first and the pointer last. → YouTube

---

## Checkpoint, so a restart resumes

A single long-running step (a crawl, a training run, a big import) should periodically save **enough state to continue**: a cursor, an offset, a snapshot. After a crash it loads the latest checkpoint instead of starting over. Make sure the snapshot is **consistent across the pieces of state** that must agree, or you lose or double-process items. → Web Crawler

---

## Who tracks the plan: a workflow engine

Hand-rolled orchestration (a status table, a sweeper, timers) works for simple cases. When you have many steps, retries with backoff, timers ("cancel if unpaid in 30 minutes"), human approvals or compensations, use a **durable workflow engine** (Temporal, Step Functions). Your workflow code survives crashes because every step is recorded in a durable history and replayed. → [Durable Execution and Sagas](/learn/system-design/durable-execution-and-sagas)

---

## Operating it

- **Poison jobs:** cap attempts and send repeats to a **dead-letter queue** for a human, instead of retrying forever.
- **Backpressure and fairness:** one tenant's huge job shouldn't starve everyone else. Use per-tenant queues or shares, and a priority lane for cheap or urgent work.
- **Stuck detection:** a sweeper for `RUNNING` jobs with no recent heartbeat, and metrics on the age of the oldest pending job.
- **Cancellation:** propagate a cancel flag; make tasks check it between steps.
- **Recoverable versus fatal errors:** retry the flaky (timeouts, 5xx), fail fast on the corrupt (a bad frame in the source), and drop a non-essential output rather than failing the whole job.

---

## Scheduling: long-running by time

Jobs that fire later ("send at 9 AM their time", "run nightly") add a **scheduler**: a table indexed by fire time and a poller that claims due rows with `FOR UPDATE SKIP LOCKED`, so several schedulers don't double-fire. Smear the fire time to avoid a thundering herd at exactly 9:00:00. → Job Scheduler

---

## In an interview

Say "202 with a job id, durable queue, idempotent tasks, lease and heartbeat, status endpoint". Then say how big jobs are split into a DAG, how a crash resumes (checkpoint or replay), and how you'd stop one tenant starving the rest.

The trap is holding an HTTP request open, or one giant process with in-memory progress.

## Seen in
- YouTube — the transcoding DAG, stragglers, durable orchestrator, manifest last
- Web Crawler — checkpoints, per-host queues, restartability
- Notification System — a segment resolved into sub-jobs, retries, scheduled sends
- Job Scheduler — leases, heartbeats, retries and the dispatcher
- LeetCode — sandboxed executions as short, isolated jobs
- Price Tracker — scheduled scraping jobs at scale

## Related
[Message Queues](/learn/system-design/message-queues) · [Durable Execution and Sagas](/learn/system-design/durable-execution-and-sagas) · [Idempotency](/learn/system-design/idempotency) · [Event-Driven Architecture](/learn/system-design/event-driven-architecture)
