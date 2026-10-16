---
title: "Circuit Breakers"
summary: "Most big outages don't start with a service dying. They start with a service getting slow, and everything upstream of it politely waiting."
stage: 9
stageName: "Reliability and operations"
tier: "useful"
seq: 62
tags: ["resilience", "fault-tolerance", "retries", "timeouts"]
---

Most big outages don't start with a service dying. They start with a service getting *slow*, and everything upstream of it politely waiting.

This note covers the whole family of patterns that stop that from spreading: timeouts, circuit breakers, bulkheads, retries with backoff and jitter, and load shedding. They're usually taught as five separate things. They're really five answers to one question — **what do you do when a call is going badly?**

---

## One slow dependency takes down a healthy service

You run the checkout service for an online store. On every checkout it calls a tax service to work out what to charge.

The tax service normally answers in 40 ms. Your checkout handler runs on a pool of 200 threads, and a request spends about 50 ms end to end. So your capacity is 200 threads ÷ 0.05 s = **4,000 requests per second**. You serve 1,200. Comfortable.

Tuesday afternoon the tax service's database picks up a bad query plan. It doesn't fail. It gets slow — calls now take 10 seconds and then succeed.

Run the same arithmetic. 200 threads ÷ 10 s = **20 requests per second**. You are receiving 1,200.

Here's what that looks like second by second. In the first second, 1,200 requests arrive, 200 grab threads and block on the tax call, 1,000 go into the accept queue. Second two: same again, and none of the first 200 threads have come back. By second five, the queue holds thousands of requests, every one of them attached to a user who gave up long ago. Your load balancer's health check can't get a thread either, so it marks the instance unhealthy and shifts its traffic to your other instances — which are in exactly the same state, and now get more load.

Now look at what else broke. `GET /orders/&#123;id&#125;` never touches the tax service. It's a single indexed read that takes 3 ms. It is also failing, because there is no thread available to run it.

**Nothing about checkout is broken.** Its database is healthy, its CPU is close to idle, its code has no bug. What failed is a *shared resource* — the thread pool — being consumed entirely by one dependency. That's the shape of a cascading failure: a local problem becomes a global one because unrelated work shares a pool with the thing that's struggling.

---

## The first fix is the timeout you didn't set

Ask why those threads were stuck for 10 seconds. Because nobody told them not to be.

This is the single most common root cause of a cascade, and it's almost always an accident of defaults. Plenty of HTTP clients ship with **no** read timeout out of the box, or with one measured in minutes. A connect timeout is not a read timeout — the TCP handshake completing tells you nothing about whether the server will ever answer. Connection-pool checkout has its own timeout, and that one defaults to "wait forever" more often than you'd like.

So set one. But set it to *what?*

The wrong instinct is to pick a generous number so you never time out a request that would have worked. The SRE book has an example that kills that instinct: suppose 5% of your requests never complete, and your deadline is 100 seconds. In a server with 1,000 threads, those 5% pile up until they're occupying **5,000 threads' worth of demand** — and you end up serving errors on roughly 80% of traffic, not 5%. Their guidance is blunt: deadlines several orders of magnitude longer than your mean latency are usually a bug.

The right instinct is that a timeout is a **capacity decision, not a correctness one**. Pick it from the latency distribution you actually see — around the p99.9 of healthy responses — and accept that you'll cut off a few slow-but-fine calls. A request you abandon at 150 ms frees a thread. A request you wait 10 seconds for costs you 200× that thread's time and, in the scenario above, still doesn't make the user happy.

One more piece: **propagate the deadline rather than reinventing it at each hop**. If the client gave you 30 seconds and you've burned 7 getting to this point, pass 23 down, not a fresh 30. Otherwise every layer independently decides to keep working on a request the user already abandoned, and your servers spend their capacity computing answers nobody will read. gRPC and most modern RPC frameworks carry a deadline in the request context for exactly this reason.

---

## Timeouts alone still waste your capacity

Set a 150 ms timeout on the tax call and re-run Tuesday.

Better — much better. No thread is stuck for 10 seconds. But look at where you are. You're taking 1,200 requests per second, and every single one of them sits on a thread for 150 ms waiting for a call you *already know* is going to fail. That's 1,200 × 0.15 = **180 threads' worth of pure waiting**, out of 200. You're still nearly saturated, and you're doing it to learn a fact you learned 4,000 requests ago.

