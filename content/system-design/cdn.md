---
title: "CDN"
summary: "A content delivery network is a fleet of caching servers spread around the world, so that most of what your users download comes from somewhere near them instead of from you."
stage: 5
stageName: "How requests arrive"
tier: "useful"
seq: 43
tags: ["networking", "caching", "cdn", "latency"]
---

A content delivery network is a fleet of caching servers spread around the world, so that most of what your users download comes from somewhere near them instead of from you.

The two things it buys you are different and it's worth keeping them separate in your head: your users get lower latency, and your origin servers stop serving bytes they've already served a million times.

## The problem is distance, and you cannot code your way out of it

You run the online bookstore. One origin, hosted in Virginia. A customer in Sydney loads a product page.

Let's do the physics, because the number is the whole argument. Sydney to Virginia is roughly 16,000 km great-circle. Light in optical fibre travels at about two-thirds of its vacuum speed, call it 200,000 km/s. So 16,000 / 200,000 is about 80 ms one way, and a round trip is about 160 ms — **before** you account for the fact that real fibre routes are not great circles and real packets pass through routers.

That 160 ms is a floor set by physics. No amount of caching, indexing, rewriting in Rust or adding servers in Virginia will reduce it.

Now count how many round trips one page load spends. A DNS lookup. A TCP handshake, one round trip. A TLS handshake, one or two more. Only then does the browser send `GET /books/12345`, and wait another round trip for the first byte.

That's four or five round trips at 160 ms each, and we haven't executed a single line of your application code yet. Your server handling the request in 20 ms is irrelevant — it's rounding error against the network.

**The obvious fix is to put a copy of the whole system in Sydney.** Now you own a distributed database, cross-region replication, a consistency model and a deployment pipeline that has to keep two regions in step — a genuinely large project. → [Replication and Read Consistency](/learn/system-design/replication-and-read-consistency)

And when you look at what the page actually downloaded, most of it doesn't justify any of that. The HTML is 40 KB. The images, CSS, JavaScript and fonts are 2 MB, they're byte-for-byte identical for every user on earth, and they change when you deploy, which is weekly. That content has no consistency requirements worth speaking of.

## Put the bytes near the user, not the application

So don't move the application. Move the *bytes*.

A CDN operates points of presence — data centres, hundreds of them, in most major cities. You point your asset hostname at the CDN, and the Sydney customer's request terminates at a Sydney PoP maybe 10 ms away instead of 160 ms away.

Look at what that does to the round trips we counted. The TCP handshake and the TLS handshake now cost 10 ms each instead of 160. **That win happens even on a cache miss**, which is the part people miss. The connection setup is local regardless, and the edge-to-origin leg runs over a connection the CDN keeps warm and pooled across the provider's own backbone, which is usually a better path than the public internet would have found.

Then the caching win stacks on top. The second Sydney user to want that image gets it from 10 ms away with no origin involvement at all.

And the third win is the one your finance team notices: your origin stops serving 2 MB per page view. If your hit rate is 95%, your origin bandwidth drops by roughly that much, along with the server capacity you were spending on it. **This win applies to users right next door to the origin too** — offload is not a latency feature.

## How does a request find the nearest edge?

The CDN has 300 locations. The user's browser knows one hostname. Something has to map one to the other, and there are two mechanisms in use.

**DNS-based routing.** The CDN runs authoritative DNS for `cdn.example.com` and answers each query with an address near whoever asked. Simple, works everywhere, needs nothing from the network.

The flaw is in "whoever asked". The CDN's nameserver sees the *recursive resolver's* address, not the user's. If your Sydney customer uses a public resolver whose nearest node happens to be somewhere else, the CDN optimises for the wrong location and sends them to the wrong continent. EDNS Client Subnet partially fixes this by letting resolvers pass along a truncated client subnet, but it's opt-in and not universal. DNS also inherits the TTL problem: taking a sick PoP out of rotation means waiting for caches to expire, and some of them won't. → [DNS](/learn/system-design/dns)

**Anycast.** Announce the same IP address via BGP from every PoP simultaneously, and let internet routing deliver each packet to whichever announcement is closest in routing terms. The client does nothing special; there's one address and it just works. Cloudflare's whole network is built this way — proxied records return an anycast address rather than your origin's.

Failover is the real advantage. Taking a PoP out means withdrawing a route, which propagates in seconds and doesn't ask a single cache to expire anything. It also spreads a volumetric DDoS across the entire network by construction, since attack traffic lands at whichever PoP is nearest each attacker rather than converging on one target.

The catch is that BGP optimises for AS-path length, not latency, so "closest" is a routing opinion and occasionally a wrong one. And a routing change mid-connection can move packets to a PoP with no state for that TCP connection, which breaks it — rare in practice, and connection-migration protocols like QUIC make it rarer.

