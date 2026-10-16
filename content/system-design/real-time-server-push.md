---
title: "Real-Time Server Push"
summary: "The server has something to say and the client isn't asking. HTTP was designed the other way round, so you need a mechanism."
stage: 6
stageName: "Talking to clients"
tier: "core"
seq: 45
tags: ["websockets", "sse", "long-polling", "push", "real-time"]
---

The server has something to say and the client isn't asking. HTTP was designed the other way round, so you need a mechanism.

There are four, they trade off differently, and every one that holds a connection open creates a problem people forget about until it bites them.

---

## The options

**Short polling.** The client asks every N seconds. Dead simple, completely stateless, any server can answer. Latency is up to N seconds, and you're paying for a full request cycle every time to mostly be told "nothing."

**Long polling.** The client asks, and the server holds the request open until it has something or a timeout fires. Latency drops to near-zero. Still stateless-ish, still easy to failover. But you're still paying full HTTP headers and an auth check on every cycle.

**Server-Sent Events.** One persistent connection, and the server streams down it. Minimal per-message framing after the handshake. Built-in auto-reconnect, proxy-friendly, works over plain HTTP. The limitation: it's **server-to-client only**. If the client also needs to send things frequently, you're maintaining a second channel.

**WebSockets.** One persistent connection, **bidirectional**, minimal framing in both directions. Everything SSE gives you plus the upstream.

**Push notifications** (APNs, FCM) aren't really in the same category — they're how you reach an app that isn't running at all. Latency in seconds, and they typically just wake the app so it can reconnect and pull state.

---

## How to choose

The question that usually settles it: **does the client also send frequently?**

If yes, take WebSockets. One connection carries both directions.

If it's server-to-client only and you're already on an HTTP+JSON stack, SSE is simpler and proxies better. You will have to build acknowledgements yourself if you need them.

If updates are rare and a few seconds of latency is fine, just poll. Stateless is a real feature and there's no prize for complexity.

And if the app might be backgrounded or killed, you need push notifications regardless of what else you choose.

### The overhead argument, with numbers

The strongest case for a persistent connection usually isn't latency — it's framing cost.

If a client sends a 30-byte message every five seconds, and each one carries 500–800 bytes of HTTP headers plus an auth check, then **the envelope costs more than twenty times the letter.** Multiply by a few million clients and you're spending your network budget on ceremony.

This isn't hypothetical. Before Uber built a push platform, **80% of requests to their backend API gateway were polling calls** — clients repeatedly asking "anything for me?" and being told no.

---

## Long polling, up close

The mechanic is simple. The client sends a request and the server doesn't answer it. It *parks* the request — holds the socket, registers a callback — and replies only when it has something, or when a timeout fires after twenty or thirty seconds. The client reads the response and immediately sends the next request.

From the client's side this looks like an ordinary HTTP call that happened to be slow. That's the whole appeal: no new protocol, no upgrade, no special support anywhere along the path. → [Proxies](/learn/system-design/proxies)

### The gap

Here's what people miss. Draw the timeline.

<figure class="sd-figure"><img src="/system-design/diagrams/real-time-server-push.svg" alt="Diagram: Real-Time Server Push" loading="lazy" decoding="async" /></figure>

Between the moment the server flushes a response and the moment the next request arrives, **the client is not connected to anything**. That's a few milliseconds on a good network and a few hundred on a bad one, and it happens after *every single message*. A busy stream reconnects constantly, which is another way of saying a busy stream is disconnected constantly.

If your handler's logic is "when an event fires, find this client's parked request and write to it", then an event landing in that window finds nothing parked and gets dropped. Silently.

That's a horrible bug to own, because it's load-dependent. A quiet system never hits it. It gets steadily more likely exactly as traffic grows.

### Closing the gap with a buffer and a cursor

The fix is to stop treating the parked request as a pipe and start treating it as a **query over a log**.

Give every event destined for a client a monotonically increasing sequence number, and keep a bounded, expiring buffer of recent events per client — a Redis list or stream trimmed to the last few minutes is the usual shape. → [TTL as a Coordination Primitive](/learn/system-design/ttl-as-a-coordination-primitive)

Now the request carries a cursor:

```http
GET /events?since=1043
```

and the handler becomes:

```
events = buffer.after(since)
if events:  return them immediately        # don't park at all
else:       park the request
            wake on the next event, return it
            on timeout, return 204 with the cursor unchanged
```

The response reports the highest sequence number it contains, and the client sends that back as `since` next time.

Now replay the failure. The event that fired at t=4.02s went into the buffer as #1044. Request #2 arrives at 4.05s saying `since=1043`, the handler finds #1044 already sitting there, and returns instantly without parking. **The gap stopped mattering, because delivery now depends on the buffer rather than on whether someone happened to be holding a socket at the right microsecond.**

Two things come free. A client that was backgrounded for two minutes uses the identical code path and just gets a bigger batch. And because the request is a pure function of its cursor, a retried request returns the same events instead of skipping them. → [Idempotency](/learn/system-design/idempotency)

<aside class="sd-callout sd-callout--warning">

<p class="sd-callout-title">Two more long-polling details that bite</p>

Your park timeout must be comfortably shorter than the shortest idle timeout on the path — load balancer, reverse proxy, corporate middlebox. If the proxy gives up first, the client sees a connection error instead of a clean empty response, and your reconnect logic gets exercised for no reason.
And every parked request occupies something on the server. On an event-loop or coroutine server that's a cheap continuation. On a thread-per-request server it's a thread, and ten thousand waiting clients is ten thousand threads.

</aside>

---

## Server-Sent Events, up close

An SSE stream is one HTTP response that never ends.

The client does `new EventSource("/stream")`. The server replies `200 OK` with `Content-Type: text/event-stream`, and then just keeps writing into the body forever.

### The wire format is almost embarrassingly small

It's UTF-8 text. Lines are `field: value`, and a blank line dispatches whatever has accumulated.

```
: keep-alive comment, ignored by the client

data: {"type":"price","sku":"9781234","price":1299}

event: orderShipped
id: 1044
data: {"orderId":"A-77","carrier":"DHL"}

retry: 5000
```

Four fields, and that is the entire protocol. `data` carries the payload — repeat the line and the pieces are joined with newlines. `event` names the event so the client can register `addEventListener("orderShipped", …)` rather than funnelling everything through one handler. `id` sets the client's last-seen event id. `retry` tells the browser how many milliseconds to wait before reconnecting.

A line starting with `:` is a comment and is thrown away, which is exactly what makes it useful — send one every fifteen or thirty seconds so nothing in the middle decides the connection has gone idle.

### Reconnection is in the protocol, not in your code

This is SSE's best feature and the reason it deserves more use than it gets.

When the connection drops, the browser reconnects by itself. And it sends back the last `id` it saw, as a request header:

```http
GET /stream HTTP/1.1
Last-Event-ID: 1044
```

So the server is told exactly where the client got to, and can replay from #1045 out of the same buffer we just built for long polling. **Resume-after-disconnect — the thing you'd have to hand-roll on top of WebSockets — is a spec-level feature here.** You only have to do two things: actually read the header, and actually keep the buffer.

The `retry:` field lets you control the backoff. Add jitter to it, or every client that dropped during a deploy comes back at the same instant and knocks over the servers that just came up.

### The six-connection wall

Over HTTP/1.1 a browser will hold at most **six simultaneous connections to one domain**. An SSE stream holds one of them open for its entire life.

So open your app in four tabs and four of the six are gone. The fifth tab's stream still connects. The sixth hangs — and so does every ordinary fetch the page tries to make, because the pool is exhausted. It's a miserable thing to debug, because the symptom is that the page silently stops loading things with no error anywhere. Chrome and Firefox have both marked it won't-fix.

**HTTP/2 makes the problem disappear.** Streams are multiplexed over a single TCP connection instead of needing one each, the negotiated default is around a hundred concurrent streams, and the per-domain connection limit stops being the binding constraint. Serve your stream over HTTP/2 or HTTP/3 and you can stop thinking about this. On HTTP/1.1 your options are sharding across subdomains or sharing one stream between tabs through a SharedWorker, and both are worse than just upgrading. → [TCP and UDP](/learn/system-design/tcp-and-udp)

### Proxies that buffer will quietly break you

SSE looks exactly like a normal HTTP response, which is its superpower and also its weakness.