And you're doing something worse. You're still sending the tax service 1,200 requests per second while it's on its knees. Whatever it needs to recover — a query plan flush, a cache warm-up, a garbage collection that finally completes — it needs *quiet* to do it. You are denying it that.

**What you actually want is to stop calling it at all for a while.** That's the circuit breaker.

---

## Closed, open, half-open

The breaker sits between your code and the dependency. It watches every call go past, remembers how they went, and when they've gone badly enough it stops letting them through.

<figure class="sd-figure"><img src="/system-design/diagrams/circuit-breakers.svg" alt="Diagram: Circuit Breakers" loading="lazy" decoding="async" /></figure>

**Closed** is normal life. Calls go through, and the breaker records each outcome in a sliding window.

The window matters more than people expect. The naive trip condition is "N consecutive failures", and it's wrong for the common case: a dependency at a steady 30% error rate is badly broken, and will happily go 20 calls without ever giving you five in a row. So trip on a **failure rate over a window** instead. resilience4j defaults to a 50% failure rate over the last 100 calls, and — importantly — refuses to compute a rate until it has seen at least 100 calls, so that two failures at 3 a.m. on a quiet endpoint don't trip anything.

There's a second trip condition that matters even more for our scenario. Remember the tax service never returned an error — it returned correct answers, slowly. A breaker that only counts exceptions never trips. So a good breaker also counts **slow calls**: define "slow" as some duration, and trip if too large a share of calls exceed it. resilience4j exposes this directly as `slowCallRateThreshold`. If you only take one configuration detail from this note, take that one — slowness is the failure mode that actually kills you, and it's the one a naive breaker misses.

**Open** is the interesting state. Calls don't happen. The breaker rejects them immediately, in microseconds, without touching the network and without holding a thread. Your 180 wasted threads go back to zero, `GET /orders/&#123;id&#125;` starts working again, and the tax service gets its quiet. resilience4j waits 60 seconds in this state by default.

**Half-open** is the state people forget, and it's the whole reason this works. After the wait, you have a problem: you have no idea whether the dependency recovered, because you stopped asking. You can't just slam it with 1,200 rps to find out — if it's still fragile, you've knocked it straight over again. So the breaker lets a small, fixed number of **trial calls** through (10, by default) and watches. All succeed, and it closes. One fails, and it goes straight back to open and the wait timer restarts.

That's the mechanism: fail fast while broken, probe gently, and only return to full traffic once the probes come back clean.

<aside class="sd-callout sd-callout--warning">



An open breaker on a dependency you genuinely cannot work without doesn't buy you availability — it converts slow errors into fast errors. That's still worth a lot (your threads come back, your other endpoints live, the dependency gets to recover), but don't claim it as uptime. If checkout truly cannot complete without tax, an open tax breaker means checkout is down, and it should show up that way in your error budget. → [SLA SLO SLI](/learn/system-design/sla-slo-sli)

</aside>

---

## What you return when the breaker is open

A breaker without a fallback is just a faster 500. The design work is deciding what to say instead.

For our store, the tax call has several honest fallbacks. Serve the **last successful rate** for that jurisdiction from a local cache — tax rates change a few times a year, so a rate that's six hours stale is almost certainly right. Or apply a **conservative default** and reconcile the difference asynchronously. Or, for a low-value order, **skip the line item** and eat the cost.

The rule that makes fallbacks work: **the fallback must be cheaper and more reliable than the thing it replaces.** A fallback that makes another network call to a different service is not a fallback — it's a second dependency you haven't tested and probably haven't put a breaker around. Good fallbacks read local memory, return a constant, or return nothing at all.

Which points at the real design decision, made long before the outage: **decide per feature what "degraded" means.** The product page can drop the "customers also bought" panel and still sell the product. The search box can fall back to exact-match instead of the ranked personalised results. Checkout cannot drop payment. Once you've written that list, graceful degradation is just implementing it; without it, every fallback is invented at 3 a.m. by whoever is on call.

<aside class="sd-callout sd-callout--note">