## Push or pull?

Once the request arrives at an edge, how did the content get there?

**Pull.** The first request for an object at a given PoP is a miss. The edge fetches it from your origin, stores it, and serves everyone else from the copy. You configure the CDN once and never think about it again; content appears where it's needed, driven by demand.

The cost is that the first user at each of 300 PoPs pays origin latency, and after a deploy or a purge you may have 300 cold caches all reaching for your origin at once.

**Push.** You upload objects to the CDN as part of your deploy. The edge always has it, so nobody pays for a cold miss. You also pay to store everything everywhere, including in the 280 locations nobody in that region will ever request it from, and you own the job of remembering to push.

Pull is the default for basically all web content — it's self-managing and it scales to a catalogue you can't enumerate. Push earns its keep for large media where a cold miss is genuinely unacceptable: video libraries, game patches, software releases where you know the event is coming and can warm the cache in advance.

## Cache-Control is the contract

Here's the part people skip and then get paged for. **Who decides how long an edge keeps a copy? Your origin does, in the response headers.** If you don't send them, the CDN applies defaults, and you have delegated a correctness decision to a vendor's default.

The headers that matter:

`max-age` sets freshness in seconds. `s-maxage` does the same but *only* for shared caches like the CDN, overriding `max-age` for them. Split these deliberately: give browsers a short `max-age` and the CDN a long `s-maxage`, because **you can purge the CDN and you can never purge a browser**.

`public` versus `private` is the one that causes incidents. `private` means a browser may store this, but a shared cache must not. Get that wrong on a logged-in account page and the CDN will cheerfully serve Alice's order history to Bob. This is a well-worn class of outage and it's always the same root cause.

`no-store` and `no-cache` sound identical and aren't. `no-store` means don't keep a copy at all. `no-cache` means *do* keep a copy, but revalidate with the origin before serving it — which is much more useful than it sounds, because revalidation costs one round trip and no bytes.

`ETag` with `If-None-Match` is how revalidation works. The origin tags the response; the cache sends the tag back next time; the origin replies `304 Not Modified` with an empty body if nothing changed. You pay the round trip, you don't pay the megabytes.

`Vary` extends the cache key with the listed request headers. `Vary: Accept-Encoding` is normal and correct. `Vary: User-Agent` is a disaster, because there are effectively unbounded user-agent strings and you've just fragmented your cache into thousands of near-duplicate entries. Varying on `Cookie` is usually a sign you should have marked the response `private`.

`stale-while-revalidate` is the quiet hero. It lets the cache serve the expired copy immediately while fetching a fresh one in the background. The expiry stops being a latency spike for the unlucky user who hits it.

`immutable` tells the browser not to even revalidate on a reload, which only makes sense alongside content-hashed filenames.

In practice you end up with two shapes:

```http
# Content-hashed asset: the URL changes when the bytes change,
# so it can be cached effectively forever, everywhere.
GET /static/app.9f3c1a.js
Cache-Control: public, max-age=31536000, immutable

# HTML: URL can't change, and it's the thing that
# points at the new asset names. Keep it on a short leash.
GET /books/12345
Cache-Control: public, max-age=0, s-maxage=60, stale-while-revalidate=300
ETag: "a1b2c3"
```

## Invalidation, and the strategy that avoids it

You've just discovered the product image for book 12345 is wrong. It's cached at 300 edges with a one-day TTL. Now what?

**Purge.** Call the CDN's API and tell it to drop the object. You can purge a single URL, purge by surrogate key or cache tag — tag every object that embeds a product's data with `product-12345` and drop them all in one call, which is by far the most useful form — or purge everything.

Purging everything during peak traffic is a genuinely dangerous operation. You have just told 300 PoPs that they have nothing, and they will all turn to your origin at once. People do this reflexively during an incident and turn a cosmetic bug into an outage.

Purge also does nothing about the copies in browsers. Those will keep serving the wrong image until their own `max-age` expires, and you have no way to reach them.

**Versioned URLs.** Name the file after a hash of its contents: `app.9f3c1a.js`. Change the contents, the name changes, and the new name is referenced from the HTML — which you kept on a short TTL precisely so it could do this job. Nothing needs invalidating. The old object simply stops being requested and ages out on its own.

AWS recommends versioning over invalidation for frequently-updated files, and their reasoning is worth borrowing wholesale. Versioning also fixes the copy in the user's browser and in any corporate proxy in between, which invalidation cannot touch. It makes access logs interpretable, since you can see which version served which request. It makes rollback trivial. And it's cheaper, because invalidation requests are billed and re-fetching new objects isn't.

<aside class="sd-callout sd-callout--warning">



