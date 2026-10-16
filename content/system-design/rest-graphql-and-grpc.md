---
title: "REST, GraphQL and gRPC"
summary: "Three ways for one program to ask another program for something. They're less competitors than answers to three different questions, and the interesting part is working out which question you're actually being asked."
stage: 6
stageName: "Talking to clients"
tier: "core"
seq: 44
tags: ["api-design", "rest", "graphql", "grpc"]
---

Three ways for one program to ask another program for something. They're less competitors than answers to three different questions, and the interesting part is working out which question you're actually being asked.

So let's build REST first, find the two places it genuinely hurts, and let GraphQL and gRPC show up as the fixes for those specific pains.

---

## Start with a bookstore

You're writing the backend for an online bookstore. The web app needs to show a book, list its reviews, let someone add it to a cart, and check out.

The obvious way to organise that is around **things**. Books, reviews, carts, orders. Each one gets a URL, and what you do to it goes in the HTTP method:

```http
GET    /books/9781234              -> the book
GET    /books/9781234/reviews      -> its reviews
POST   /carts/me/items             {bookId, qty}
DELETE /carts/me/items/42
POST   /orders                     {cartId, paymentToken}
```

That's REST, and the core move is right there: **the noun is in the URL, the verb is in the method**. You never write `/getBook` or `/deleteCartItem`, because HTTP already has a word for get and a word for delete.

The payoff isn't aesthetic. It's that a whole ecosystem of software already understands those words.

### The verbs carry meaning you get for free

`GET` is *safe* — it doesn't change anything. That single promise is what lets a browser, a CDN or a reverse proxy cache the response without asking your permission first. → [CDN](/learn/system-design/cdn), [Proxies](/learn/system-design/proxies)

`PUT` and `DELETE` are *idempotent* — doing them twice lands you in the same state as doing them once. `POST` isn't.

Watch what that means on a flaky phone network. Retry `DELETE /carts/me/items/42` five times and the cart ends up identical. Retry `POST /orders` five times and the customer just bought five copies. That difference isn't trivia — it's why `POST` endpoints need idempotency keys and `DELETE` endpoints don't. → [Idempotency](/learn/system-design/idempotency)

`PATCH` exists for partial updates, because sending the whole book back just to change its price is wasteful and invites lost updates when two clients do it at once.

### Statelessness is what actually lets you scale

Every request carries everything needed to serve it: the auth token, the resource id, the body. The server remembers nothing between requests.

Try to feel why that matters. A customer's first request lands on server A, their second on server B, and neither server has any idea the other one exists. Nothing breaks. You can add a server and it serves traffic immediately; you can kill a server mid-session and the customer sees one retry at worst. Your load balancer is free to send anything anywhere. → [Load Balancing](/learn/system-design/load-balancing)

Now put the shopping cart in server memory. Suddenly you need sticky sessions, a dying server loses carts, and every scaling decision you make is constrained by where a particular user's memory happens to live. The state doesn't disappear when you make the server stateless — it moves to Redis or the database, where it can be replicated and survive a restart.

That trade comes back later, by the way. The moment you hold a WebSocket open you *have* re-introduced per-server state, deliberately, and you pay the same price. → [Real-Time Server Push](/learn/system-design/real-time-server-push)

### Status codes are an error protocol you don't have to invent

`201 Created` for a new order, `202 Accepted` when you've queued the work and haven't done it yet, `404` for a book that doesn't exist, `409 Conflict` when the cart changed underneath you, `429` when the caller is going too fast.

The split that carries real weight is **4xx versus 5xx**. 4xx means "you sent something wrong, don't bother retrying". 5xx means "it's us, a retry might work". Client libraries, gateways, retry policies and circuit breakers all branch on exactly that distinction, so getting it wrong is worse than it looks — a 500 returned for a malformed request will have clients hammering you forever. → [Circuit Breakers](/learn/system-design/circuit-breakers), [Rate Limiting](/learn/system-design/rate-limiting)

The same goes for `401` versus `403`: "I don't know who you are, log in and retry" versus "I know exactly who you are and no". One is retryable after an action, the other never is.

### HATEOAS, and why almost nobody ships it

There's a maturity model for this, Leonard Richardson's, with four levels. Level 0 is one URL and a blob of XML. Level 1 introduces resources. Level 2 adds the verbs and status codes we just walked through. Level 3 is **HATEOAS**: hypermedia as the engine of application state.

