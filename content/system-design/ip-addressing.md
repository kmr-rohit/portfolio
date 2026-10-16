---
title: "IP Addressing"
summary: "Every design you draw has boxes with arrows between them. An arrow means one machine sent bytes to another machine, and before that can happen, the sender needs to know where the other machine is."
stage: 5
stageName: "How requests arrive"
tier: "useful"
seq: 37
tags: ["networking", "ip", "cidr", "nat"]
---

Every design you draw has boxes with arrows between them. An arrow means one machine sent bytes to another machine, and before that can happen, the sender needs to know *where* the other machine is.

IP addressing is the answer to "where". Almost every other networking idea — [DNS](/learn/system-design/dns), [Load Balancing](/learn/system-design/load-balancing), [Proxies](/learn/system-design/proxies), firewalls, VPC design — is built on top of the assumptions in this note.

---

## Two machines need to find each other

You're building an online store. The checkout service runs on one machine, the inventory service on another, and checkout needs to ask inventory whether we still have the item.

Right now they're both on your desk, plugged into the same switch. How does checkout reach inventory?

Names don't help yet — there's nothing that turns a name into a location. What we need is the oldest idea in networking: **give every machine a number, and make the number unique.**

IPv4 does exactly that with 32 bits. Written out as four bytes in decimal, separated by dots, it looks like `203.0.113.17`. Thirty-two bits gives you about 4.3 billion distinct numbers, which in 1981 sounded like more than anyone would ever need.

So inventory is `203.0.113.17`, checkout puts that number in a packet header, and the packet gets delivered. On one switch, this genuinely works.

---

## Why a flat address space breaks

Now put the two machines in different cities. The packet has to cross a dozen routers to get there.

Here's the problem. If addresses are just serial numbers handed out at random, then every router on the path needs a table that says "for address `203.0.113.17`, send the packet out of port 4." And another row for `203.0.113.18`. And another for every other machine on the internet.

**That's a routing table with four billion rows, in every router.** Nobody can build that.

The fix is to stop treating the address as one number and start treating it as **two numbers glued together**: a *network* part and a *host* part. Routers only ever look at the network part. They need one row per network, not one per machine. Once the packet reaches the right network, the local equipment worries about which machine on it.

The original scheme carved this split at fixed boundaries and called them classes: Class A gave you 8 network bits and 24 host bits (16 million machines), Class B gave 16 and 16 (65,536 machines), Class C gave 24 and 8 (254 machines).

---

## Breaking the fix: three sizes isn't enough

Now you're a company with 900 machines.

A Class C block holds 254. Too small. A Class B block holds 65,536, so you take one and waste 98% of it. Multiply that by every mid-sized organisation on the internet in 1992 and you get exactly the crisis RFC 4632 describes: *"the lack of a network class of a size that is appropriate for mid-sized organization. Class C... is too small, whereas Class B... is too large for most organizations."*

Two things were failing at once. The address space was burning down because everyone rounded up to a Class B, and routing tables were growing exponentially anyway because organisations needed several blocks each.

**CIDR is the fix: let the split land anywhere, not just at byte boundaries.**

You write it as `a.b.c.d/n`, where `n` is how many leading bits are the network part. Everything after that is yours to allocate.

```
10.2.0.0/16     network bits: 10.2.*.*        →  65,536 addresses
10.2.0.0/20     network bits: 10.2.0-15.*     →   4,096 addresses
10.2.0.0/24     network bits: 10.2.0.*        →     256 addresses
10.2.0.0/26     network bits: 10.2.0.0-63     →      64 addresses
```

Each extra bit of prefix halves the block. Your 900-machine company takes a `/22` — 1,024 addresses — and wastes almost nothing.

### Reading a CIDR block in your head

Two facts get you through almost any interview question on this.

**The prefix length tells you the block size:** a `/n` block holds `2^(32-n)` addresses. So `/24` is 256, `/16` is 65,536, `/8` is 16.7 million. Subtract two for the usable host count, because the first address in a block names the network itself and the last is the broadcast address.

**Blocks nest cleanly.** A `/24` splits into exactly two `/25`s, or four `/26`s, or 256 `/32`s. This is why VPC design is mostly arithmetic: you take a `/16` for the VPC, then hand each availability zone a `/20`, then split that into public and private `/22`s.

```
VPC        10.0.0.0/16          65,536 addresses
 ├─ AZ-a   10.0.0.0/20           4,096
 │   ├─ public   10.0.0.0/22     1,024   ← load balancers live here
 │   └─ private  10.0.4.0/22     1,024   ← app servers live here
 ├─ AZ-b   10.0.16.0/20          4,096
 └─ AZ-c   10.0.32.0/20          4,096
```

The other half of CIDR is what it does for the routers. Because blocks nest, a provider holding `10.24.0.0/13` can slice it up among hundreds of customers and still advertise **one** route to the rest of the internet. That's called aggregation, and it's why the global routing table is in the low millions of entries rather than the billions.