"We'll just purge the cache" is an answer that sounds decisive and is usually the weaker one. The strong answer is **content-hashed URLs for assets, short TTLs plus revalidation for HTML, and tag-based purge reserved for the semi-static middle** — product images, avatars, user-generated content. If you find yourself needing frequent purges, your cache key or your TTL tier is wrong.

</aside>

## TTL is three decisions, not one

There is no single right TTL, because your content isn't one kind of thing. Sort it into tiers.

**Content-hashed static assets** — JS, CSS, fonts, anything with a hash in the name — get a year, `public` and `immutable`. There is no risk, because a change produces a different URL.

**Semi-static content** — product images, avatars, uploaded documents, generated thumbnails — get hours to a day, tagged, with purge on change. These have stable URLs that can be reused, so you need an invalidation path.

**HTML and API responses** get seconds, or `no-cache` with an `ETag` so every request revalidates cheaply. Even a 5-second TTL on a hot page is a 40,000× reduction in origin load at 8,000 requests per second, which is the point that surprises people.

Two refinements. **Jitter the TTLs** so a batch of objects cached together doesn't all expire on the same second and stampede your origin together — same reasoning as any other cache. → [Caching Strategies](/learn/system-design/caching-strategies)

And be careful with very short TTLs. Below about a minute, the edge is revalidating so often that you're paying origin round trips on a large share of requests and the caching is barely earning anything. There's a billing consequence too: CloudFront counts `GET`s with a TTL under 3,600 seconds as dynamic requests for Origin Shield pricing. `stale-while-revalidate` is usually the better tool than a very short `max-age` — you get freshness without making users wait for it.

## Origin shield

Here's a failure mode that only appears at CDN scale.

One popular object, TTL just expired, requests arriving at all 300 PoPs. Each PoP independently misses and fetches from your origin. Your origin receives 300 requests for the same object, at the same moment, and this repeats every TTL period. Now imagine a live stream producing a new segment every four seconds, where every segment is a cold object by definition.

**The fix is a tier in the middle.** Instead of 300 PoPs each talking to your origin, they all talk to one designated cache which talks to your origin.

CloudFront actually has two such tiers. Regional edge caches sit between edge locations and the origin by default, consolidating requests within a geography. Origin Shield is an additional, optional layer you enable in a single region — and the key property is that *all* requests from *all* caching layers funnel through it. AWS's own phrasing is that requests for content not in Origin Shield's cache "are consolidated with other requests for the same object, resulting in as few as one request going to your origin."

You put the shield in whichever region is closest to your origin, so the long haul rides the CDN's backbone rather than the public internet.

The multi-CDN case is the other strong motivation. If you're running two CDNs for redundancy or for negotiating leverage, your origin is getting duplicate requests from both. Pointing the second CDN at the first, with a shield enabled, gives you one origin-facing surface, one cache key, and one place to configure origin-facing behaviour.

AWS is refreshingly direct about when *not* to bother: dynamic content proxied to the origin, content with low cacheability, and content that's rarely requested. A shield only helps when there's duplication to collapse.

## What belongs on a CDN, and what doesn't

**Yes, obviously:** images, video segments, CSS, JavaScript, fonts, PDFs, installers — anything with a stable URL, no per-user variation, and a size worth not sending across an ocean twice.

**Be deliberate:** anything behind authentication. It's not impossible — you can include a tenant identifier in the cache key, or use signed URLs — but you need a reason and a plan, not a default.

**No:** writes. `POST`, `PUT`, `PATCH` and `DELETE` get proxied through to origin and are never cached, which is correct and also means the CDN is doing nothing for them except the connection-termination win.

The failure mode to name explicitly, because it's the worst one: **caching a response that carried a `Set-Cookie` header.** The CDN stores the response including that header and hands it to the next visitor, who is now logged in as somebody else. Every serious CDN has guardrails against this; people still manage it, usually by overriding cache behaviour in a rule and not thinking about which responses the rule catches.

And one nuance that's worth getting right, because it's the thing people reason about backwards. **"Dynamic" is not the same as "uncacheable".** A product page that's regenerated hourly and identical for every logged-out visitor is enormously cacheable — an hour is an eternity. A tiny JSON endpoint returning the viewer's unread count changes rarely but is different for every user, and is nearly uncacheable in a shared cache.

What kills shared cacheability is **per-user variation**, not rate of change. Ask "how many distinct users could be served this exact response?" first, and "how often does it change?" second.

## Dynamic content and edge compute

So what does a CDN do for the requests it can't cache at all?

More than nothing. TLS terminates 10 ms away instead of 160 ms away, which removes several round trips from every connection. The edge-to-origin leg runs on a pooled, already-established connection over the provider's backbone. Providers sell this as dynamic site acceleration, and the gain is real even at a 0% hit rate.

