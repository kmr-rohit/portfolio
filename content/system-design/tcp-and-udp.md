---
title: "TCP and UDP"
summary: "The network layer makes a deliberately weak promise: it will try to get your packet to the other machine. It might drop it. It might deliver it twice. It might deliver packet 40 before packet 39. It won't tell you which of these happened."
stage: 5
stageName: "How requests arrive"
tier: "useful"
seq: 39
tags: ["networking", "tcp", "udp", "quic", "transport"]
---

The network layer makes a deliberately weak promise: it will *try* to get your packet to the other machine. It might drop it. It might deliver it twice. It might deliver packet 40 before packet 39. It won't tell you which of these happened.

Transport protocols exist to turn that into something you can build on. TCP does a lot of work to hide the mess. UDP does almost none, on purpose. Understanding *which* work TCP is doing, and what that work costs, is one of the highest-value things you can carry into a system design interview.

---

## What you're actually handed

You're building an online store, and a seller uploads a 5 MB product photo to your API.

That photo doesn't cross the network as one object. It gets chopped into packets of roughly 1,400 bytes of payload each, so about 3,600 of them. They travel independently, and along the way one router's queue fills up during a burst and it drops four of them on the floor.

**Nobody tells anyone.** The router doesn't notify the sender. IP has no mechanism for that. → [IP Addressing](/learn/system-design/ip-addressing)

So the receiving server has 3,596 packets, in whatever order they showed up, with four holes it doesn't know about. If it just concatenates them, it has a corrupt JPEG.

---

## Try the obvious thing: just send them

The simplest possible transport takes your data, adds the bare minimum so the receiving machine knows which program to hand it to, and sends it.

That's UDP. Its entire header is eight bytes: source port, destination port, length, checksum. There is no connection, no state on either side, no acknowledgement, no ordering, no retransmission. You hand it a datagram and it hands that datagram to IP.

For the photo upload, this fails — the seller's image arrives broken and there's no way to know it happened. So we need to do better.

But hold onto UDP. We'll come back to it, and the reason it exists will be much clearer once you've seen everything TCP had to build.

---

## Fix it: number the bytes and acknowledge them

Here's the core idea that makes reliable delivery possible: **give every byte a number.**

The sender labels its stream. The receiver, on getting data, sends back an acknowledgement saying how far it has got. TCP's ACKs are *cumulative* — RFC 9293 puts it exactly: *"An acknowledgment of sequence number X indicates that all octets up to but not including X have been received."*

That one sentence buys you a lot. Duplicates are detectable, because you've already seen that sequence number. Reordering is fixable, because you can hold packet 40 in a buffer until 39 shows up. And gaps are visible.

Watch a small exchange where a segment is lost:

<figure class="sd-figure"><img src="/system-design/diagrams/tcp-and-udp.svg" alt="Diagram: TCP and UDP" loading="lazy" decoding="async" /></figure>

Notice what the receiver is doing. It keeps saying `ack=1500` because that's genuinely how far the contiguous stream goes, even though it's holding three later segments in a buffer.

**And notice how the sender learned about the loss.** The obvious mechanism is a timer: if no ACK arrives within some timeout, resend. That works, but a timeout has to be conservatively long — at least a round trip, usually several — so you sit idle waiting.

The faster signal is right there in the diagram. Three duplicate ACKs for the same sequence number means "later data is arriving, but this one hole is still open." RFC 5681 calls this **fast retransmit**: on the third duplicate ACK, resend immediately without waiting for the timer. Most real-world loss is recovered this way, not by timeout.

---

## Why there's a handshake before any of this

Both sides need to agree on where the numbering starts before the first byte can be interpreted. And those starting numbers can't come from a shared clock, because there isn't one. RFC 9293 is explicit that *"a 3WHS is necessary because sequence numbers are not tied to a global clock in the network."*

So each side announces its own initial sequence number and waits to see it echoed back:

<figure class="sd-figure"><img src="/system-design/diagrams/tcp-and-udp-2.svg" alt="Diagram: TCP and UDP - 2" loading="lazy" decoding="async" /></figure>

Three messages, but only **one full round trip** before data can flow, because the client can send data alongside that final ACK.

One round trip doesn't sound like much until you price it. Light in fibre moves at roughly two-thirds of `c`, so a round trip between New York and London — about 5,600 km each way — has a floor around 56 ms. That's physics, not engineering; no amount of money makes it smaller.

Stack TLS on top and it gets worse. A TLS 1.2 handshake adds two more round trips on top of TCP's one, so a fresh HTTPS connection across the Atlantic costs about 170 ms before a single byte of your request is transmitted. TLS 1.3 cut that to one round trip, so roughly 110 ms.

**This is the number that justifies half the infrastructure in a typical design.** Connection pools exist so you pay the handshake once and amortise it over thousands of requests. HTTP keep-alive exists for the same reason. Persistent connections for push exist partly for this reason ([Real-Time Server Push](/learn/system-design/real-time-server-push)). And a [CDN](/learn/system-design/cdn) edge is largely a machine placed close enough to you that the handshake costs 5 ms instead of 110, after which it reuses a long-lived warm connection back to your origin.

---

## Closing is harder than opening

TCP connections are closed in each direction independently. Each side sends a `FIN`, the other acknowledges it, and only when both directions are closed is the connection done.

The side that closes first doesn't get to forget immediately. RFC 9293: *"When a connection is closed actively, it MUST linger in the TIME-WAIT state for a time 2xMSL (Maximum Segment Lifetime)."* The reason is that a delayed segment from this connection could otherwise wander in late and get mistaken for data on a brand new connection reusing the same port pair.

On most systems that lingering period is a minute or two, and it has a very practical consequence.

A socket in `TIME_WAIT` is still holding its local port. A machine has roughly 28,000 ephemeral ports available by default on Linux. So a busy reverse proxy that opens a **fresh** connection to a backend for every request, and closes it, can accumulate tens of thousands of `TIME_WAIT` sockets and then start failing to open new connections — while looking, to every dashboard, like it's doing nothing at all.

The fix is not to tune the timer. It's to stop churning connections: keep-alive to backends, connection pooling, and long-lived upstream connections through your [Proxies](/learn/system-design/proxies).

<aside class="sd-callout sd-callout--warning">



"Just reduce `TIME_WAIT`" is a classic wrong answer. The state exists to protect correctness across connection reuse. If port exhaustion is your problem, the real bug is the connection churn that got you there.

</aside>

---

## Two different "slow down" problems

TCP has two mechanisms that both throttle the sender, and candidates mix them up constantly. They solve completely different problems.

### Flow control protects the receiver

The receiver has a finite buffer. If the sender blasts data faster than the application on the other end reads it, that buffer overflows and data is lost — not because the network couldn't carry it, but because the destination couldn't absorb it.

So every TCP segment carries a **window** field: how many more bytes the receiver is currently willing to accept. The sender never has more than that outstanding. If the application stops reading, the window shrinks to zero and the sender simply stops until an update arrives.

This is the mechanism behind a stalled download from a machine whose disk is full, or a consumer that can't keep up with a producer. **It's a signal about the endpoint, not the network.**

### Congestion control protects the network

The other failure is the shared path. A thousand senders can each be well within their receiver's window and still collectively overwhelm a router in the middle.

There's no feedback channel for this — routers don't send you notices. So TCP infers congestion from the only signal it has: **loss.** If a packet went missing, assume a queue overflowed and back off.

The sender keeps a second limit, the congestion window (`cwnd`), and sends no more than the smaller of `cwnd` and the receiver's window. It runs in two regimes, split by a threshold called `ssthresh`:

**Slow start.** At the beginning, you have no idea what the path can carry. So probe: increase `cwnd` by one segment for every ACK received. Since each round trip acknowledges everything you sent in the previous one, the window roughly doubles per RTT. It's called "slow" because it starts small, not because it grows slowly — this is exponential.

**Congestion avoidance.** Once `cwnd` passes `ssthresh`, you're near the path's capacity and doubling is reckless. Switch to adding about one segment per round trip. Linear from here.

**On loss, back off hard.** RFC 5681 sets `ssthresh` to about half the data in flight. If loss was detected by fast retransmit, `cwnd` drops to roughly that and continues; if it was detected by timeout — a much worse signal, since even duplicate ACKs stopped arriving — `cwnd` collapses to one segment and slow start begins all over again.

<figure class="sd-figure"><img src="/system-design/diagrams/tcp-and-udp-3.svg" alt="Diagram: TCP and UDP - 3" loading="lazy" decoding="async" /></figure>

The pattern — add a little when things are fine, cut hard when they're not — is called additive increase, multiplicative decrease, and it's what makes many independent TCP flows converge on a roughly fair share of a link without any of them ever talking to each other.

**The design consequence is about new connections.** A connection starts with a small window and has to earn its way up. RFC 5681 allowed an initial window of 2 to 4 segments; RFC 6928 raised the recommended bound to 10 segments (at most 14,600 bytes), which is what most stacks use today. Either way, a brand new connection cannot deliver a megabyte in its first round trip, no matter how fat the pipe is.

So a connection isn't just expensive to *open* — it's slow for its first few round trips, and it only gets good after it has been used. That's a second, independent argument for connection reuse, and it's the one people forget.

---

## Head-of-line blocking: where the abstraction leaks

Everything above is TCP doing its job well. Now here's where doing its job well makes things worse.

TCP's contract is **one ordered stream of bytes.** It delivers byte `n` to the application before byte `n+1`, always. That's the whole promise.

The problem is that HTTP stopped being one thing per connection a long time ago, and TCP was never told.

### Round one: HTTP/1.1

HTTP/1.1 sends one request and waits for its response before sending the next on that connection. You can pipeline several requests, but RFC 9112 requires the server to *"send the corresponding responses in the same order that the requests were received"* — so a single slow response blocks every response queued behind it. The RFC names the problem directly, noting that multiple connections are used *"to avoid the 'head-of-line blocking' problem, wherein a request that takes significant server-side processing and/or transfers very large content would block subsequent requests on the same connection."*

Browsers worked around it by opening six connections per hostname and sharding assets across several hostnames. Six handshakes, six congestion windows all starting small, six sets of state on the server. It worked, and it was ugly.

### Round two: HTTP/2

HTTP/2 fixed it properly at the application layer. One connection, many independent **streams**, each carrying one request and response, interleaved as frames. No ordering requirement between streams. Application-level head-of-line blocking: gone.

Except it isn't, because all those streams still ride inside **one TCP byte stream**, and TCP doesn't know they're independent.

```
one TCP connection, three HTTP/2 streams interleaved:

  segment:   1      2      3      4      5      6
  carries:  [A1]   [B1]   [C1]   [A2]   [B2]   [C2]
                     ✗
                   lost

  TCP holds back segments 3-6 until segment 2 is retransmitted.
  Stream A and stream C stall waiting for a packet
  that contained none of their data.
```

RFC 9114 states it exactly: *"the parallel nature of HTTP/2's multiplexing is not visible to TCP's loss recovery mechanisms, a lost or reordered packet causes all active transactions to experience a stall regardless of whether that transaction was directly impacted by the lost packet."*

This is a layering failure, not a bug. TCP is honouring its contract perfectly. The contract is simply wrong for the job. → [OSI Model](/learn/system-design/osi-model)

And it's worse than HTTP/1.1's six connections in one specific way: with six connections, loss on one stalls a sixth of your page. With one multiplexed connection, loss stalls **all** of it. On a clean network HTTP/2 wins comfortably; on a lossy mobile link it can lose.