<aside class="sd-callout sd-callout--note">



The "subnet mask" you see in network config — `255.255.255.0` — is the same information written the old way. It's just the prefix in binary: 24 ones followed by 8 zeros. `/24` and `255.255.255.0` mean identical things.

</aside>

---

## What a machine actually does with the split

The network/host split isn't just bookkeeping for routers. It's the decision every machine makes on every single packet.

Your app server is `10.0.4.22/22`. It wants to send a packet to `10.0.5.9`. Before anything else it asks one question: **is that address inside my own network, or outside it?**

It answers by masking both addresses with its prefix. `10.0.4.22` and `10.0.5.9` both mask down to `10.0.4.0` under a `/22`, so the answer is "inside". The machine can deliver the packet directly on the local link, and the only thing it's missing is the hardware address of the destination, which it discovers by asking on the local network and caching the answer.

Now try `10.0.20.7`. That masks to `10.0.20.0`, which isn't `10.0.4.0`. It's outside. The machine can't deliver directly — it doesn't even have a way to shout at that machine. So it hands the packet to its **default gateway**, the router whose job is "everything I don't recognise."

```
dst 10.0.5.9   & /22  →  10.0.4.0  == my network  →  deliver on the local link
dst 10.0.20.7  & /22  →  10.0.20.0 != my network  →  hand to the default gateway
dst 142.250.1.5 & /22 →  142.250.0.0 != my network → hand to the default gateway
```

That's the entire routing algorithm at the edge: two cases. Everything clever happens in the routers upstream, which run the same comparison against a much longer list of prefixes and pick the **most specific match** — the longest prefix that covers the destination.

Longest-prefix-match is worth remembering because it's how overlapping rules resolve. If a router knows both `10.0.0.0/8` and `10.0.20.0/24`, a packet for `10.0.20.7` follows the `/24`. The same logic governs route tables and firewall rules in a VPC: the narrower rule wins, not the first one written.

---

## The addresses everyone shares

CIDR slowed the bleeding. It didn't stop it — there are still only 4.3 billion IPv4 addresses and rather more than 4.3 billion devices.

The second fix was to admit that **most machines never need to be reachable from the internet at all.** Your app servers talk to your database and to a load balancer. Nothing on the public internet ever opens a connection to them directly.

So RFC 1918 set aside three blocks that are guaranteed never to be routed on the public internet, and told everyone to reuse them freely:

```
10.0.0.0    – 10.255.255.255    10.0.0.0/8       16,777,216 addresses
172.16.0.0  – 172.31.255.255    172.16.0.0/12     1,048,576 addresses
192.168.0.0 – 192.168.255.255   192.168.0.0/16       65,536 addresses
```

This is why your home router hands out `192.168.1.x`, why your office does too, and why nothing collides — those packets never leave the building. It's also why every AWS VPC example you've ever seen starts with `10.`.

**But now a private machine can't talk to the internet at all.** Its source address is `10.0.4.22`, which is meaningless outside your network, so no reply can ever find its way back.

### NAT: one public address, many private machines

The device at the edge of your network rewrites packets on the way out.

When your app server at `10.0.4.22:51000` opens a connection to an external API, the NAT gateway swaps the source to its own public address and a port it picked, say `203.0.113.9:40001`, and writes down the mapping. When the reply comes back to `203.0.113.9:40001`, it looks up the table, swaps the destination back to `10.0.4.22:51000`, and forwards it in.

```
  private side                NAT table                  public side
  10.0.4.22:51000   ──►  (10.0.4.22:51000)  ⇄  (203.0.113.9:40001)  ──►  api.example.com:443
  10.0.4.23:51000   ──►  (10.0.4.23:51000)  ⇄  (203.0.113.9:40002)  ──►  api.example.com:443
```

Because the mapping keys on the *port* as well as the address, thousands of private machines share one public address. RFC 3022 calls this NAPT, and it is the single biggest reason IPv4 is still standing.

### What NAT costs you

Every one of these shows up in real designs.

**Connections only go outward.** RFC 3022 is blunt about it: *"Sessions are uni-directional, outbound from the private network."* There's no table entry until the inside host creates one, so nothing outside can initiate a connection in. If you want inbound traffic you need something with a public address that is *expecting* it — which is precisely what a load balancer or reverse proxy is for. → [Load Balancing](/learn/system-design/load-balancing), [Proxies](/learn/system-design/proxies)

**Both ends behind NAT is a hard problem.** Two clients that each sit behind NAT can't reach each other directly at all, which is why peer-to-peer protocols carry a whole apparatus of relays and hole-punching helpers. It's also part of why server-push designs keep a connection open from the client outward rather than trying to dial in. → [Real-Time Server Push](/learn/system-design/real-time-server-push)

