---
title: "SSL, TLS and mTLS"
summary: "A request leaves a laptop in a café and arrives at a server in Virginia. Between those two points it crosses a shared wifi network, a router, several ISP backbones and whatever hardware sits in between."
stage: 10
stageName: "Security and specialised"
tier: "breadth"
seq: 68
tags: ["tls", "security", "encryption", "mtls"]
---

A request leaves a laptop in a café and arrives at a server in Virginia. Between those two points it crosses a shared wifi network, a router, several ISP backbones and whatever hardware sits in between.

At every one of those hops, someone can **read** it, **change** it, or **pretend to be the server**. TLS is how you stop all three.

---

## First, the naming

**SSL** is the original protocol from Netscape. Every version of it is broken and deprecated. **TLS** is its successor and what everything actually uses. TLS 1.2 is widespread, TLS 1.3 is current.

People say "SSL" constantly and mean TLS. The library is called OpenSSL, the certificates are called SSL certificates. It's fine to know the distinction and not be pedantic about it — but if someone asks, TLS is the right answer.

---

## The three things it gives you

Take them one at a time, because each solves a different attack.

**Confidentiality.** Nobody in between can read the traffic. Without it, anyone sharing that café wifi sees your session cookie.

**Integrity.** Nobody can modify it undetected. Without it, an ISP can inject ads into your pages — which has genuinely happened.

**Authentication.** You're talking to the server you think you are. This is the one people forget, and it's the most important. Encryption to an attacker who's impersonating your bank buys you nothing.

That third one is why certificates exist, and why they're most of the complexity.

---

## Certificates and who vouches for whom

A certificate binds a **public key** to an **identity** (`api.example.com`), and is **signed** by a certificate authority.

The trust works by chain. Your operating system and browser ship with a store of root CA certificates — a few hundred organisations the vendor has decided to trust. A root signs an intermediate, the intermediate signs your server's certificate. When a server presents its certificate, your client walks the chain up until it reaches a root it already trusts.

What actually gets verified is worth knowing, because it's less than people assume:

- The signature chains to a trusted root
- The name matches the host you asked for
- It hasn't expired
- It hasn't been revoked (in theory — revocation checking is patchy in practice)

Note what's absent. A certificate says *"this key belongs to whoever controls this domain."* It says nothing about whether they're honest. A phishing site can have a perfectly valid certificate — and most do, because Let's Encrypt made them free. The padlock means encrypted, not trustworthy.

---

## The handshake

<figure class="sd-figure"><img src="/system-design/diagrams/ssl-tls-and-mtls.svg" alt="Diagram: SSL TLS and mTLS" loading="lazy" decoding="async" /></figure>

TLS 1.3 completes in **one round trip**, which is the headline improvement over 1.2's two.

The client opens with the cipher suites it supports *and a key share* — it guesses which key agreement the server will pick and sends its half immediately. That guess is what saves the round trip.

The server replies with its choice, its own key share, its certificate, and a signature proving it holds the matching private key. Both sides now derive the same symmetric key independently. Everything after that point is encrypted.

Two details worth carrying:

**Asymmetric crypto is only used to agree on a key.** Public-key operations are expensive, so once both sides share a symmetric key, the bulk transfer uses that — which is orders of magnitude faster. The handshake is the expensive part; the data transfer isn't.

**TLS 1.3 also removed things.** RSA key transport, static Diffie-Hellman, RC4, MD5, SHA-1, compression. A lot of TLS 1.2's vulnerabilities came from negotiating down to weak options, so 1.3 deleted them rather than deprecating them.

**0-RTT** lets a returning client send data in its very first packet using a cached key. It's fast and it has a real caveat: 0-RTT data can be replayed by an attacker, so it's only safe for idempotent requests. → [Idempotency](/learn/system-design/idempotency)

### What this costs you

A TLS handshake is one extra round trip on top of TCP's. On a 60ms link that's meaningful, and it's why connection reuse, keep-alive and CDN edge termination matter so much. → [TCP and UDP](/learn/system-design/tcp-and-udp), [CDN](/learn/system-design/cdn)