Degraded paths are the least-exercised code in your system, which means they're the code most likely to be broken when you finally need it. The SRE book's suggestion is to run a small subset of servers near overload continuously, so the degradation path is executed every day rather than once a year. A fallback nobody has run in eighteen months is a hypothesis, not a plan.

</aside>

---

## Bulkheads: stop one dependency from eating the whole pool

Go back to the very first failure and notice something the circuit breaker didn't actually fix.

Your checkout service calls five things: tax, inventory, pricing, fraud, and recommendations. All five share the same 200-thread pool. The moment tax got slow — *before* the breaker had seen enough calls to trip — it consumed all 200 threads, and calls to the four perfectly healthy dependencies started failing too. The breaker helps after it trips. The window before it trips is exactly when the damage happens.

The fix is named after ships. A hull is divided into watertight compartments so that a breach in one doesn't sink the vessel. Do the same with your resources: **give each dependency its own pool**, sized to what that dependency actually needs.

```
   before:  [ 200 threads ] ─ tax, inventory, pricing, fraud, recs
            one slow dependency takes all 200

   after:   [ 40 ] tax        ← tax outage caps out here
            [ 60 ] inventory
            [ 40 ] pricing
            [ 40 ] fraud
            [ 20 ] recs
```

Now a tax outage can strand at most 40 threads. Call 41 doesn't queue behind them — it's rejected immediately, which is the point. Recommendations, which is the least important dependency you have, is structurally incapable of taking down more than 10% of your capacity.

There are two ways to build one. **Thread-pool isolation** runs the call on a separate pool; it costs you a context switch per call, but it gives you a real timeout even on client code that ignores timeouts, because you can abandon the task without the dependency's cooperation. **Semaphore isolation** is just a counter — take a permit, make the call on your own thread, release the permit — which is nearly free but can't interrupt a call that's already blocked. Use semaphores for fast in-process work and thread pools for anything that goes over a network. Hystrix offered both; resilience4j's `Bulkhead` (semaphore) and `ThreadPoolBulkhead` mirror the same split.

The same idea scales up past thread pools. Separate connection pools per downstream, so one dependency can't exhaust your database connections. Separate instance groups per tenant, so one customer's traffic spike is contained. Separate queues per message type, so a poison-message backlog on one topic doesn't stall the others. **Any pool shared between a critical and a non-critical consumer is a cascade waiting to happen.**

---

## Retries, and how a blip becomes a self-inflicted DDoS

Now the pattern everyone reaches for first, and the one that does the most damage when it's wrong.

The tax service has a two-second blip — a leader election, a deploy, a GC pause. Requests fail. Your client is configured, sensibly enough, to retry three times.

Watch the arithmetic. You were sending 1,200 rps. Now each of those fails and is retried three times, so the tax service receives up to **4,800 rps** during the exact two seconds it is least able to serve them. The SRE book walks the same escalation: 100 QPS of failures becomes 200 QPS of total traffic, then 300, as fewer and fewer requests succeed on the first attempt.

Then it gets worse, in two ways.

**It layers.** If the gateway retries 3 times, and checkout retries 3 times, and the tax client retries 3 times, one user request can become 27 calls at the bottom of the stack. Nobody designed that. It's the product of three reasonable local decisions.

**It doesn't stop.** The original blip lasted two seconds. But the retry traffic pushed the service above capacity, so requests keep failing, so clients keep retrying, so it stays above capacity. The cause is gone and the outage isn't. This is a retry storm, and the distinguishing symptom is that the service recovers the instant you turn clients off — and falls over again the instant you turn them back on.

### Fix one: back off

Don't retry immediately. Wait, and wait longer each time: `base × 2^attempt`, with a cap. A client that's failed four times is now waiting seconds between attempts, not milliseconds, so the load it contributes collapses.

### Break the fix: everyone backs off in unison

Here's the subtlety. All 500 of your client instances failed at the *same instant*, because they were all talking to the same broken thing. So they all sleep 1 second and retry at the same instant. Then they all sleep 2 seconds and retry at the same instant.

```
no backoff          ████████████████████████████████████
backoff, no jitter  ███       ███              ███
backoff + jitter    ▁▂▁▃▁▂▁▁▂▁▁▃▁▂▁▁▂▁▁▂▁▁▂▁▁▃▁▂▁▁▂▁▁▂▁
```