---

## QUIC and HTTP/3: move the seam

You can't fix this inside TCP. The ordered-byte-stream promise *is* TCP, and every middlebox on the internet has been inspecting and enforcing TCP's shape for thirty years — a problem called ossification, where you can't deploy a change because the network won't pass it.

So QUIC takes the interesting way out: **build a new transport on top of UDP.** UDP is just enough of a wrapper to get through the internet's plumbing, and everything above it is fresh.

Inside that, QUIC rebuilds what TCP had, with one crucial difference in where the seam goes.

**Streams are known to the transport.** QUIC provides flow-controlled streams as a first-class concept. Each stream has its own ordering and its own flow control, while congestion control stays shared across the whole connection — which is the right split, because congestion is a property of the path and ordering is a property of the stream. Loss of a packet carrying stream B's data stalls stream B, and A and C carry on. The exact problem in the diagram above, gone.

**The handshake includes TLS.** QUIC folds the TLS 1.3 handshake into its own, so a fresh connection is 1-RTT rather than TCP's round trip plus TLS's round trip. On a resumed connection, 0-RTT lets the client send application data in its very first packet.

**Connections survive changing addresses.** TCP identifies a connection by the 4-tuple of addresses and ports, so walking out of your house and switching from Wi-Fi to cellular changes your IP and kills every connection. QUIC identifies connections by an explicit connection ID, so the connection migrates to the new path and keeps going. For a mobile client holding a long-lived connection, this is enormous. → [Real-Time Server Push](/learn/system-design/real-time-server-push)

HTTP/3 is HTTP semantics mapped onto QUIC. Same methods, same headers, same status codes, different transport.

### What QUIC costs

Be honest about this, because "QUIC is strictly better" is wrong.

UDP is second-class on some networks. Corporate firewalls block it, and some carriers deprioritise it, so every real HTTP/3 client keeps a TCP path to fall back to.

It burns more CPU per byte. TCP lives in a kernel that has been optimised for decades and can offload work to the network card. QUIC mostly runs in userspace, and everything including the headers is encrypted, so there's more work per packet.

It's harder to see. You can't read a QUIC connection with a packet capture the way you can read TCP, because the transport metadata is encrypted too. Middleboxes that used to do useful things — and the observability tooling you already own — go blind.

And most interviews don't want it. TCP is the default answer, and QUIC is a thing you reach for when you can name the specific problem it solves.

---

## So when does UDP win?

Now come back to the protocol that does nothing, because the case for it is much sharper.

**When late data is worthless data.** In a voice call, a packet of audio from 400 ms ago has nothing to contribute — the conversation moved on. Retransmitting it wastes bandwidth *and* delays the packets behind it. Better to drop the gap, conceal it, and stay current. Same for live video and for a game sending player positions sixty times a second: the next update supersedes the lost one.

This is the general rule, and it's worth stating plainly: **TCP's retransmission is only a feature if old data still matters when it finally arrives.** For a continuous stream of state, it usually doesn't.

**When the exchange is a single round trip.** A [DNS](/learn/system-design/dns) query is one small question and one small answer. Paying a three-way handshake to deliver it would triple the cost. UDP sends the question, and if no answer comes back in time, the client just asks again — retransmission implemented in one line at the application layer.

**When you need one-to-many.** TCP is strictly point-to-point. Broadcast and multicast only exist over UDP, which matters for service discovery on a local network and for streaming one feed to many receivers on a private network.

**When you want to choose your own guarantees.** This is the one that actually matters for design work. QUIC is UDP plus reliability. WebRTC is UDP plus its own congestion control and optional retransmission. High-performance messaging systems build on UDP and add exactly the ordering and delivery semantics they need.

The framing to carry into an interview is that TCP is a *bundle* — reliability, ordering, flow control, congestion control — and you buy the whole bundle or none of it. Choosing UDP isn't choosing "unreliable". It's declining the bundle so you can assemble your own.