At Level 3, the response tells you what you can do next:

```json
{
  "id": "9781234",
  "title": "Designing Data-Intensive Applications",
  "stock": 3,
  "_links": {
    "self":      { "href": "/books/9781234" },
    "reviews":   { "href": "/books/9781234/reviews" },
    "addToCart": { "href": "/carts/me/items", "method": "POST" }
  }
}
```

The client is supposed to discover the API at runtime by following links, exactly like a person clicking through a website. Move a URL and nothing breaks, because nobody hard-coded it.

In practice almost nothing does this. The client is usually a hand-written app whose developer read your docs, hard-coded the routes and shipped — so the links are ignored, the payload is bigger for no reason, and your server now carries link-generation logic nobody consumes. The one thing HATEOAS buys you, URL mobility, turns out to be worth less than it costs.

Which is fine. **The overwhelming majority of production REST APIs sit at Level 2 and are perfectly good APIs.** Worth knowing the vocabulary, though, because "is your API RESTful?" is a much sharper question once you know there are levels to it.

### Versioning: four options, and one that isn't versioning

Eventually you need to remove a field, rename one, or change what a response means. Someone is depending on the old behaviour.

**Version in the path** — `/v1/books`, `/v2/books`. Ugly, obvious, and by far the most common. Its real advantage is operational: your gateway can route `/v2` to a different service entirely, and you can see the version in every log line. Its cost is that "v2" tends to mean "we redid everything", so migrations stall and you run both forever. → [API Gateway](/learn/system-design/api-gateway)

**Version in a header** — `Accept: application/vnd.bookstore.v2+json`. Purer, keeps URLs stable, and content negotiation is what the header was for. But it's invisible in a browser address bar, easy to forget in a curl command, and it makes your cache key depend on a header you'd better remember to `Vary` on.

**Version in a query parameter** — `?version=2`. Simplest to add, and it fragments your cache the moment two clients use different values.

**Or don't version at all.** Only ever add fields; never remove or repurpose one. Old clients ignore what they don't recognise, new clients get the new field, and nobody migrates. When you truly must remove something, deprecate it, instrument who's still reading it, and delete it when that number is zero.

For a public API you'll usually land on path versioning because everybody understands it instantly. For internal APIs the additive rule is better — and, as we'll see, protobuf makes that rule structural rather than a matter of discipline.

---

## Where REST starts to hurt

Two problems. Both are about **shape**, and neither is fixable with a better REST API.

### Over-fetching: the resource is one size, the screens aren't

`GET /books/9781234` returns the book resource. All of it — title, author blurb, publisher, page count, dimensions, a dozen category tags, the full description, the ISBN variants.

Your search results screen needs three fields: title, thumbnail, price. You shipped several kilobytes to render a couple of hundred bytes.

And you can't fix it by trimming the resource, because the same endpoint feeds the search list, the detail page, an iOS list cell, a partner feed and an internal admin tool. **The resource was designed once; it's consumed by five clients that want five different subsets.** One shape cannot be right for all of them.

### Under-fetching: the N+1 round trip

Now the detail page. You need the book, its author, and the first ten reviews, each with the reviewer's display name.

```
GET /books/9781234           -> has authorId, not the author
GET /authors/88              -> now you can render the byline
GET /books/9781234/reviews   -> ten reviews, each with a userId
GET /users/12                -> ...and ten more of these
GET /users/97
...
```

Thirteen requests. The browser can fire the ten user fetches in parallel, but it can't start *any* of them until the reviews come back, and it can't ask for reviews until it knows the book exists. So you're paying at least three **serial** round trips, and on a high-latency mobile connection serial round trips are exactly what you can't afford.

This is the database N+1 problem, one layer up: one call for the list, then one call per item in it.

### The obvious fix, and why it wears out

Just add an endpoint that returns what the screen needs.

`GET /screens/book-detail/9781234` → book, author, reviews and reviewer names, one round trip, nothing wasted. Both problems solved.

This is a real, respectable pattern — a backend-for-frontend — and plenty of large systems run on it happily. If you have two clients and a dozen screens, stop here. It's the right answer.

It wears out at scale in surfaces. Every new screen needs a new endpoint. Every tweak — "the list cell shows the star rating now" — becomes a backend change, a review, a deploy and a version bump. Your API stops describing your domain and starts describing your UI, and your UI changes weekly.

