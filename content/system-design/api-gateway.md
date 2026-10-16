---
title: "API Gateway"
summary: "You've split a monolith into eight services. The mobile app now needs to know where all eight live, authenticate against each one, and handle each one's retries. Every service, meanwhile, has its own copy of the auth middleware."
stage: 6
stageName: "Talking to clients"
tier: "core"
seq: 46
tags: ["api-gateway", "microservices", "architecture"]
---

You've split a monolith into eight services. The mobile app now needs to know where all eight live, authenticate against each one, and handle each one's retries. Every service, meanwhile, has its own copy of the auth middleware.

An API gateway is the single front door that ends both of those problems.

---

## What it looks like without one

<figure class="sd-figure"><img src="/system-design/diagrams/api-gateway.svg" alt="Diagram: API Gateway" loading="lazy" decoding="async" /></figure>

Three clients, four services, and every client talking to every service directly. Count what's being duplicated.

**On the client side:** each app knows every service's address, so a service moving means shipping a new mobile release. Each app implements retries and timeouts. Each app holds credentials for four different services.

**On the service side:** every service parses and validates the same JWT. Every service implements rate limiting. Every service does its own request logging and CORS headers and TLS.

None of that is business logic. It's the same cross-cutting work, written eight times, drifting out of sync.

And there's a security problem underneath: every service is directly reachable from the internet, so your attack surface is the union of eight codebases' authentication implementations.

---

## Putting one box in front

The gateway takes a single request from a client and does the shared work before anything reaches a service:

**Routing.** `/orders/*` goes to the orders service. Clients now depend on a URL shape rather than a topology, so services can move, split or scale without the client noticing.

**Authentication and authorization.** Validate the token once, at the edge. Services behind the gateway can trust an internal header and drop their auth middleware. This is the biggest single win — it takes the most security-critical code and gives it one implementation.

**Rate limiting.** Enforced before traffic reaches anything expensive, and every service inherits it for free. → [Rate Limiting](/learn/system-design/rate-limiting)

**TLS termination.** One place to manage certificates. → [SSL TLS and mTLS](/learn/system-design/ssl-tls-and-mtls)

**Protocol translation.** REST from the browser, gRPC to the services behind. → [REST GraphQL and gRPC](/learn/system-design/rest-graphql-and-grpc)

**Aggregation.** One client call fans out to three services and returns a combined response — which saves the mobile app three round trips over a slow network.

**Observability.** One place that sees every request, so tracing, logging and metrics are consistent rather than per-team.

---

## How this differs from a load balancer and a reverse proxy

These three overlap heavily and the naming is genuinely confusing. The useful distinction is **what the box knows about**.

A **load balancer** knows about *instances*. Its job is picking a healthy one of N identical backends. It doesn't care what the request means. → [Load Balancing](/learn/system-design/load-balancing)

A **reverse proxy** knows about *requests*. It can terminate TLS, cache, compress and route by path. It's still largely indifferent to your application's semantics. → [Proxies](/learn/system-design/proxies)

An **API gateway** knows about *your API*. It knows `/orders` is a resource, that it needs a valid token with the `orders:read` scope, that this client is allowed 100 requests a minute, and that the response should be reshaped for mobile.

In practice the boxes blur — nginx and Envoy can be all three, and most real deployments have a load balancer in front of a gateway. What matters in an interview isn't the taxonomy, it's being able to say which *concerns* live where.

---

## Backend-for-Frontend

One gateway serving a web app, a mobile app and a partner API tends to accumulate conditionals. The mobile app wants small payloads and aggregated calls. The web app wants everything. The partner API wants a stable versioned contract that never changes.

The **BFF** pattern gives each client type its own gateway, owned by the team that owns that client. The mobile BFF aggregates aggressively and trims fields; the web BFF doesn't bother.

The cost is more gateways to operate and some duplicated logic between them. It's worth it when client needs genuinely diverge, and it's premature when they don't.

---

## What can go wrong

**It's a single point of failure.** Everything goes through it, so it has to be replicated and load-balanced itself. That's routine, but it needs saying.

**Business logic creeps in.** This is the real failure mode. It starts as one small transformation, then a conditional, then a calculation — and eventually you have a distributed monolith with a shared component every team must coordinate changes through. The rule that holds up: the gateway may *route, authenticate and shape* requests. It may not *decide* anything about your domain.

**Latency.** An extra hop, usually a millisecond or two. Almost always worth it, occasionally not for very high-throughput internal traffic — which is why internal service-to-service calls often bypass the gateway entirely and use a service mesh instead.

**It can become a deployment bottleneck** if every team needs a gateway config change to ship. Declarative, version-controlled routing config that teams can own their slice of is the usual fix.

---

## Where this shows up

- **Kong, AWS API Gateway, Apigee, Envoy** as dedicated gateways.
- **Kubernetes Ingress**, which is a gateway wearing different clothes.
- **Service meshes** (Istio, Linkerd) handling the same concerns for *internal* traffic via sidecars, while the gateway handles north-south traffic from outside.
- **Netflix's Zuul**, one of the pattern's better-known public write-ups.

---

## In an interview

Draw it as soon as you have more than two or three services and an external client. It's a cheap, obviously-correct move and it gives you one place to hang auth and rate limiting when those come up later.

Be precise about what it does versus what your load balancer does — that's the question you'll get, and the overlap is where people get muddled.

The strong extra point is naming the failure mode unprompted: *"the risk is business logic creeping into the gateway, which turns it into a shared component every team has to coordinate through."*

---

## Seen in
- Rate Limiter · Where the Limiter Lives — the gateway is where the limit check lands, because every external request already passes through it for auth and routing
- BookMyShow · High Level Design — besides auth and rate limiting, the gateway checks the waiting-room admission token for hot shows
- Google Pay · The UPI Rails — the single front door that authenticates the app before anything reaches the payment services

## Related
[Proxies](/learn/system-design/proxies) · [Load Balancing](/learn/system-design/load-balancing) · [Rate Limiting](/learn/system-design/rate-limiting) · [Service Discovery](/learn/system-design/service-discovery) · [Monoliths and Microservices](/learn/system-design/monoliths-and-microservices) · [OAuth 2.0 and OIDC](/learn/system-design/oauth-20-and-oidc) · [REST GraphQL and gRPC](/learn/system-design/rest-graphql-and-grpc) · [SSL TLS and mTLS](/learn/system-design/ssl-tls-and-mtls)

## Sources
- [Microservices.io: API Gateway / Backends for Frontends](https://microservices.io/patterns/apigateway.html)
- [AWS API Gateway developer guide](https://docs.aws.amazon.com/apigateway/latest/developerguide/welcome.html)
- [Envoy: Front proxy architecture](https://www.envoyproxy.io/docs/envoy/latest/start/sandboxes/front_proxy)
- [Netflix Technology Blog: Zuul 2](https://netflixtechblog.com/open-sourcing-zuul-2-82ea476cb2b3)
