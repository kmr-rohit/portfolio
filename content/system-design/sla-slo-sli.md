---
title: "SLA SLO SLI"
summary: "Three acronyms that get taught as a glossary and are much easier to understand as a chain: you measure something, you set a line, you promise the line to someone. Each one is meaningless without the one before it."
stage: 9
stageName: "Reliability and operations"
tier: "useful"
seq: 64
tags: ["reliability", "slo", "error-budget", "latency", "observability"]
---

Three acronyms that get taught as a glossary and are much easier to understand as a chain: you measure something, you set a line, you promise the line to someone. Each one is meaningless without the one before it.

## "Is the site reliable?" is not a question you can answer

You run a ticketing site. Your manager asks whether it's reliable. You say "yeah, it's been fine." That's not an answer, it's a vibe, and next quarter somebody will disagree with you and neither of you will have any way to settle it.

So you make it measurable. You set up a monitor that pings `GET /health` from one box in one region every 30 seconds and alerts if it fails. At the end of the month the dashboard is green: **100% uptime.**

Meanwhile the support inbox has 400 tickets saying checkout is broken.

## Break it: you measured a process, not a user

`/health` returns `200 OK` if the web process is alive and accepting connections. That's all it ever tested. The whole month, the process was alive — and the payment service was timing out, so every checkout returned a 500 after 30 seconds.

Your measurement was technically perfect and completely useless, because it answered a question nobody asked. Worse, it answered it from one machine in one region, so a failure that only affected European users would have been invisible too.

**A metric only counts if a user would notice when it moves.**

## The SLI is the measurement, defined from the user's side

Rewrite the measurement as something a customer would recognise:

> The proportion of `POST /checkout` requests that return a non-5xx response within 500ms, measured at the load balancer, over all valid checkout requests.

That's a **Service Level Indicator**. Note the shape of it, because the shape matters:

```
SLI = good events / valid events
```

Google's SRE Workbook recommends this ratio form specifically: it lands on a 0–100% scale, it's directly comparable across services, and — the part that matters later — it converts trivially into a budget of failures you're allowed.

Four decisions are hiding in that one sentence, and every one of them is a place designs go wrong.

**What counts as a "good" event?** A 500 is clearly bad. Is a 429 you deliberately returned during a load-shed bad? Is a 400 from a malformed client request bad? Usually not — that's a client bug, and counting it makes your SLI move when your service didn't change.

**What counts as "valid"?** Health checks, bot traffic and your own load tests should be excluded or they'll dilute the number until it can't detect anything.

**Where do you measure?** At the server you'll miss the requests that never arrived. At the load balancer you'll catch those but miss DNS and network problems. In the client you'll catch everything and your numbers will include the user's terrible hotel wifi. Each is defensible; pretending the choice doesn't exist isn't.

**What are you measuring, exactly?** The Workbook's categories are worth memorising because they stop you defaulting to "uptime": request-driven services care about *availability, latency and quality*; pipelines care about *freshness, correctness and coverage*; storage cares about *durability*. Pick at most a handful — an SLI per endpoint is a dashboard, not a decision-making tool.

## The SLO is the line you draw through it

The SLI is a number. It doesn't tell you whether to be worried. **The Service Level Objective is the target that makes the number actionable:**

> 99.9% of valid checkout requests succeed within 500ms, measured over a rolling 28 days.

Three parts, all mandatory. The SLI, the threshold, and the **window**. Drop the window and the SLO means nothing — 99.9% over a year and 99.9% over an hour are wildly different promises, and a rolling window behaves very differently from a calendar month that resets your sins on the 1st.

The SLO is internal. Nobody outside the company needs to see it. Its job is to be the thing you argue about *before* an incident rather than during one.

## The SLA is the SLO with consequences attached

An **Service Level Agreement** is what you promise externally, and — this is the whole distinction — what happens when you miss it. The Google SRE book's test is the cleanest one there is:

> "An easy way to tell the difference between an SLO and an SLA is to ask 'what happens if the SLOs aren't met?': if there is no explicit consequence, then you are almost certainly looking at an SLO."

Usually the consequence is money: service credits, refunds, a termination right. Which means your SLA is drafted by people whose job is to limit liability, and your SLO is set by people whose job is to keep users happy. **Your internal SLO should always be stricter than your external SLA.** If you promise 99.9% publicly, target 99.95% internally, so that the alert fires and the fix ships while you still have margin before the refunds start.

So the chain, in one breath: you can't set an SLO without an SLI to measure, and you shouldn't sign an SLA without an SLO you've been hitting for a while.

## Averages lie, and they lie in the direction that flatters you

Your latency dashboard says the average checkout takes 97ms. Everyone relaxes.

