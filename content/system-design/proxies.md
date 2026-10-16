---
title: "Proxies"
summary: "Two engineers can both say \"we put a proxy in front of it\" and mean opposite things. One is protecting 5,000 laptops from the internet. The other is hiding twelve app servers from it."
stage: 5
stageName: "How requests arrive"
tier: "useful"
seq: 42
tags: ["networking", "proxy", "reverse-proxy", "service-mesh"]
---

Two engineers can both say "we put a proxy in front of it" and mean opposite things. One is protecting 5,000 laptops from the internet. The other is hiding twelve app servers from it.

Underneath, both boxes do the same thing: make a network request on someone else's behalf. The question that matters is *whose* behalf. The two answers lead to completely different pieces of infrastructure with confusingly similar names.

## Two different problems that ended up with the same word

**Problem one.** You run IT for a company with 5,000 laptops. You need to block known malware domains, keep an audit log of what employees fetch, and stop the network melting on patch Tuesday when 5,000 machines each download the same 4 GB operating system update.

You could try to install and configure software on every laptop. You will not succeed — some are contractors', some are offline for a month, some will have it disabled within a week.

So you do the other thing: configure the network so all outbound HTTP goes through one box on the way out. That box enforces the blocklist, writes the audit log, and caches the update so it crosses the internet once instead of 5,000 times.

That's a **forward proxy**. It acts on behalf of the *clients*. The origin server on the far side never talks to a laptop — it only ever sees the proxy, and has no idea how many people are behind it.

**Problem two.** You run the online bookstore. It's twelve application servers now, plus an image service, plus a search service. You do not want a browser to know any of that. You want one hostname, one TLS certificate, and the freedom to re-shape the backend on a Tuesday afternoon without anyone noticing.

So you put a box in front, and clients only ever learn its address.

That's a **reverse proxy**. It acts on behalf of the *servers*. The client never talks to an origin server — it only ever sees the proxy, and has no idea how many servers are behind it.

Put the two side by side. On the left the proxy sits with the clients; on the right it sits with the servers.

<figure class="sd-figure"><img src="/system-design/diagrams/proxies.svg" alt="Diagram: Proxies" loading="lazy" decoding="async" /></figure>

Notice the arrow points the same way in both pictures. The traffic is client-to-server either way. What moved is the box — and, with it, who deployed it and whose interests it serves.

It's the same software, too. nginx, HAProxy and Envoy will all do either job; you're choosing a config, not a product. Which is exactly why the vocabulary is confusing: "proxy" describes a *position in the path*, not a capability.

## What the forward proxy can still see, now that everything is HTTPS

The company proxy above worked beautifully in a plaintext world. It read the request line, matched the URL against a blocklist, cached the response. Then the web encrypted itself, and the picture changed.

When a browser configured with a proxy wants `https://example.com/report.pdf`, it doesn't send that request to the proxy. It sends `CONNECT example.com:443`, the proxy opens a TCP connection and then blindly pipes bytes in both directions. It's a tunnel. The proxy can see the hostname in the CONNECT line, and the byte counts, and the timing. It cannot see the path, the headers, the cookies or the body — and it can't cache a single thing.

So the blocklist still works at the domain level. The audit log degrades to "someone visited example.com at 14:22 and moved 4 MB". The 4 GB update cache stops working entirely, because the proxy can no longer tell that 5,000 machines are fetching the same object.

Organisations that need more than that do **TLS interception**: install a corporate root certificate on every managed laptop, and have the proxy mint a certificate for `example.com` on the fly and terminate the TLS itself. Now it sees everything again. It also means the company can read every employee's banking session, which is why this is a policy decision long before it's a technical one, and why certificate pinning in mobile apps breaks under it.

There's a cloud-native version of the forward proxy worth knowing, because it turns up in real designs. Your services in a private network need to call a payment provider that only accepts traffic from a small allowlist of IP addresses. Your service instances are ephemeral and their addresses change constantly. So you route all outbound traffic through an **egress gateway** with a stable address, give the provider that one address, and you're done. Same shape as the corporate proxy, different motivation.

## What a reverse proxy actually buys you

The rest of this note is about the reverse proxy, because that's the one that shows up in system design. Here's what it's for, each introduced by the problem it solves.