**Edge compute** goes further: run your own code at the PoP. Cloudflare Workers, CloudFront Functions and Lambda@Edge, Fastly Compute. The uses that actually pay off are the ones that let you keep caching something you otherwise couldn't:

- Assign an A/B bucket at the edge and fold it into the cache key, so each variant is cached rather than the whole page becoming uncacheable.
- Check a signed token and reject unauthorised requests before they cross an ocean.
- Rewrite headers, normalise the cache key, strip tracking query parameters that would otherwise fragment your cache.
- Do redirects and geo-routing without a round trip to origin.
- Stitch a cached page shell together with a small personalised fragment.

The constraints are what stop this from being "just run the whole app at the edge". Execution budgets are tiny — milliseconds of CPU, small memory. There's no real local state; the edge KV and durable-object offerings are either eventually consistent or homed in one place, which means a write is a long-haul call again. And if your code needs the database, you've moved the compute 150 ms away from its data, which usually makes things worse rather than better.

One concrete wrinkle worth knowing: with Origin Shield enabled, Lambda@Edge origin-facing triggers run in the Origin Shield region rather than near the viewer. Viewer-facing triggers still run at the edge. Edge compute isn't uniformly "at the edge" — it depends which event you hooked.

## Where this shows up

- **Every large website you use** — the HTML comes from the origin, and the several megabytes of images, JS and fonts around it come from Cloudflare, CloudFront, Fastly or Akamai.
- **Video streaming** — HLS and DASH chop a stream into short segments with stable URLs, which is exactly the shape a pull CDN is best at; origin shield exists in large part for live streams where every segment is cold.
- **Software distribution** — OS updates, container image layers, package registries. Content-addressed by hash, so the URL *is* the version and caching is free of invalidation entirely.
- **DDoS absorption** — an anycast CDN in front of an origin with no public address means attack traffic disperses across hundreds of PoPs and never reaches you.

## In an interview

Bring it up as soon as your design serves images, video, or a web front-end. "Static assets go on a CDN" is a one-liner that costs nothing and is expected.

Say *why*, though — and give both reasons, latency and origin offload. Most candidates give only the first.

Expect to be pushed on invalidation. The answer is content-hashed URLs for assets and tag-based purge for the semi-static middle, with HTML on a short TTL so it can point at the new names.

Expect "what about dynamic or personalised content?" The good answer separates rate of change from per-user variation, and notes that even uncacheable requests benefit from edge TLS termination and a warm backbone path.

The most common mistake is treating a CDN as a static-file bucket and stopping there. The second is saying "we'll purge on every update" without noticing you've built a system whose correctness depends on a fleet-wide operation that can stampede your origin.

## Seen in
- PasteBin · Serving Pastes with a CDN — immutable pastes are the easy case: cache at the edge, backfill from object storage on a miss
- YouTube · CDN Economics and View Counts — at hundreds of Gbps the CDN is the dominant cost, and popularity decides which videos are worth pushing to the edge
- BookMyShow · The Read Path — versioned, immutable seat-layout URLs let the CDN and browser cache them forever with no invalidation
- URL Shortener · Caching Hot URLs — a redirect is tiny and cacheable, but revocation is what makes edge caching awkward
- Google Drive · Syncing Changes — every device fetching the same new chunks at once is exactly the burst a CDN in front of S3 absorbs

## Related
[Caching Strategies](/learn/system-design/caching-strategies) · [DNS](/learn/system-design/dns) · [Proxies](/learn/system-design/proxies) · [Load Balancing](/learn/system-design/load-balancing) · [Storage](/learn/system-design/storage) · [OSI Model](/learn/system-design/osi-model) · [TCP and UDP](/learn/system-design/tcp-and-udp) · [Availability](/learn/system-design/availability) · [Scalability](/learn/system-design/scalability) · [Rate Limiting](/learn/system-design/rate-limiting)

## Sources
- [MDN — HTTP caching](https://developer.mozilla.org/en-US/docs/Web/HTTP/Guides/Caching)
- [AWS — Use Amazon CloudFront Origin Shield](https://docs.aws.amazon.com/AmazonCloudFront/latest/DeveloperGuide/origin-shield.html)
- [AWS — Invalidate files to remove content](https://docs.aws.amazon.com/AmazonCloudFront/latest/DeveloperGuide/Invalidation.html)
- [Cloudflare — How Cloudflare works (anycast, proxied DNS)](https://developers.cloudflare.com/fundamentals/concepts/how-cloudflare-works/)
- [Cloudflare — Cache-Control interpretation](https://developers.cloudflare.com/cache/concepts/cache-control/)
- [Karan Pratap Singh — Content Delivery Network](https://www.karanpratapsingh.com/courses/system-design/content-delivery-network)
