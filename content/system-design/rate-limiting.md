---
title: "Rate Limiting"
summary: "One client decides to hammer your API. Maybe it's malicious, maybe it's a retry loop with no backoff, maybe someone left a load test running over the weekend. Either way, everyone else's requests start timing out."
stage: 9
stageName: "Reliability and operations"
tier: "useful"
seq: 63
tags: ["rate-limiting", "reliability", "api"]
---

One client decides to hammer your API. Maybe it's malicious, maybe it's a retry loop with no backoff, maybe someone left a load test running over the weekend. Either way, everyone else's requests start timing out.

Rate limiting is how you make one caller's problem stay their problem.

---

## The naive version, and why it breaks

Say the rule is **100 requests per minute per user**. The obvious implementation is a counter:

```
key = f"rate:{user_id}:{current_minute}"
count = INCR(key)
if count > 100: return 429
```

Simple, cheap, and it's what almost everyone writes first. It's called a **fixed window**, and it has a specific flaw.

<figure class="sd-figure"><img src="/system-design/diagrams/rate-limiting.svg" alt="Diagram: Rate Limiting" loading="lazy" decoding="async" /></figure>

A user sends 100 requests at 12:00:59. The counter for the `12:00` window hits 100 — all allowed. One second later the clock ticks over, the `12:01` counter starts at zero, and they send another 100.

**200 requests in two seconds**, and every counter you looked at said exactly 100. You've enforced the limit as written and completely failed to enforce what you meant. A client that figures this out can sustain double your intended rate indefinitely by aligning to the boundary.

---

## Fixing it exactly: the sliding window log

The problem is that the window is anchored to the clock rather than to *now*. So anchor it to now.

Store a timestamp for every request. When a new one arrives, drop everything older than 60 seconds and count what's left:

```
ZREMRANGEBYSCORE key 0 (now - 60s)
ZADD key now request_id
ZCARD key            → reject if > 100
```

This is exactly correct. There is no boundary to exploit, because there is no boundary.

It's also expensive. You're storing **one entry per request**, so memory grows with your traffic rather than with your user count. At a hundred thousand requests a second, that's a lot of timestamps to hold and expire.

---

## The practical compromise: sliding window counter

Keep two counters — the current window and the previous one — and weight the previous by how much of it is still in view.

If you're 15 seconds into the current minute, then 75% of the previous minute is still inside your 60-second window:

```
estimate = previous_count × 0.75 + current_count
```

Constant memory per user, no boundary exploit, and the arithmetic is trivial.

The catch is in the word *estimate*. It assumes the previous window's requests were spread evenly across it. If they were all clustered in the last five seconds, you'll under-count and allow slightly too many. In practice that error is small and nobody minds, which is why this is what a lot of production limiters actually run.

---

## Token bucket: the one you'll usually want

A different shape entirely, and the most common default.

Picture a bucket that holds up to 100 tokens and refills at a steady rate — say 100 per minute. Every request takes one token. No token, no request.

What makes this different is what happens when a client is *idle*. Tokens accumulate up to the bucket's capacity, so a client that's been quiet for a while can spend them all at once. That's a **burst**, and it's usually what you want: real clients are bursty, and a limiter that smooths every caller to a strict trickle feels broken even when it's technically fair.

Two independent dials fall out of this, which is why it's so widely used:

- **Refill rate** — the sustained throughput you're granting
- **Bucket size** — how much burst you'll tolerate

Set the bucket to 1 and you've built a strict pacer. Set it to 10× the rate and you're only catching sustained abuse.

**Leaky bucket** is the mirror image: requests queue up and drain at a fixed rate. It smooths *output* rather than input, which matters when you're protecting a downstream system that can't handle spikes at all. You pay for it with queueing latency.

---

## Doing this across more than one machine

Everything above assumed one process holding the counter. You have fifty.

**Local counters don't work.** If each of ten instances allows 100, your limit is quietly 1000. And a load balancer spreading requests round-robin means a client's traffic is split across all of them, so no single instance ever sees enough to trip.

**A shared counter in Redis** is the straightforward fix. Every instance does the same `INCR` against the same key, so the limit is global and exact. The price: a network round trip on every request, and Redis is now on your critical path — if it's slow, everything is slow, and you need to decide whether to fail open or closed when it's down. (Fail open, usually. Being unavailable to protect yourself from being unavailable is a poor trade.)