Lots of intermediaries buffer responses by default, and normally that's a good idea — collecting a response and shipping it in one write is more efficient than dribbling it out. For a response that never ends, it means your events accumulate in somebody's buffer instead of reaching the client, and your real-time channel delivers in lumps, minutes late, or not at all.

So you turn it off on purpose. nginx honours an `X-Accel-Buffering: no` response header, and `proxy_buffering off;` in config. Disable compression on the stream for the same reason — a compressor wants a block to work on and will happily sit on your events waiting for one. Then check that nothing on the path has a response timeout shorter than a stream's intended lifetime. → [Proxies](/learn/system-design/proxies), [API Gateway](/learn/system-design/api-gateway)

And the constraint you already knew: it's one-way. The client still talks upstream through ordinary HTTP requests, which is completely fine when it speaks rarely, and a second channel to operate when it doesn't.

---

## WebSockets, up close

### The handshake is HTTP, once

A WebSocket begins as a perfectly ordinary HTTP/1.1 GET:

```http
GET /socket HTTP/1.1
Host: store.example.com
Upgrade: websocket
Connection: Upgrade
Sec-WebSocket-Key: dGhlIHNhbXBsZSBub25jZQ==
Sec-WebSocket-Version: 13
```

The server answers `101 Switching Protocols` and echoes a `Sec-WebSocket-Accept` derived by concatenating the client's key with a fixed GUID (`258EAFA5-E914-47DA-95CA-C5AB0DC85B11`), hashing with SHA-1 and base64-encoding the result. That's not security — it's proof that the thing answering genuinely understood this as a WebSocket handshake, and isn't a cache replaying some unrelated response.

After the 101, HTTP is done. The same TCP connection now carries WebSocket frames in both directions until someone closes it. → [TCP and UDP](/learn/system-design/tcp-and-udp)

Beginning as HTTP is worth more than it sounds. It means the connection goes out over port 443 like everything else, through corporate firewalls and proxies — provided they forward the `Upgrade` and `Connection` headers rather than eating them. Both are hop-by-hop headers, so a reverse proxy has to be explicitly configured to pass them along; this is the single most common reason a WebSocket that works locally fails in staging. → [Proxies](/learn/system-design/proxies)

### Frames, and why they're so cheap

A message is one or more frames, each with a compact binary header: a FIN bit saying whether this is the last frame of the message, an opcode (text, binary, ping, pong, close), a mask bit, and a payload length encoded in 7, 7+16 or 7+64 bits depending on size.

The number that matters: **a small message carries roughly 2 to 6 bytes of framing.** Set that against several hundred bytes of HTTP headers plus an auth check for every polled request, and the overhead argument above stops being an abstraction.

Client-to-server payloads are XOR-masked with a random four-byte key. Not for confidentiality — TLS handles that — but so a hostile page can't craft a payload that some confused intermediary mistakes for a real HTTP request.

### Heartbeats, because the network won't tell you

TCP will cheerfully keep a connection "open" that has been dead for an hour. A phone goes into a tunnel, a NAT table entry expires, a laptop lid shuts — and no FIN arrives at either end. You are now holding a socket that is, in every way that matters, gone, along with its entry in your registry.

That's what ping/pong is for. They're control frames in the protocol itself (opcodes `0x9` and `0xA`): either side sends a ping with a small payload, the other must reply with a pong carrying the identical payload. No pong inside your window, and you tear the connection down and clean up after it.

There's a second reason to ping that catches people out. **Intermediaries kill idle connections on a timer.** nginx's default `proxy_read_timeout` is 60 seconds, and nginx's own WebSocket documentation recommends having the backend send periodic pings specifically to reset it. Cloud load balancers have idle timeouts in the same neighbourhood. So if your app happens to go quiet for a minute, something in the middle hangs up, and your users report it as "the app randomly disconnects".

Ping more often than the shortest idle timeout on the path — which means you need to know what that timeout is.

### Load balancers have to care now

An HTTP load balancer can throw each request at whichever backend it likes. A WebSocket isn't a request. It's a connection that may live for hours, and everything that client does rides on it.

Two consequences follow.

The balancer has to be **connection-aware rather than request-aware**. Least-connections beats round-robin here, because round-robin distributes connection *events* evenly while you actually care about balancing concurrent *holders* — and a server that was down for two minutes during a deploy comes back holding zero connections while its neighbours hold thousands. Rolling restarts drop every socket on a machine at once, so you want connection draining plus jittered client reconnect, or the servers that are still up get stampeded. → [Load Balancing](/learn/system-design/load-balancing)