Now imagine the actual distribution: 95% of requests complete in 50ms, and 5% take a full second. The mean is `0.95 × 50 + 0.05 × 1000 = 97.5ms`. The dashboard is not wrong. It is just describing a system that nobody experiences.

This is the exact example the SRE book uses — "although a typical request is served in about 50 ms, 5% of requests are 20 times slower" — and the reason averages are dangerous isn't the arithmetic, it's who lives in that 5%. It is not a random sample of your users. Slow requests correlate with big carts, large accounts, rich data and complex queries. **The tail is disproportionately your most valuable customers**, and the mean is specifically designed to hide them.

Percentiles fix it by describing the shape instead of collapsing it:

- **p50 (median)** — what a typical request feels like.
- **p95 / p99** — plausible worst case. The 5% and 1% who are having a bad time.
- **p99.9** — what your heaviest users see on nearly every page, because a user who makes 1,000 requests a day hits their p99.9 daily.

Two practical traps. First, **you cannot average percentiles.** The p99 of server A and the p99 of server B do not average to the p99 of the fleet — you need histograms or a quantile sketch that merges properly. Second, an SLO stated as "p99 latency under 500ms" is harder to reason about than the same thing stated as a ratio: "99% of requests complete under 500ms." They're the same claim, but the ratio form plugs straight into an error budget and the percentile form doesn't.

## A p99 of one call is not the p99 of a page

Here's the effect that makes distributed systems latency genuinely counter-intuitive.

Your checkout page fans out to five backend services — inventory, pricing, fraud, payment, loyalty — in parallel, and renders when all five have answered. Each service has a solid p99 of 100ms. So the page's p99 is 100ms, right?

No. The page is only fast if *every* service was fast. Assume independence:

```
P(all 5 fast) = 0.99^5 = 0.951

→ 4.9% of page loads are slow, not 1%
```

Your five-nines-of-effort backends produced a page whose p95 is the component p99. Now scale the fan-out up:

```
10 services  → 0.99^10  = 0.904  →  9.6% of requests slow
100 services → 0.99^100 = 0.366  →  63% of requests slow
```

That last line is straight out of Dean and Barroso's *The Tail at Scale*: "If a user request must collect responses from 100 such servers in parallel, then 63% of user requests will take more than one second." Even at one-in-ten-thousand slowness per server, a service fanning out to 2,000 servers sees almost one in five user requests exceed a second.

They published measurements from a real Google service to show it isn't a toy model:

```
                             p50     p95     p99
  one random leaf finishes    1ms     5ms    10ms
  95% of leaves finish       12ms    32ms    70ms
  100% of leaves finish      40ms    87ms   140ms
```

The 99th percentile went from 10ms to 140ms purely by waiting for everyone instead of anyone. **Tail latency amplification is why a service composed of fast dependencies is slow.**

<aside class="sd-callout sd-callout--warning">

<p class="sd-callout-title">This is the same multiplication as the availability chain</p>

Fan-out multiplies your slow-probability the way a serial dependency chain multiplies your failure probability. Both come from "everything must go right." If you've already worked through the serial-chain arithmetic in [Availability](/learn/system-design/availability), this is that same argument applied to latency instead of uptime — and it means a composite service can't promise a tighter SLO than its dependencies allow.

</aside>

What you actually do about it:

**Hedged requests.** Send the request to a second replica after a short delay and take whichever answers first. In a Google benchmark reading 1,000 keys spread over 100 servers, hedging after 10ms cut the 99.9th-percentile latency from 1,800ms to 74ms while issuing only 2% more requests. The overhead is small because you only hedge the requests that were already going to be slow.

**Shrink the fan-out.** Batching many keys into one call to each server beats one call per key. Fewer participants, less amplification.

**Make the dependency optional.** If loyalty points can't be fetched in 80ms, render the page without them. A hard timeout with a sane default removes that service from the multiplication entirely — and a circuit breaker makes the timeout cheap once you know the dependency is sick. → [Circuit Breakers](/learn/system-design/circuit-breakers)

**Don't serialise what can be parallel.** Five sequential 100ms calls give you a 500ms floor before any tail effects show up at all.

## Error budgets: what the SLO is actually for

Now the payoff. The SLO isn't a report card. It's a currency.

**Error budget = 100% − SLO.** Your checkout SLO is 99.9% over 28 days, so:

```
28 days = 40,320 minutes
0.1% of that = 40.3 minutes of badness, per window
```

Or, since the SLI is a ratio, express it in requests. Google's Workbook does exactly this: a 99.9% target over four weeks and 3 million requests permits 3,000 failures.

Forty minutes is not a punishment. **It's an allowance you are supposed to spend.** That reframing is the entire point of the concept, and it's what people miss.