**The client knows exactly what it wants. It has no way to say so.**

---

## GraphQL: let the client describe the response

GraphQL's whole move is to give the client that language.

There's one endpoint, `POST /graphql`. The client sends a query, and the server returns JSON shaped like the query:

```graphql
query BookDetail {
  book(id: "9781234") {
    title
    price
    author { name }
    reviews(first: 10) {
      rating
      body
      reviewer { displayName }
    }
  }
}
```

One round trip. Exactly those fields, nothing else. The search screen sends a three-field query to the same endpoint and gets three fields back. Over-fetching and under-fetching both vanish, because the response shape is now the client's decision rather than yours.

### The schema is the contract

The server publishes a typed schema, and that schema is enforced, not documented:

```graphql
type Book {
  id: ID!
  title: String!
  price: Money!
  author: Author!
  reviews(first: Int = 10): [Review!]!
}
```

`!` means non-null. `[Review!]!` is a non-null list of non-null reviews. A query asking for a field that doesn't exist is rejected before it executes, and a query asking for `title` is statically known to get a string.

The schema is also **introspectable** — a client can ask the server what types it has. That's where the tooling comes from: editor autocomplete, generated typed clients, an interactive explorer, all derived from the running server rather than from a README somebody forgot to update.

Versioning changes character too. You add fields freely, mark old ones `@deprecated`, and because every query names its fields explicitly you can measure per-field usage in your traces. You know precisely when a field is safe to delete. There's no `/v2`.

### Resolvers do the fetching

Every field has a **resolver** — a function that produces that field, given its parent object.

```
Query.book(id)           -> fetch book 9781234
Book.author(book)        -> fetch user book.authorId
Book.reviews(book)       -> fetch reviews where bookId = book.id
Review.reviewer(review)  -> fetch user review.userId
```

The engine walks the query tree and calls resolvers as it goes. That composability is the appeal: you write `Review.reviewer` once and it works in every query that ever reaches a review, from any direction, without you anticipating the query.

It's also exactly where the bill arrives.

---

## What GraphQL costs you

### The N+1 problem came back, wearing a different hat

Ten reviews come back, so `Review.reviewer` fires ten times. Each call independently runs `SELECT * FROM users WHERE id = ?`. Ask for a hundred reviews and you've issued a hundred and one queries.

The graphql-js docs are blunt about why: each field resolver runs independently, with *"no built-in coordination between resolvers, and no automatic batching"*. And it doesn't even dedupe — five reviews by the same person still means five identical queries.

So we didn't fix N+1. We moved it off the network and into the database, where it's cheaper per hop but far more of them.

**The fix is DataLoader.** You create one per request. Resolvers call `userLoader.load(id)` instead of querying. The loader collects every key requested during a single tick of the event loop, then issues *one* `getUsersByIds([12, 97, 12, 44, ...])`, dedupes the repeats, and hands each resolver its result. Eleven queries become two.

Two details matter. It's **per request**, so the cache is created and thrown away with the query and you can never serve one user's data to another. And it works because resolvers are async — the loader is exploiting the gap between "everyone asked" and "anyone needs an answer".

<aside class="sd-callout sd-callout--warning">

<p class="sd-callout-title">DataLoader isn't an optimisation you add later</p>

A GraphQL server without loaders looks perfectly healthy in development against three rows of seed data, then collapses the first time a real list comes through. Batching is part of the design of a GraphQL server, not a tuning pass.

</aside>

### Caching genuinely gets harder

Here's the part people underestimate.

REST gets HTTP caching for free. `GET /books/9781234` has a URL that *is* a cache key, so the browser cache, the CDN, the reverse proxy and conditional requests with `ETag`/`304 Not Modified` all work without you writing a line of code. → [Caching Strategies](/learn/system-design/caching-strategies)

Every GraphQL request is a `POST` to the same URL with a different body. `POST` isn't cacheable. The URL distinguishes nothing. **Every one of those layers is now dead weight.**

Three things get you most of it back:

- **Persisted queries.** Register your queries at build time and have the client send a hash instead of the text. Now the request can be a `GET /graphql?id=a1b2&variables=...`, which is a URL again, which is cacheable again — and as a bonus, an allowlist.
- **A normalised client cache.** Apollo and Relay store objects by id rather than storing responses, so a later query that mentions a book you already have resolves locally.
- **Cache underneath the resolvers, not above them.** The response to a query is unique and unrepeatable, but `user:12` is the same object for everybody. Put Redis under the data layer, where the reuse actually is.