**Protocols that put addresses in the payload break.** NAT rewrites headers, not bodies. Anything that announces its own IP address inside the message — old FTP, some SIP setups — needs a protocol-aware helper on the NAT box or it simply fails.

**You lose the client's real address.** Everything behind one NAT gateway looks like one IP to the outside world. That matters for [Rate Limiting](/learn/system-design/rate-limiting) by IP, for geolocation, and for audit logs. Once traffic passes through an L7 proxy you get it back via `X-Forwarded-For`, but only because the proxy deliberately puts it there.

---

## IPv6, honestly

IPv6 widens the address to 128 bits, written as eight groups of four hex digits: `2001:0db8:85a3:0000:0000:8a2e:0370:7334`. The space is about 340 undecillion addresses — enough that every device on earth can have a globally unique one, with room left over for several more earths.

The point isn't the size for its own sake. It's that with enough addresses, **NAT stops being necessary**, and every consequence in the section above goes away. End-to-end connectivity works again.

Adoption has been slow because there's no flag day. IPv4 and IPv6 aren't compatible, so hosts run both stacks side by side during the transition, and the transition has been going on for two decades. In practice your servers get a private IPv4 address, your public-facing load balancer gets both, and you mostly don't think about it.

For interviews, the useful IPv6 facts are short: bigger addresses, no NAT needed, and `AAAA` is the DNS record type that carries one. → [DNS](/learn/system-design/dns)

---

## Addresses move, which is why you never hardcode one

One more thing about addresses, and it's the one that shapes designs most.

Almost nothing configures its own address any more. A machine boots, asks on the local network, and a DHCP server leases it one for a while. That's fine for laptops. It's also how most cloud instances work: the address is assigned at launch and released at termination.

So consider what happens when the inventory service crashes and its replacement comes up. Same code, same role, **different address.** Every service that hardcoded `10.0.4.22` is now talking to nothing, or worse, to whatever instance later got handed that address.

You can push back on this a little by reserving a static address for things that genuinely need one — a NAT gateway, a database, anything a partner has allowlisted. But static addresses don't scale to a fleet that autoscales, and they don't survive an instance being replaced in a different availability zone.

**The general answer is a layer of indirection: address something stable that resolves to the current address.** That's a name resolved through [DNS](/learn/system-design/dns), or a load balancer with a fixed address in front of a changing pool ([Load Balancing](/learn/system-design/load-balancing)), or an internal registry that services query directly ([Service Discovery](/learn/system-design/service-discovery)). All three are the same move — put a name where the number was.

This is also why the interesting failures in this area are cache failures rather than addressing failures. Something held onto a resolved address past the point where it was true.

## Where this shows up

- **VPC and subnet design on any cloud.** You pick a CIDR block for the VPC, carve it per availability zone, and split public from private. Get the arithmetic wrong and you can't add a zone later without renumbering.
- **Security groups and firewall rules** are written in CIDR: "allow port 5432 from `10.0.4.0/22`" is how you say "app tier only."
- **NAT gateways as a scaling bottleneck.** A single NAT gateway has a finite number of ports per destination, so a fleet making millions of outbound calls to one third-party API can exhaust them and start failing connections.
- **IP allowlists between companies.** Partner integrations often pin to a fixed set of egress addresses, which is why services keep a small stable block of public IPs rather than rotating them.

## In an interview

Bring this up when you're drawing network boundaries — which tier is public, which is private, and what sits at the edge.

The most common push is "how does a request from the internet actually reach this service?" The answer walks inward: public DNS name → public address on a load balancer → private address of an app server. If you've drawn app servers with public addresses, expect to be asked why.

The most common mistake is conflating "has a private IP" with "is secure". A private address only means unroutable from outside; anything inside the network can still reach it. Say what enforces the boundary — security groups, firewall rules — not just where the box is drawn.

If they ask about IPv6, don't overreach. Bigger address space, removes the need for NAT, dual-stack during migration. That's the whole expected answer.

## Related
[OSI Model](/learn/system-design/osi-model) · [TCP and UDP](/learn/system-design/tcp-and-udp) · [DNS](/learn/system-design/dns) · [Load Balancing](/learn/system-design/load-balancing) · [Proxies](/learn/system-design/proxies) · [CDN](/learn/system-design/cdn)

## Sources
- [RFC 4632 — Classless Inter-domain Routing (CIDR)](https://datatracker.ietf.org/doc/html/rfc4632)
- [RFC 1918 — Address Allocation for Private Internets](https://datatracker.ietf.org/doc/html/rfc1918)
- [RFC 3022 — Traditional IP Network Address Translator (Traditional NAT)](https://datatracker.ietf.org/doc/html/rfc3022)
- [Hello Interview — Networking Essentials for System Design Interviews](https://www.hellointerview.com/learn/system-design/core-concepts/networking-essentials)
- [Karan Pratap Singh — System Design: IP](https://www.karanpratapsingh.com/courses/system-design/ip)