**TLS termination.** Twelve app servers means twelve copies of your private key and twelve renewal jobs to forget about. Terminate TLS at the proxy and there's one cert, one renewal, and the handshake CPU is spent on the box built for it. → [Load Balancing](/learn/system-design/load-balancing) · [SSL TLS and mTLS](/learn/system-design/ssl-tls-and-mtls)

**Caching.** Your bookstore homepage is rendered from a database query on every request, and it's byte-for-byte identical for every logged-out visitor. At 8,000 requests a second that's 8,000 identical database queries a second to produce the same HTML.

Cache it at the proxy for ten seconds and the origin sees roughly one request per ten seconds for that path. Nothing about the application changed. You did not touch the database.

The subtler win is **request collapsing**. When a cached object expires and a thousand requests for it arrive at once, a naive cache sends a thousand requests to the origin — a stampede at the worst possible moment. A proxy that collapses them forwards exactly one and serves the result to all thousand. The HTTP spec's caching model calls this request collapse, and every serious CDN and reverse proxy implements it. → [Caching Strategies](/learn/system-design/caching-strategies)

**Compression.** gzip or brotli the response once, at the edge, instead of implementing it in every service in every language. Same for decompressing request bodies.

**Request routing.** This is the big one architecturally. The proxy reads the path and sends `/api/*` to the API service, `/search` to the search service, and everything else to the web app. From outside it's still one site.

That's how a monolith gets carved up without a flag day. You stand up a new service, point one path at it, and move on to the next path. Clients never learn that anything changed. → [Monoliths and Microservices](/learn/system-design/monoliths-and-microservices)

**Hiding topology.** The client resolves one name to one address. Behind it you can re-shard, rename, migrate to different instance types, move a service to a different VPC, and none of it is visible. You can also point a path at a static maintenance page when a backend is down, which turns a hard failure into a soft one.

There's a security version of the same property: if the origin servers have no public addresses, an attacker cannot reach them at all without first getting through the proxy. That's the core of what Cloudflare sells — proxied DNS records return a Cloudflare anycast address, never yours, so attacks land on their hardened network instead of your origin.

**Filtering abuse — the WAF.** Now that one box sees every request before the application does, it's the natural place to reject the junk. Signature rules for SQL injection and XSS, bot scoring, request size caps, per-IP and per-key rate limits, slow-request protections.

The argument for doing it here rather than in the app is resource cost. A request rejected by the proxy costs a few microseconds of pattern matching. The same request rejected by your application has already consumed a connection, a worker thread, a database round trip and a JSON parse. Under an attack, that difference decides whether you stay up. → [Rate Limiting](/learn/system-design/rate-limiting)

**Buffering slow clients.** This one is underrated and rarely mentioned. A user on a bad mobile connection takes eight seconds to upload a request body. If that request goes straight to your application server, one of its worker threads is occupied for eight seconds doing *nothing but waiting for TCP*.

nginx's original design point was exactly this: the proxy absorbs the slow read, then hands the application a complete request in one shot over a fast local connection. Your application holds the thread for milliseconds. The same applies in reverse for slow downloads. It's also what makes slowloris-style attacks — deliberately trickling requests to exhaust your thread pool — a non-event.

## What the proxy costs you

It would be strange to list seven benefits and no downsides, so here they are, because two of them are the kind of thing an interviewer probes.

**A hop is a hop.** Every request now crosses one extra network boundary each way, plus parsing and re-serialisation at L7. It's small — sub-millisecond inside a data centre — but it's not nothing, and it's one more thing that can be slow, saturated or misconfigured.

**Buffering fights streaming.** The same buffering that protects you from slow clients will happily hold your server-sent-events stream in a buffer waiting for it to fill. If you've built anything that streams — SSE, chunked responses, long-lived gRPC streams — you have to explicitly turn buffering off for those routes, and discovering this in production is a rite of passage. → [Real-Time Server Push](/learn/system-design/real-time-server-push)

**The client's identity becomes a header, and headers can be forged.** Your application no longer sees the real client IP; it sees the proxy's, with the original in `X-Forwarded-For`. If the application trusts that header blindly, any client can spoof it and defeat your per-IP rate limiting and IP blocklists. The rule is to trust the header only from known proxy addresses, and to take the right entry from a chain that a client may have pre-populated.