You can recover most of REST's caching. You just have to build it, and it's work you weren't planning for.

### Query complexity is an attack surface

A REST endpoint's cost is roughly known before anyone calls it. A GraphQL endpoint's cost is chosen by the caller.

```graphql
{ book(id:"1") { reviews { reviewer { reviews { reviewer { reviews { ... } } } } } } }
```

Nothing in the schema forbids that. The graph is cyclic — a book has reviews, a review has a reviewer, a reviewer has reviews — so a query that fits in a tweet can ask for a combinatorial amount of work. One request, one connection, and your database is on the floor.

You want several defences, not one:

- **Depth limiting.** Reject anything nested deeper than N levels. Crude, cheap, and catches the obvious case.
- **Cost analysis.** Give each field a weight, multiply by list sizes (`first: 1000` costs a thousand times `first: 1`), reject queries over a budget. Then bill your rate limits in cost points rather than request counts. → [Rate Limiting](/learn/system-design/rate-limiting)
- **Hard pagination caps.** Whatever `first` the client asks for, clamp it server-side. Always.
- **Persisted query allowlists.** If the only queries that can run are the ones you shipped, arbitrary queries stop being a category. This is why GraphQL is far more comfortable for a first-party app than for a public API.
- **Timeouts and per-request budgets**, so a query that slipped through still can't run forever.

### And some smaller surprises

Errors come back as `200 OK` with an `errors` array, because a query can partially succeed — half the fields resolved, one didn't. Every dashboard you have that alerts on 5xx rate will sit there showing green.

Per-request rate limiting becomes meaningless, since requests vary in cost by orders of magnitude. File uploads aren't native. Each of these is solvable, and the pattern is consistent: **GraphQL moves work out of the protocol and into your server.**

---

## gRPC: when you own both ends

Different problem now. Your checkout service calls your inventory service. It's internal, it's high volume, both sides are yours, both deploy on your schedule, and no browser will ever touch it.

REST and JSON work here too. But look at the bill per call. You serialise a struct into text and the other side parses that text back into a struct. You ship a few hundred bytes of HTTP headers wrapped around a fifty-byte payload. On HTTP/1.1 you either open a fresh connection or wait behind the previous request on a kept-alive one. And the contract between the two teams is a wiki page, so when someone renames a field you discover it in production.

gRPC goes after all three: the encoding, the transport, and the contract.

### Protocol Buffers: the contract is a file

You write the schema first, and it's the source of truth for both sides:

```protobuf
syntax = "proto3";

service Inventory {
  rpc Reserve (ReserveRequest) returns (ReserveResponse);
}

message ReserveRequest {
  string book_id  = 1;
  int32  quantity = 2;
  string order_id = 3;
}
```

Two things to notice.

The encoding is **binary, and field names never go on the wire**. `book_id` travels as field number `1` and a type tag. A JSON document repeats every key in every message; protobuf sends a byte. Payloads shrink substantially and parsing gets substantially cheaper, and when you're doing this tens of thousands of times a second that's CPU and bandwidth handed back to you.

Those field numbers are also the versioning story. Add field `4` and old readers skip it harmlessly. Retire a field and you `reserved` its number so it can never be reused with a different meaning. **The additive discipline we had to enforce by convention in REST is structural here** — the wire format itself enforces it.

### Code generation deletes an entire class of bug

`protoc` compiles the `.proto` into a client stub and a server interface, in whatever language each side happens to be written in. Go server, Python client, same file.

Calling `inventory.Reserve(req)` looks like a local, typed method call. Rename a field, regenerate, and the other team's *build* breaks — which is enormously better than their production breaking at 2am. The contract stopped being a document and became a compiler error.

### HTTP/2 is doing a lot of the quiet work

On HTTP/1.1 a connection carries one request at a time. Six concurrent requests need six connections, or they queue up behind each other.

HTTP/2 **multiplexes**: many independent streams share one TCP connection, chopped into interleaved binary frames, with responses allowed to come back in any order. Headers are compressed with HPACK, so the repeated ones cost a few bytes rather than a few hundred.