And if any per-session state lives in that server's memory, you need **sticky routing** to land a reconnecting client back on the same machine. You mostly don't want that, because it's precisely the statefulness that makes scaling and deploys painful. The better answer is to make any server able to serve any client, and keep shared state somewhere both can reach. That's the connection registry, below.

### Scaling out needs a backplane

Here's the problem that shows up the instant you run more than one socket server.

A customer support chat: the agent's socket is on server A, the customer's is on server M. Or a live order feed where one event has to reach four hundred watchers spread across twenty machines. Server A has the message. Servers B through T have the sockets.

The answer is a **pub/sub backplane**. Every socket server subscribes to topics for the connections it's currently holding — `order:A-77`, `user:12` — and anything that wants to push publishes to the topic instead of hunting for a machine. Redis pub/sub is the common choice; a real broker if you need durability or replay. → [Publish-Subscribe](/learn/system-design/publish-subscribe), [Message Brokers](/learn/system-design/message-brokers)

The trade is a broker hop and a new dependency. And plain Redis pub/sub is fire-and-forget, so a server that's briefly disconnected simply misses what was published while it was away — which is exactly why you still want the per-client buffer and sequence numbers from the long-polling section sitting underneath it.

The broadcast case and the point-to-point case ("which machine is holding client 42?") are the same question with two answers: publish to a topic, or look the client up. *The cost nobody mentions*, below, is the second one.

### Authentication is genuinely awkward in the browser

`new WebSocket(url, protocols)` takes a URL and an optional list of subprotocols. **That's the entire API.** You cannot set an `Authorization` header. Everyone discovers this once, usually late.

So you pick one of three workarounds.

**Cookies.** The handshake is an HTTP request, so cookies ride along automatically. Simple and it works — but from the browser's point of view this is a cross-site-capable request, and the same-origin policy does not protect WebSocket handshakes. You must check the `Origin` header yourself, or you've built a CSRF hole straight into a long-lived authenticated channel.

**A token in the subprotocol field.** Smuggle it as a fake subprotocol: `new WebSocket(url, ["v1.chat", "bearer.eyJhbGci…"])`. The browser puts both in `Sec-WebSocket-Protocol` on the handshake. It's a hack, but it is at least a header, so the token doesn't end up in access logs the way a query string does. The server echoes back only the real subprotocol.

**A short-lived ticket.** The client calls an ordinary authenticated REST endpoint, gets a single-use token good for maybe thirty seconds, and connects with `?ticket=…`. The server redeems it and invalidates it immediately. This is usually the cleanest: your normal auth stack issues it, the exposure window is tiny, and a ticket sitting in a log file is already worthless. → [REST GraphQL and gRPC](/learn/system-design/rest-graphql-and-grpc), [API Gateway](/learn/system-design/api-gateway)

Whichever you choose, authenticate **during** the handshake and reject before sending the 101. Accepting first and waiting for an auth message means unauthenticated sockets occupying memory and registry entries, which is a cheap way for a stranger to fill your servers.

One more thing that gets forgotten: a connection open for eight hours outlives most access tokens. Decide up front whether you re-verify periodically over the socket or just close the connection when the token expires and let the client reconnect with a fresh one.

---

## WebRTC, for completeness

Everything above routes every byte through your servers. WebRTC is the option that doesn't.

It's the browser's peer-to-peer stack. Two clients exchange connection details through a **signalling server** you run — any of the four mechanisms above works fine for signalling — and then establish a direct connection to each other. Because home networks sit behind NAT, it uses STUN to discover each peer's public address, and falls back to relaying through a TURN server when no direct path can be found, which in the real world is a non-trivial share of attempts.

The data channel runs over SCTP on DTLS on UDP, so unlike everything else here you can choose **unreliable, unordered** delivery — which is exactly right for video frames or game state, where a packet that arrives late is worse than one that never arrives at all. → [TCP and UDP](/learn/system-design/tcp-and-udp)