**Two HTTP parsers must agree.** The proxy and the backend both parse every request. When they disagree about where one request ends and the next begins — conflicting `Content-Length` and `Transfer-Encoding`, say — an attacker can smuggle a second request inside the first, and the backend will attribute it to whoever's connection comes next. HTTP request smuggling is entirely a product of having two parsers in a row, which is to say it's a proxy-specific bug class.

## So is a reverse proxy just a load balancer?

They overlap so much that people use the words interchangeably, and the interchange is usually harmless. But there's a precise distinction worth being able to state.

**Load balancing is a feature. Reverse proxying is a position.**

A reverse proxy with exactly one backend server is still doing useful work — terminating TLS, caching, compressing, filtering, buffering. A load balancer with exactly one backend is doing nothing at all.

So: every load balancer is deployed in the reverse-proxy position, and load balancing is one of the things a reverse proxy commonly does. The set of reverse proxies is strictly larger.

The sharpest technical line you can draw is at Layer 4. A pure L4 load balancer in direct-server-return or NAT mode doesn't *terminate* anything — it rewrites headers and forwards packets, and the TCP connection is genuinely between the client and the backend. By any reasonable definition that isn't proxying; nothing is speaking on anyone's behalf. An L7 load balancer, which terminates the client connection and opens its own to the backend, unambiguously is a proxy.

Beyond that, the naming is vendor marketing rather than engineering. nginx calls itself a reverse proxy that does load balancing. AWS calls the identical function an Application Load Balancer. Cloudflare calls it a CDN. Kong calls it an API gateway. It's the same box with different feature emphasis and different pricing pages.

## And what about the API gateway?

Same story, one level further along.

Your bookstore is now eight services. Every one of them needs to validate a JWT, enforce a per-customer rate limit, emit a trace span, and write an access log. You very much do not want eight implementations of that, drifting apart, each with its own subtly different bug in token expiry handling.

So you pull it forward into the proxy, and the proxy grows API-shaped features: authentication and authorization, per-key rate limits and quotas, request and response transformation, protocol translation between REST and gRPC, schema validation, API key issuance, usage metering for billing, per-route versioning. Hello Interview's framing is a good one-liner — a single entry point that handles routing, validation, middleware like auth and rate limiting and SSL termination, response transformation, and optionally caching.

**There is no technical boundary here.** An API gateway is a reverse proxy whose feature set was chosen for APIs rather than for web content. It's a point on a spectrum, not a different kind of thing.

| | Acts on behalf of | Does the client know it's there? | The job it exists to do |
|---|---|---|---|
| Forward proxy | the client | yes — it's configured to use it | control, log and cache *outbound* traffic |
| Reverse proxy | the server | no — it looks like the server | present many servers as one, and absorb work they shouldn't do |
| Load balancer | the server | no | spread traffic across healthy backends |
| API gateway | the server | no | cross-cutting API concerns in one place |

The practical version, especially in an interview: don't argue about which word is correct. Draw the box and say what it does. "There's a gateway here doing TLS termination, auth and rate limiting, then routing to services" communicates everything, and nobody can disagree with it. → [API Gateway](/learn/system-design/api-gateway)

<aside class="sd-callout sd-callout--tip">



If an interviewer asks "what's the difference between a reverse proxy and an API gateway", the answer they're testing for is that you know it's a **feature spectrum, not a category boundary**. Confidently claiming a hard distinction is the wrong answer. Saying "same position in the path, different feature emphasis — a gateway is a reverse proxy tuned for APIs" is the right one.

</aside>

## The third position: a proxy next to every process

There's a deployment that breaks the forward/reverse dichotomy in a useful way.

You now have forty services in six languages. You want mutual TLS on every internal call, retries with a budget so a slow dependency doesn't amplify into a retry storm, circuit breaking, outlier detection, and consistent distributed tracing.

Implementing that correctly once is hard. Implementing it six times, in six languages, and keeping the six implementations in agreement forever, is not going to happen. And every policy change becomes a coordinated redeploy of forty services.

**So move the logic out of the process.** Run a proxy — Envoy is the usual one — as a sidecar alongside every service instance, in the same pod. The application makes a plain unencrypted HTTP call to localhost and knows nothing else. The sidecar does service discovery, load balancing, mTLS, retries, outlier detection and tracing.