For a service making thirty thousand calls a second to a peer, that's the difference between a connection pool you have to tune and a single long-lived channel you mostly forget about. It also means you stop paying TCP and TLS handshakes per request. → [TCP and UDP](/learn/system-design/tcp-and-udp)

<aside class="sd-callout sd-callout--note">

<p class="sd-callout-title">Multiplexing doesn't abolish head-of-line blocking, it relocates it</p>

HTTP/2 removes it at the HTTP layer, but all those streams still ride one TCP connection — so a single lost packet stalls every stream until it's retransmitted. Solving that properly is what HTTP/3 over QUIC is for, and it's why QUIC runs on UDP.

</aside>

### Four call shapes, not one

Because HTTP/2 streams really are streams, a call doesn't have to be one message each way. gRPC defines four lifecycles:

- **Unary** — one request, one response. The ordinary case, and what most of your RPCs will be.
- **Server streaming** — one request, a sequence of responses. "Subscribe to price changes for these SKUs."
- **Client streaming** — a sequence of requests, one response at the end. "Here are fifty thousand location pings; tell me when you've got them all."
- **Bidirectional streaming** — both sides send sequences independently, reading and writing in whatever order they like, over the one connection.

That last one is the nearest thing to a WebSocket that a typed RPC framework offers. It's why systems that started on SSE with a hand-rolled acknowledgement protocol tend to migrate to gRPC — acks just come back up the reverse stream, with flow control included. → [Real-Time Server Push](/learn/system-design/real-time-server-push)

Three more things come in the box and get forgotten. **Deadlines**: the caller states how long it's willing to wait, the deadline propagates to the callee, and the callee can check the time remaining and abandon work nobody is waiting for. **Metadata**: key-value pairs riding alongside the call, which is where auth tokens and trace ids live. **Channels**: the managed connection to a host, with its own connection state and load-balancing policy, which is why gRPC can do client-side load balancing rather than routing through a proxy. → [Load Balancing](/learn/system-design/load-balancing), [Circuit Breakers](/learn/system-design/circuit-breakers)

### Why it isn't your browser-facing API

Browsers can't speak gRPC. Not "it's awkward" — they structurally can't. There's no browser API with fine enough control to force HTTP/2, emit raw frames, or read HTTP trailers, and gRPC needs all three.

`grpc-web` is the workaround: a JavaScript client plus a proxy that translates browser-friendly requests into real gRPC. Envoy ships a `grpc_web` filter that exists for exactly this. It works, and it's a compromise — you get unary and **server** streaming only, no client streaming and no bidirectional. Half the reason you wanted gRPC is unavailable at the one place you'd most want to stream.

Then there's debuggability. The payload is binary, so you can't read it in browser devtools, can't `curl` it, and can't paste it into a bug report. For internal traffic with good tooling that's a fair trade. For an API other people consume, it isn't.

Which gives the usual shape: **gRPC between services inside the perimeter, REST or GraphQL at the edge, and a gateway translating between them.** → [API Gateway](/learn/system-design/api-gateway)

---

## How to choose

**A public API, for developers you've never met.** REST. Not because it's technically superior but because it's the one everybody already knows: `curl` works, devtools work, every language has an HTTP client, and caching and CDNs come free. GraphQL hands strangers a query planner aimed at your database, so you'd need complexity limits, cost-based rate limiting and probably an allowlist before you could launch. gRPC asks your callers to generate stubs before they can say hello.

**A mobile client whose screens keep changing.** GraphQL, and this is the problem it was built for — mobile apps pulling deeply-related data over slow, high-latency links. One round trip instead of a dependent chain, only the fields the screen renders, and a UI change that doesn't need a backend deploy. You own the clients, so persisted queries close the complexity hole cleanly. Budget for DataLoader from day one.

But be honest about the threshold. If you have one or two stable clients, a handful of BFF endpoints does the same job for a fraction of the machinery. GraphQL is a lot of server to stand up for a problem you might not have yet.

**An internal service called ten thousand times a second.** gRPC. Small binary payloads, one multiplexed channel instead of a pool to tune, generated clients on both sides, and a contract that fails at compile time. The debuggability complaint is real and mostly answered with tooling. Losing HTTP caching costs you little here, because service-to-service calls tend to be parameterised in ways HTTP caching couldn't have helped with anyway.