Because here's the argument every engineering org has, forever: product wants to ship the new seat-selection feature, SRE says it's risky. Without a budget, whoever is more senior or more tired wins. With a budget, it's arithmetic. Budget remaining? Ship it — that's what the budget is for. Budget spent? Then the next thing that merges is reliability work, and nobody has to have a feeling about it.

This is why 100% is the wrong target. A team with a 100% availability goal can never ship anything, because every deploy risks the goal. **The error budget buys you the right to take risk**, and a budget you never spend is capacity you paid for and didn't use.

The budget's granularity is useful too. A bad deploy that errors for six minutes costs 15% of the window. Google's own example: at a 99.999% target, a problem that fails 0.0002% of queries has consumed 20% of the quarter. That converts "was that incident bad?" from a debate into a subtraction.

**Alert on burn rate, not on errors.** A single failed request tells you nothing. What you want to know is how fast the budget is draining relative to sustainable. Burning at 1x, you'll end the window exactly at your SLO — fine. Burning at 10x, a 30-day budget is gone in three days — page someone now. A fast burn over a short window is a page; a slow burn over a long window is a ticket. This is also the moment load shedding earns its keep: dropping 2% of traffic deliberately can be cheaper, in budget terms, than letting 100% of it time out. → [Rate Limiting](/learn/system-design/rate-limiting)

| SLO (28-day window) | Error budget | Roughly |
|---|---|---|
| 99.9% | 40.3 minutes | one bad deploy |
| 99.95% | 20.2 minutes | one bad deploy, if you roll back fast |
| 99.99% | 4.0 minutes | no human is in this loop |
| 99.999% | 24 seconds | you cannot page anyone; it has to self-heal |

## Don't overachieve either

The less obvious failure mode. Suppose you promise 99.9% and quietly deliver 99.999%. Sounds like a win.

It isn't, and Google learned this the hard way with Chubby, their lock service. Teams observed that Chubby never went down, so they built systems assuming it never would, with no fallback path. When it eventually did fail, it took everything with it. Google's fix was to deliberately synthesise controlled outages so the service met, but did not significantly exceed, its stated objective.

**Your callers build on the reliability they observe, not the reliability you promised.** If you run far above your SLO you've silently signed an SLA you never agreed to, and the day you need to spend budget — a migration, a risky but necessary change — you can't, because half the company is depending on your accidental extra nines.

## Where this shows up

- Cloud provider SLAs pay out in service credits, which is why the published number is always looser than the internal target the team actually runs to.
- Every "we need five nines" requirement dies when someone computes the weekly budget: 6 seconds, which no on-call process can meet.
- Fan-out-heavy products — a search results page, a social feed, a dashboard with twelve widgets — are where tail amplification stops being theory.
- Release freezes triggered automatically by budget exhaustion are how a mature org turns this from a document into a control loop.

## In an interview

Raise it when you're asked for non-functional requirements. "Highly available" is a wish; "99.9% of checkouts succeed under 500ms over 28 days, measured at the edge" is a requirement you can design against, and it sets up every capacity and redundancy decision you make afterwards.

If you quote a latency target, quote a percentile and expect to be asked why. "p99, because the average hides the tail and the tail is our biggest customers" is the answer.

The push you should be ready for is the composition question: you claimed 99.9% for a service that synchronously depends on four others. Either those dependencies are much tighter than your target, or one of them isn't on the critical path, or your number is wrong. Pick one and say it.

The most common mistake is reciting the three definitions and stopping. The idea that carries weight is the error budget as a decision-making tool — that reliability past the SLO has a cost, that the budget exists to be spent on shipping, and that exceeding your SLO creates a dependency problem rather than a safety margin.

## Seen in
- Google Pay · Requirements — 99.99% availability for the tier, and why most failed payments aren't caused by our own downtime
- LinkedIn · The Second Degree Cache — the slowest percentile belongs to members with the biggest networks, who are also the most valuable, so tail latency matters
- Rate Limiter · Requirements — the limiter sits in front of every request, so it gets a budget of under 10 ms added latency, and ideally far less

## Related

[Availability](/learn/system-design/availability) · [Circuit Breakers](/learn/system-design/circuit-breakers) · [Rate Limiting](/learn/system-design/rate-limiting) · [Disaster Recovery](/learn/system-design/disaster-recovery) · [Scalability](/learn/system-design/scalability) · [Load Balancing](/learn/system-design/load-balancing) · [Caching Strategies](/learn/system-design/caching-strategies)

## Sources

- [Google SRE Book — Service Level Objectives](https://sre.google/sre-book/service-level-objectives/)
- [Google SRE Book — Embracing Risk](https://sre.google/sre-book/embracing-risk/)
- [Google SRE Workbook — Implementing SLOs](https://sre.google/workbook/implementing-slos/)
- [Dean & Barroso — The Tail at Scale (CACM, 2013)](https://www.barroso.org/publications/TheTailAtScale.pdf)