Envoy's own framing of this is that "the network should be transparent to applications", and the out-of-process design is deliberate: it's language-agnostic, so it works for all six of your languages, and it can be upgraded across the whole fleet without redeploying a single application.

A **control plane** — Istio, Linkerd, Consul, or a managed equivalent — pushes configuration to every sidecar. You change a retry policy or roll out mTLS enforcement fleet-wide by changing one config, and no application team does anything.

Note what a sidecar actually is: for traffic *into* its application it's a reverse proxy, and for traffic *out of* its application it's a forward proxy. The same binary, in both roles, at the same time. If you wanted a proof that "forward" and "reverse" describe position rather than software, that's it.

The costs are real and you should name them. Every service-to-service call now traverses two extra proxies, which adds latency and CPU. Every pod carries the sidecar's memory footprint, which is significant at thousands of pods. Debugging gains layers — when a call fails you now have three places to look. And the control plane is a new, very powerful single point of failure: a bad config push can break every call in the mesh simultaneously.

Those costs are why the current direction of travel is toward getting the per-pod proxy out of the data path — ambient/sidecar-less modes and eBPF-based approaches that handle L4 in the kernel and only use a shared proxy for L7. The idea is unchanged; the tax is being renegotiated.

## Where this shows up

- **Corporate and school networks** — the forward proxy you notice only when it blocks something, doing exactly the filtering-and-logging job it was built for.
- **nginx and HAProxy in front of almost everything** — TLS termination, buffering, static file serving and path routing in front of app servers that were never designed to face the internet.
- **Cloudflare** — a reverse proxy at global scale: proxied DNS returns their anycast IP, so caching, TLS, WAF and DDoS absorption all happen before your origin ever sees a packet.
- **Istio and Linkerd on Kubernetes** — an Envoy or linkerd2-proxy sidecar per pod, turning mTLS, retries and tracing into infrastructure rather than library code.

## In an interview

Almost every design you draw has a reverse proxy in it, whether you label it "load balancer", "API gateway" or "CDN". Name the box once and list what it's doing — that's usually enough.

The high-value move is pulling a cross-cutting concern *forward*. When you notice you're about to describe auth or rate limiting inside five services, stop and put it at the gateway instead. Interviewers notice that.

Expect "why not just let clients hit the services directly?" The answers are: one TLS surface, one place for auth and rate limiting, and the freedom to change the backend topology without a client release.

The common mistake is spending time defending a hard definitional line between reverse proxy, load balancer and API gateway. There isn't one. Say what the box does and move on.

## Seen in
- Rate Limiter · Where the Limiter Lives — the reverse proxy or gateway in front of the fleet is one of the places a limiter can live, weighed against in-process and a sidecar

## Related
[Load Balancing](/learn/system-design/load-balancing) · [API Gateway](/learn/system-design/api-gateway) · [CDN](/learn/system-design/cdn) · [Service Discovery](/learn/system-design/service-discovery) · [Caching Strategies](/learn/system-design/caching-strategies) · [OSI Model](/learn/system-design/osi-model) · [TCP and UDP](/learn/system-design/tcp-and-udp) · [SSL TLS and mTLS](/learn/system-design/ssl-tls-and-mtls) · [Rate Limiting](/learn/system-design/rate-limiting) · [Circuit Breakers](/learn/system-design/circuit-breakers) · [Monoliths and Microservices](/learn/system-design/monoliths-and-microservices) · [Consistent Hashing](/learn/system-design/consistent-hashing)

## Sources
- [Envoy — What is Envoy?](https://www.envoyproxy.io/docs/envoy/latest/intro/what_is_envoy)
- [Cloudflare — How Cloudflare works](https://developers.cloudflare.com/fundamentals/concepts/how-cloudflare-works/)
- [Hello Interview — API Gateway deep dive](https://www.hellointerview.com/learn/system-design/deep-dives/api-gateway)
- [Karan Pratap Singh — Proxy](https://www.karanpratapsingh.com/courses/system-design/proxy)
- [MDN — HTTP caching (shared caches, request collapse)](https://developer.mozilla.org/en-US/docs/Web/HTTP/Guides/Caching)