**Something that streams.** Ask who's on the other end. Browser, server-to-client only: SSE. Browser, both directions: WebSockets. Service to service: gRPC streaming, then pick the shape. → [Real-Time Server Push](/learn/system-design/real-time-server-push)

**And the most common real answer is "more than one".** A large system usually has REST at the public edge, gRPC between internal services, and sometimes GraphQL as an aggregation layer for first-party apps. These are layers of one system, not contestants.

Having walked through all of it, the summary is now readable:

| | REST | GraphQL | gRPC |
|---|---|---|---|
| **Payload** | JSON text | JSON text | binary protobuf |
| **Transport** | HTTP/1.1 or 2 | HTTP, one POST endpoint | HTTP/2, required |
| **Response shape** | fixed by the server | chosen by the client | fixed by the schema |
| **Nested data** | one round trip per level | one round trip | one call, or a stream |
| **HTTP caching** | free | effectively none | none |
| **Contract** | docs, by convention | schema, introspectable | `.proto`, compiled |
| **Browsers** | native | native | proxy + `grpc-web`, partial |
| **Streaming** | no | subscriptions, usually over WS | four modes, native |
| **Best fit** | public APIs | varied first-party clients | internal, high volume |

---

## Where this shows up

- **GitHub** runs a REST API and a GraphQL API side by side and documents when to prefer each — REST for simple, cacheable resource reads, GraphQL when you'd otherwise make a dozen calls to assemble one view.
- **Kubernetes** is REST done nearly to the letter: resource-oriented paths like `/api/v1/pods`, versioning in the path (`v1`, `v1beta1`), and a `watch` mode that streams changes instead of making you poll.
- **etcd** publishes gRPC as its primary API and generates a JSON/REST façade from the same `.proto` via grpc-gateway — one contract, two front doors.
- **Envoy** ships a `grpc_web` HTTP filter whose entire purpose is letting browsers reach gRPC backends. The existence of that filter is the clearest possible marker of where gRPC's boundary sits.

## In an interview

Two minutes, not ten — the API style is rarely where the interview actually happens, and lingering signals you're avoiding the hard part.

Say "REST at Level 2 — resources, verbs, status codes, no hypermedia" rather than just "RESTful". It's a more precise claim and it shows you know Level 3 exists and why you skipped it.

If you propose GraphQL, mention N+1 and DataLoader in the same breath, plus how you'll cache and how you'll cap complexity. Those three are the follow-up questions, every single time, and volunteering them is much stronger than surviving them.

The most common mistake is reaching for gRPC on a browser-facing API because it's "faster". The second most common is proposing GraphQL for a public API without a word about complexity limits.

For internal chatty services, gRPC is usually the answer being fished for — but say *why* (binary encoding, HTTP/2 multiplexing, generated contract, deadlines), not just the name.

## Seen in
- Uber · Requirements and Estimation — the API sketched twice, RPC-style and REST, and why REST reads better in the first five minutes
- 12 - How Uber Actually Does It — SSE with a bolted-on acknowledgement protocol, later replaced by gRPC bidirectional streaming

## Related
[API Gateway](/learn/system-design/api-gateway) · [Real-Time Server Push](/learn/system-design/real-time-server-push) · [Caching Strategies](/learn/system-design/caching-strategies) · [TCP and UDP](/learn/system-design/tcp-and-udp) · [Rate Limiting](/learn/system-design/rate-limiting) · [Idempotency](/learn/system-design/idempotency) · [Load Balancing](/learn/system-design/load-balancing) · [Circuit Breakers](/learn/system-design/circuit-breakers) · [CDN](/learn/system-design/cdn) · [Monoliths and Microservices](/learn/system-design/monoliths-and-microservices)

## Sources
- [REST, GraphQL and gRPC — System Design Course (Karan Pratap Singh)](https://www.karanpratapsingh.com/courses/system-design/rest-graphql-grpc)
- [gRPC Core Concepts, Architecture and Lifecycle](https://grpc.io/docs/what-is-grpc/core-concepts/)
- [Solving the N+1 Problem with DataLoader — GraphQL.js docs](https://www.graphql-js.org/docs/n1-dataloader/)
- [Richardson Maturity Model — restfulapi.net](https://restfulapi.net/richardson-maturity-model/)
- [gRPC-Web: why a proxy is required — grpc/grpc-web issue #347](https://github.com/grpc/grpc-web/issues/347)