---

## mTLS

In ordinary TLS, authentication is one-directional: the server proves who it is, the client stays anonymous. That's right for the public web — you don't want to issue a certificate to every visitor.

**Mutual TLS** makes it symmetric. The server also requests a certificate from the client and verifies it the same way. Both ends prove their identity cryptographically, before any application data moves.

This is the backbone of **zero-trust internal networking**. The old model assumed anything inside the network perimeter was friendly, which fails the moment one service is compromised. With mTLS, every service has its own identity, every connection is authenticated in both directions, and "being on the network" grants nothing.

The reason it's practical now is automation. Issuing, distributing and rotating certificates for every instance of every service, at scale, is not something humans can do — so service meshes do it. **SPIFFE/SPIRE** provides workload identity, **Istio** and **Linkerd** issue short-lived certificates through their sidecars, **cert-manager** handles it in Kubernetes. Certificates that live hours rather than years make revocation mostly moot. → [Service Discovery](/learn/system-design/service-discovery)

---

## Termination, and the gap it leaves

In practice, TLS usually terminates at the edge — a load balancer or [API Gateway](/learn/system-design/api-gateway) decrypts, and traffic behind it is plain HTTP. → [Load Balancing](/learn/system-design/load-balancing), [Proxies](/learn/system-design/proxies)

There's a real reason for this: certificate management in one place, and the ability to inspect requests for routing, caching and WAF rules. You can't route on a URL path you can't read.

The consequence is that **your internal network is unencrypted**. For a long time that was considered fine. It isn't anymore — which is exactly the gap mTLS and service meshes fill. The modern shape is TLS terminated at the edge, then re-encrypted with mTLS between services.

**Certificate pinning** is worth a sentence: an app hardcodes which certificate or CA it will accept, defeating an attacker who's compromised a CA. It also means a certificate rotation you didn't plan for bricks your app in the field, which is why it's mostly confined to mobile apps with tight release control.

---

## Where this shows up

- **Every HTTPS request** — and HTTP/2 and HTTP/3 effectively require TLS in practice.
- **Service meshes**, where mTLS between every pair of services is the default.
- **Payment and healthcare compliance**, where encryption in transit is mandated.
- **Kafka, databases and message brokers**, which all support TLS and frequently mTLS for client authentication.

---

## In an interview

You rarely design TLS — you say where it terminates and whether internal traffic is encrypted. That's usually the whole discussion, and getting it right takes ten seconds.

The distinction worth having ready is TLS versus mTLS, and specifically *why* mTLS is for service-to-service rather than public traffic: you can't issue certificates to anonymous users.

If asked what a certificate actually proves, the good answer is "control of the domain, not trustworthiness." It's a small point that shows you understand the trust model rather than the padlock icon.

---

## Related
[OAuth 2.0 and OIDC](/learn/system-design/oauth-20-and-oidc) · [Single Sign-On](/learn/system-design/single-sign-on) · [Load Balancing](/learn/system-design/load-balancing) · [Proxies](/learn/system-design/proxies) · [API Gateway](/learn/system-design/api-gateway) · [Service Discovery](/learn/system-design/service-discovery) · [TCP and UDP](/learn/system-design/tcp-and-udp) · [CDN](/learn/system-design/cdn)

## Sources
- [RFC 8446 — The Transport Layer Security (TLS) Protocol Version 1.3](https://datatracker.ietf.org/doc/html/rfc8446)
- [Cloudflare: A detailed look at RFC 8446 (TLS 1.3)](https://blog.cloudflare.com/rfc-8446-aka-tls-1-3/)
- [SPIFFE: Secure Production Identity Framework for Everyone](https://spiffe.io/docs/latest/spiffe-about/overview/)
- [Istio: Mutual TLS authentication](https://istio.io/latest/docs/concepts/security/#mutual-tls-authentication)