**Local buckets with periodic sync** is the scale answer. Each instance holds a slice of the budget and reconciles with a central store every few seconds. Approximate, occasionally over-permissive during a sync gap, and it removes the hot path dependency entirely. This is roughly what large-scale limiters do.

---

## The decisions around the algorithm

**What do you key on?** User id is the fairest and requires authentication. API key works for machine clients. IP address is what you're left with for anonymous traffic — and it's blunt, because an entire office or mobile carrier can sit behind one address. Most real systems layer several: per-user, per-endpoint, and a global ceiling.

**Not every endpoint is worth the same.** `POST /search` might cost fifty times what `GET /health` costs. A single request-count limit charges them identically. Weighted limits — where an expensive call spends more tokens — fix that, and they're the same token bucket with a variable cost.

**Where do you enforce it?** At the [API Gateway](/learn/system-design/api-gateway) usually, so bad traffic never reaches your services and every service inherits the protection. Per-service when different services need genuinely different rules, or when a service needs to protect a specific downstream.

**What do you tell the client?**

```http
HTTP/1.1 429 Too Many Requests
Retry-After: 30
X-RateLimit-Limit: 100
X-RateLimit-Remaining: 0
X-RateLimit-Reset: 1718900000
```

`Retry-After` matters more than it looks. Without it, a well-meaning client retries immediately and you've turned a rate-limit event into a tight loop. → [Circuit Breakers](/learn/system-design/circuit-breakers)

---

## Rate limiting is not the only lever

It's worth knowing what it doesn't do. Rate limiting is a **per-client** control set from a policy. It doesn't know whether your system is currently healthy.

**Load shedding** is the complement: when a server is overloaded, it drops requests regardless of who sent them, prioritising by importance. A rate limiter says "you've had your share." A load shedder says "I'm drowning."

You want both. A system with only rate limits will happily accept the full permitted load while falling over.

---

## Where this shows up

- **Every public API** — Stripe, GitHub, Twitter all publish their limits and their headers.
- **Login endpoints**, where the limit is a brute-force control rather than a capacity one, and is usually much tighter.
- **Anything in front of an expensive downstream** — a third-party API you pay per call for, or an LLM endpoint.
- **Multi-tenant systems**, where one tenant's batch job must not consume everyone's capacity.

---

## In an interview

Don't just say "token bucket." Walk the fixed-window boundary flaw first — it takes fifteen seconds and it shows you know *why* the better algorithms exist.

The part most candidates miss is the distributed problem. Volunteering "local counters would let ten instances allow ten times the limit, so this needs a shared store — and here's what that costs me" is usually worth more than knowing all five algorithms.

And if you put a limiter in front of something, say what happens when the limiter's own datastore is down. "Fail open" is the right answer for most APIs and it shows you've thought past the happy path.

---

## Seen in
- Rate Limiter · Where the Limiter Lives — local counters on twenty machines each see a twentieth of the traffic, so the limit has to be shared
- Notification System · When Providers Fail — a token bucket per provider, shared across the pusher pool, keeps you under the provider's limit instead of discovering it through 429s
- Web Crawler · The URL Frontier — politeness is a per-host delay, which is rate limiting pointed at the servers you crawl
- BookMyShow · The Flash Sale — why a rate limiter is the wrong tool for a flash sale: dropped requests get retried and there's no fairness

## Related
[Circuit Breakers](/learn/system-design/circuit-breakers) · [API Gateway](/learn/system-design/api-gateway) · [SLA SLO SLI](/learn/system-design/sla-slo-sli) · [Caching Strategies](/learn/system-design/caching-strategies) · [Load Balancing](/learn/system-design/load-balancing) · [Proxies](/learn/system-design/proxies)

## Sources
- [Stripe: Rate limiters](https://stripe.com/blog/rate-limiters)
- [Cloudflare: How we built rate limiting capable of scaling to millions of domains](https://blog.cloudflare.com/counting-things-a-lot-of-different-things/)
- [RFC 6585 — Additional HTTP Status Codes (429)](https://datatracker.ietf.org/doc/html/rfc6585)
- [Envoy: Global rate limiting](https://www.envoyproxy.io/docs/envoy/latest/intro/arch_overview/other_features/global_rate_limiting)