Reach for it when the payload is large, the latency budget is brutal, and your server has no reason to see the bytes: video and voice calls, screen sharing, live collaborative cursors, low-latency multiplayer. Don't reach for it for chat or notifications. NAT traversal, TURN bandwidth and signalling complexity buy you nothing when the messages are two hundred bytes and the server has to store them anyway.

---

## The cost nobody mentions

Here's the part that catches people out.

Polling is stateless. Any of your servers can answer any request, and failover is trivial because there's nothing to fail over.

**A persistent connection is server state.** Client 42's socket lives on exactly one machine out of the hundreds you run. And the moment any other part of your system wants to send client 42 a message, it has to know *which one*.

So you need a directory:

```sql
CREATE TABLE Sessions (
  entityId    BIGINT PRIMARY KEY,
  serverIp    VARCHAR NOT NULL,
  connectedAt BIGINT
);
```

Written on connect — and if the client reconnects elsewhere, the write simply overwrites the old row, which is exactly the semantics you want. Read whenever a server needs to reach a client it isn't holding.

**Any time you propose a persistent connection, follow it immediately with your connection registry.** Otherwise it's the first thing you'll be asked.

### Keeping the registry cheap

It's one write per connect, which is nothing, but a **read per routed message**, which isn't. Four ways to soften that:

Put it in an **ephemeral store** like Redis rather than your transactional database — a lost row costs one reconnect.

**Cache the mapping** for the life of a conversation. It barely changes.

**Replace it with pub/sub**: have both parties' servers subscribe to a shared topic, then publish instead of looking up. You trade a directory read for a broker hop, and neither server needs to know where the other is.

Or **colocate** both parties' sockets on one machine by consistent hashing. The relay becomes an in-process memory copy — but now you have to migrate a live socket when the pairing is established, which is its own problem.

---

## Delivery semantics

**At-least-once, with an idempotent receiver.** Exactly-once over a mobile network isn't a thing. Deduplicate at the edge instead. → [Idempotency](/learn/system-design/idempotency)

**Sequence numbers per stream**, so a packet that arrives late can't rewind state that has already moved on.

**Resume on reconnect.** The client sends its last-seen sequence number and the server replays only the delta, rather than the whole world. This matters enormously for cold-start time.

**Priority classes.** A time-critical message must outrank a routine tick when bandwidth is scarce. Real platforms carry High/Medium/Low plus per-message TTLs for exactly this.

---

## In an interview

Whenever you propose a persistent connection, follow it immediately with the connection registry — which server holds which client's socket. If you don't, it's the first question you'll get.

Justify the choice with the framing cost, not just latency: when a client already sends small messages frequently, HTTP headers cost more than the payload. That's the argument that actually decides polling versus WebSockets.

The trap: treating WebSockets as free. They make the connection itself server state, which changes how you load-balance, fail over, and deploy.

## Seen in
- 05 - Matching and Real-Time Push — polling vs SSE vs WebSockets, and the session tables that follow from the choice
- 06 - Location Sharing and Completion — symmetric routing through two session tables
- 12 - How Uber Actually Does It — RAMEN on SSE, then gRPC, at 1.5M concurrent connections

## Related
[Load Balancing](/learn/system-design/load-balancing) · [Proxies](/learn/system-design/proxies) · [TCP and UDP](/learn/system-design/tcp-and-udp) · [Publish-Subscribe](/learn/system-design/publish-subscribe) · [Message Brokers](/learn/system-design/message-brokers) · [API Gateway](/learn/system-design/api-gateway) · [REST GraphQL and gRPC](/learn/system-design/rest-graphql-and-grpc) · [Idempotency](/learn/system-design/idempotency) · [Caching Strategies](/learn/system-design/caching-strategies) · [TTL as a Coordination Primitive](/learn/system-design/ttl-as-a-coordination-primitive)

## Sources
- [Using server-sent events — MDN](https://developer.mozilla.org/en-US/docs/Web/API/Server-sent_events/Using_server-sent_events)
- [Writing WebSocket servers — MDN](https://developer.mozilla.org/en-US/docs/Web/API/WebSockets_API/Writing_WebSocket_servers)
- [NGINX as a WebSocket proxy — nginx docs](https://nginx.org/en/docs/http/websocket.html)
- [Realtime Updates — Hello Interview deep dive](https://www.hellointerview.com/learn/system-design/deep-dives/realtime-updates)