You've turned a continuous overload into a periodic one. The peaks are still tall enough to knock the service over each time, and now they're synchronised — which is arguably worse, because the service almost recovers and then gets hit again.

### Fix two: add jitter

Randomise the sleep so clients spread out. AWS's write-up gives three formulas:

```
full jitter:         sleep = random(0, min(cap, base * 2^attempt))
equal jitter:        sleep = half + random(0, half)   where half = min(cap, base*2^attempt)/2
decorrelated jitter: sleep = min(cap, random(base, 3 * previous_sleep))
```

Their experiment with 100 contending clients is the part worth remembering: **full jitter cut total client work by more than half** compared with exponential backoff and no jitter, and finished dramatically faster. Full jitter is the default you want unless you have a reason otherwise — and yes, it means a retry can fire almost immediately, which is fine, because on average the fleet is spread evenly across the window.

### Fix three: budget the retries

Backoff controls *when*. You also need to control *how much*.

Cap attempts per request — two or three, rarely more. Add a **server-wide retry budget** so that retries can never exceed some fraction of your normal traffic (the SRE book's worked example is a limit of 60 retries per minute); when the budget is spent, failures are returned to the caller rather than retried. And **retry at exactly one layer of the stack** — pick the layer that knows enough to decide, usually the one closest to the dependency, and make every layer above it pass the failure up untouched.

### Fix four: only retry things it's safe to retry twice

A timeout is ambiguous. You don't know whether the request never arrived, or arrived and succeeded and the response was lost on the way back. Retrying "charge this card" on a timeout is how customers get billed twice.

So: retry reads freely, and retry writes only when the operation is **idempotent** — or make it idempotent first, with an idempotency key the server can use to recognise and collapse the duplicate. → [Idempotency](/learn/system-design/idempotency)

Which errors deserve a retry at all:

- **Yes** — connection refused/reset, 503, 504, and 429 (but see below). These are transient by nature; the same request later may well work.
- **No** — 400, 401, 403, 404, 422. The answer will not change. Retrying a malformed request is pure load with zero chance of success.
- **429 specifically** — retry, but obey the `Retry-After` header rather than your own backoff schedule. The server has told you when it will have room; guessing is strictly worse. → [Rate Limiting](/learn/system-design/rate-limiting)

---

## Load shedding: the same problem from the server's side

Everything so far is the *caller* protecting itself. Load shedding is the *callee* protecting itself, and you need both.

When requests arrive faster than you can serve them, you have two choices: queue them, or refuse them. Queueing feels generous and is usually wrong. A queued request consumes memory, adds latency to everything behind it, and — the important part — is very likely to be a request the client has already timed out on. Serving it is work that produces nothing. The CoDel-style answer is to drop requests that have been waiting longer than the client's patience, because they're guaranteed waste.

So keep queues **short on purpose**. The SRE book suggests a queue no larger than about 50% of your thread count for steady traffic, so that overload turns into fast rejections rather than a growing backlog. Past that threshold, return 503 immediately. A 503 in 1 ms is a far better outcome than a 200 in 40 seconds: the client can fall back, retry elsewhere, or show a useful error, and your service stays alive to serve everyone else.

Shedding gets much better when it's **prioritised**. Stripe's published setup reserves fleet capacity for critical API methods — creating a charge — and sheds non-critical ones like listing charges with a 503 when they exceed their allocation. Their last line of defence sheds by worker utilisation, in descending priority: critical methods, then POSTs, then GETs, then test-mode traffic. Tiering your endpoints by criticality is what turns "we fall over" into "we stop serving the dashboard so we can keep taking payments."

---

## What you'd actually use

**Hystrix** is the one everyone names. Netflix's library bundled circuit breakers, thread-pool and semaphore bulkheads, fallbacks and a real-time dashboard, and it defined the vocabulary the rest of the industry uses. It is **no longer in active development and has been in maintenance mode since 2018**, final release 1.5.18. Netflix's own note says they've moved toward "more adaptive implementations that react to an application's real time performance rather than pre-configured settings", such as adaptive concurrency limits, and points new projects at resilience4j. Name it as history, not as a recommendation — saying "we'd use Hystrix" in an interview dates you.

**resilience4j** is the current JVM answer. Lightweight, functional decorators you compose — `CircuitBreaker`, `Bulkhead`, `RateLimiter`, `Retry`, `TimeLimiter` — with the defaults quoted above. **Polly** fills the same role on .NET.

**Envoy**, and service meshes built on it, do it in the sidecar. Envoy's "circuit breaking" is really a set of bulkheads at the cluster level: max connections, max pending requests, max requests, max active retries. Its **outlier detection** is the breaker-like half, and works at a finer grain — instead of stopping all traffic to a service, it ejects *individual bad hosts* from the load balancing pool on consecutive 5xxs or on statistically anomalous success rate, then lets them back in. Ejection duration grows with repeat offences (`base_ejection_time` × number of consecutive ejections), and `max_ejection_percent` stops it from ejecting so many hosts that the remaining ones collapse.

That last distinction is worth carrying into an interview. **Outlier detection removes a bad instance; a circuit breaker stops calling a bad service.** If three of your twenty tax instances are sick, you want the first — ejecting them fixes the problem entirely and the other seventeen carry the load. If all twenty are sick, you want the second.

The reason meshes are winning here: putting breakers, retries, timeouts and bulkheads in the sidecar means every service gets them regardless of language, and you change a threshold with a config push instead of a recompile and redeploy of forty services.

---

## Where this shows up

- **Any third-party call on a critical path** — payments, geocoding, maps, address validation, tax, fraud scoring. You don't control their capacity or their deploys, and you're usually paying per call, so failing fast saves money as well as threads.
- **Service meshes in production** — Istio/Envoy and Linkerd ship timeouts, retries, outlier detection and connection-pool limits as config, which is why most companies no longer write this code themselves.
- **Mobile and browser clients** — the biggest, least controllable retry fleet you have. A bad retry loop shipped in an app version stays in the wild for months, which is why servers send `Retry-After` and clients should honour it.
- **Fan-out read paths** — a page that calls eight backends to render needs per-backend bulkheads and a per-backend fallback, or the slowest of the eight defines your page latency.

---

## In an interview

Bring it up the moment your design calls something you don't own, or anything with a queue in front of it. "This is a third-party call on the critical path, so I'd put a timeout, a circuit breaker and a cached fallback around it" is one sentence and buys a lot of credit.

The push you should expect is *"what does the fallback actually return?"* Have a real answer — a stale cached value, a conservative default, a dropped optional feature — not "we return an error faster."

The most common mistake is adding retries without backoff, jitter, or an idempotency story. If you say "and we'd retry", say the other three words too.

Second most common: forgetting that slow is worse than down. A dependency that returns errors in 5 ms is survivable; one that returns correct answers in 10 seconds is what takes you offline. Make sure your breaker trips on latency, not just on exceptions.

---

## Seen in
- 02 - Ride Request Flow — the third-party maps/geocoding call is wrapped in a breaker, with straight-line distance × city-average speed as the fallback
- Uber · High Level Design — the same call shown in place on the quote path, cached and breakered

---

## Related
[Rate Limiting](/learn/system-design/rate-limiting) · [Idempotency](/learn/system-design/idempotency) · [SLA SLO SLI](/learn/system-design/sla-slo-sli) · [VMs and Containers](/learn/system-design/vms-and-containers) · [API Gateway](/learn/system-design/api-gateway) · [Service Discovery](/learn/system-design/service-discovery) · [Availability](/learn/system-design/availability) · [Load Balancing](/learn/system-design/load-balancing)

## Sources
- [Google SRE Book — Addressing Cascading Failures](https://sre.google/sre-book/addressing-cascading-failures/)
- [AWS Architecture Blog — Exponential Backoff and Jitter](https://aws.amazon.com/blogs/architecture/exponential-backoff-and-jitter/)
- [resilience4j — CircuitBreaker documentation](https://resilience4j.readme.io/docs/circuitbreaker)
- [Netflix/Hystrix — README and maintenance-mode notice](https://github.com/Netflix/Hystrix)
- [Envoy — Outlier detection](https://www.envoyproxy.io/docs/envoy/latest/intro/arch_overview/upstream/outlier)
- [Stripe Engineering — Scaling your API with rate limiters](https://stripe.com/blog/rate-limiters)