| | TCP | UDP | QUIC |
|---|---|---|---|
| Setup before data | 1 RTT, plus TLS on top | none | 1 RTT including TLS, 0-RTT on resume |
| Header | 20–60 bytes | 8 bytes | variable, encrypted |
| Delivery | reliable, ordered, one stream | best effort | reliable and ordered **per stream** |
| Loss on one stream | stalls everything | n/a | stalls only that stream |
| Survives an IP change | no | n/a | yes, via connection ID |
| Reach for it when | you want the default | late data is worse than lost data | mobile clients, lossy links, many parallel requests |

---

## Where this shows up

- **Connection pools and keep-alive everywhere** — database drivers, HTTP clients, gRPC channels. All of them exist to avoid paying a handshake and a cold congestion window per request.
- **`TIME_WAIT` port exhaustion on proxies and API gateways** that open a fresh backend connection per request instead of pooling.
- **Video conferencing and game servers on UDP**, with their own concealment and retransmission policies layered on top.
- **Mobile apps holding long-lived connections**, where QUIC's connection migration means walking out of a building doesn't drop the socket.
- **L4 load balancers for WebSocket fleets**, because the balancing decision is per connection and the connection lives for hours. → [Load Balancing](/learn/system-design/load-balancing)

## In an interview

State your transport once, early, when you first draw a client talking to a server — "HTTP over TCP" — and then don't spend time on it unless something in the requirements pushes back.

The thing that earns points is naming the *specific* property you need. "UDP, because this is live audio and a retransmitted packet arrives after it's useful" is a real justification. "UDP because it's faster" is not, and will be pushed on.

Expect to be asked about the cost of connections: how many concurrent connections a server can hold, what a handshake costs across regions, why you'd pool. The 1-RTT handshake plus a cold congestion window is the shape of that answer.

Bring up head-of-line blocking when the design has many parallel requests over one connection, or clients on lossy mobile networks. It's a strong signal, and QUIC is the natural follow-up — but say what it costs too.

The most common mistake is claiming TCP guarantees delivery. It doesn't. It guarantees that data is delivered in order *or* that the connection fails — and a connection failing after your write is exactly why you still need retries and [Idempotency](/learn/system-design/idempotency).

## Seen in
- YouTube · Adaptive Bitrate Streaming — streaming runs over plain HTTP on TCP, because segments are just cacheable files
- YouTube · Inside the Video Player — the player measures throughput to choose bitrates, which is TCP behaviour showing up in the product

## Related
[IP Addressing](/learn/system-design/ip-addressing) · [OSI Model](/learn/system-design/osi-model) · [DNS](/learn/system-design/dns) · [Load Balancing](/learn/system-design/load-balancing) · [Proxies](/learn/system-design/proxies) · [CDN](/learn/system-design/cdn) · [Real-Time Server Push](/learn/system-design/real-time-server-push) · [Idempotency](/learn/system-design/idempotency)

## Sources
- [RFC 9293 — Transmission Control Protocol (TCP)](https://datatracker.ietf.org/doc/html/rfc9293)
- [RFC 5681 — TCP Congestion Control](https://datatracker.ietf.org/doc/html/rfc5681)
- [RFC 6928 — Increasing TCP's Initial Window](https://datatracker.ietf.org/doc/html/rfc6928)
- [RFC 9000 — QUIC: A UDP-Based Multiplexed and Secure Transport](https://datatracker.ietf.org/doc/html/rfc9000)
- [RFC 9114 — HTTP/3](https://datatracker.ietf.org/doc/html/rfc9114)
- [RFC 9112 — HTTP/1.1](https://datatracker.ietf.org/doc/html/rfc9112)
- [Hello Interview — Networking Essentials for System Design Interviews](https://www.hellointerview.com/learn/system-design/core-concepts/networking-essentials)
