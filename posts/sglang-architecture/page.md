---
title: SGLang, or a runtime that remembers
description: An architecture breakdown of the other serving engine — a radix tree over the KV cache, a scheduler that runs a step ahead of the GPU, and a grammar engine that skips tokens it can already predict.
date: '2026-07-05'
tags:
  - SGLang
  - Inference
  - Architecture
draft: false
---

If [vLLM](/writing/vllm-architecture) starts from the observation that KV cache memory should be managed like virtual memory, SGLang starts from a different one: **the calls an application makes to an LLM are not independent.** They branch from shared prefixes, they repeat, and they come back. A runtime that models that structure can avoid work that a request-at-a-time engine has no way to see.

That single premise produces most of what is distinctive about the system. This is a walk through it.

## The observation

Look at what real LLM applications actually send. A multi-turn chat resends the entire conversation every turn, growing by one exchange. A few-shot pipeline sends the same twelve examples in front of every query. An agent resends its system prompt, its tool definitions and its scratchpad on every step of the loop. Self-consistency sampling sends the *same* prompt eight times and diverges only in the continuations.

Drawn out, these are not a list of requests. They are a tree.

```
        [ system prompt + tool defs ]
                    │
        ┌───────────┼───────────┐
        │           │           │
   [ turn 1 ]  [ turn 1' ]  [ turn 1'' ]
        │           │
   [ turn 2 ]  [ turn 2' ]
        │
   [ turn 3 ]

   every edge is KV state that already exists somewhere
```

vLLM's hash-chained prefix cache captures a good chunk of this: identical prefixes hash identically and get shared. But the data structure underneath is a flat pool with a hash table over it, which answers "does this exact block exist?" It does not naturally answer "what is the longest prefix of this new request that I already have?", and it does not give the scheduler a way to *order* requests so that shared work lands close together in time.

SGLang's answer is to make the tree explicit.

## RadixAttention

The KV cache is indexed by a radix tree — a trie whose edges carry token sequences rather than single characters. Each node owns the KV blocks for its edge's tokens. A new request walks the tree from the root, matching as far as it can, and only computes the suffix that falls off the end.

```
 insert: "You are a helpful assistant. What is the capital of France?"

 root
  └─"You are a helpful assistant. "        <── matched, reuse KV
      ├─"What is the capital of France?"   <── matched, reuse KV
      └─"Summarise this document:"
                                           nothing new to compute
```

Three properties follow, and they are the whole argument for the design.

**Longest-prefix matching is the natural query.** Walking a radix tree returns the deepest match automatically, at any granularity, without needing the shared region to align to block boundaries the way a hash-chained scheme prefers.

**Eviction is tree-shaped.** The cache is finite, so entries have to go. SGLang runs LRU eviction over *leaves*, which means an interior node — a prefix that many branches depend on — cannot be evicted while anything below it is alive. A flat LRU has no idea that one block is load-bearing for forty others. The tree encodes that dependency structure for free.

**The scheduler can see the tree.** This is the part that is genuinely hard to retrofit. If the runtime knows request R shares 900 tokens with a request currently in flight, it can schedule R *now*, while those blocks are certainly resident, rather than in three hundred milliseconds when they may have been evicted. SGLang orders the waiting queue by matched prefix length, which turns cache hit rate from something you hope for into something the scheduler optimises.

```
 cache-agnostic order        cache-aware order
 ─────────────────────       ────────────────────
 R1  (matches A, 900 tok)    R1  (matches A, 900)  ─┐ batched together,
 R2  (matches B,  40 tok)    R3  (matches A, 880)  ─┘ A stays resident
 R3  (matches A, 880 tok)    R5  (matches A, 850)  ─┘
 R4  (matches C, 120 tok)    R4  (matches C, 120)
 R5  (matches A, 850 tok)    R2  (matches B,  40)

 A may be evicted between      A is touched by three
 R1 and R3                     consecutive batches
```

The cost is real: maintaining a tree is more bookkeeping than maintaining a hash table, and for workloads with no shared structure — a stream of unrelated one-shot prompts — you pay for machinery you do not use. The bet is that such workloads are rare in practice, and it is a good bet. Agents and chat are almost entirely prefix reuse.

The same idea extends past one process. When you run several replicas, a cache-aware router can send a request to the replica whose tree already holds its prefix, rather than round-robining and forcing a recompute. Load balancing that ignores cache locality is leaving a large fraction of prefill on the table.

## The scheduler that runs ahead

The second distinctive piece is about CPU overhead, and it is the same problem vLLM attacks with a process split and a persistent batch — solved differently.

Every step, the host has real work to do: pick the batch, allocate and free cache blocks, walk the radix tree, build input tensors, and afterwards process sampled tokens. Meanwhile the GPU is executing a forward pass that, for a decode step, might take ten milliseconds. Done in sequence, the GPU idles through all the host work.

SGLang's overlap scheduler runs the host-side work for step *n+1* while the GPU is still computing step *n*.

```
 sequential
 CPU  ██ sched ██          ██ sched ██          ██ sched ██
 GPU           ▓▓▓ fwd ▓▓▓           ▓▓▓ fwd ▓▓▓
               └─ GPU idle during every scheduling gap

 overlapped
 CPU  ██ sched n+1 ██ sched n+2 ██ sched n+3 ██
 GPU  ▓▓▓▓ fwd n ▓▓▓▓ ▓▓▓ fwd n+1 ▓▓▓ ▓▓▓ fwd n+2 ▓▓▓
      └─ GPU never waits for Python
```

The awkwardness is that scheduling step n+1 requires knowing what step n produced — a sequence that emitted an end-of-sequence token should not be scheduled again. SGLang handles this by scheduling optimistically against placeholder outputs and reconciling once the real tokens land, which costs a small amount of speculative work in exchange for keeping the GPU saturated. When your forward pass is ten milliseconds, hiding three milliseconds of Python is a 30% throughput swing, so the trade is not close.

## Constrained decoding that skips ahead

The third piece is where SGLang's frontend heritage shows, and it is my favourite trick in the system.

Suppose you want strict JSON matching a schema. The standard approach compiles the grammar to a finite state machine and, at each decode step, masks the logits to only those tokens the FSM permits. Correct, and universally implemented, but it still spends a full forward pass per token — including on tokens where the grammar leaves exactly one option.

Consider generating an object with a known key. After the opening brace, the grammar permits precisely one continuation: a quote, then `n`, `a`, `m`, `e`, then a quote, then a colon. Seven forward passes to produce a string the FSM could have told you about before the first one.

Jump-forward decoding compresses those runs out of the state machine. Any path through the FSM with a single outgoing edge is collapsed into a deterministic string, and when decoding reaches such a state the runtime simply appends the whole string and advances — no forward pass at all.

```
 plain FSM-masked decoding
 step:  1    2    3    4    5    6    7    8
 out:   {    "    n    a    m    e    "    :     ← 8 forward passes

 with jump-forward
 step:  1    ────────── jump ──────────    2
 out:   {    "name":                      "Rohit"
        └ 1 pass  └ 0 passes (determined) └ real generation
```

For schema-heavy output — tool calls, structured extraction, anything where the scaffolding outweighs the content — this removes a large share of the decode steps outright. And the win compounds with everything else in the post, because the steps it eliminates were memory-bound decode steps, the most expensive kind of token you can produce.

The subtlety is tokenizer alignment. Jumping forward by a string rather than a token can leave you mid-token relative to how the model would have tokenized that text, and getting the retokenization boundary wrong corrupts the continuation. Handling that correctly is most of the actual implementation difficulty.

## The frontend

SGLang began as a *language* — the name is short for Structured Generation Language — and the frontend is still there: a Python DSL where you express a generation program with primitives for calling the model, choosing between options, forking into parallel branches and joining them back.

```python
@sgl.function
def compare(s, question):
    s += sgl.system("You are a careful analyst.")
    s += sgl.user(question)

    # fork three independent continuations from the same state
    forks = s.fork(3)
    for f in forks:
        f += sgl.assistant(sgl.gen("answer", max_tokens=256))

    s += sgl.user("Pick the strongest of these three answers.")
    s += sgl.assistant(sgl.gen("verdict"))
```

The point is not syntax, it is that the runtime *knows the fork happened*. Three branches from one state means three sequences that share a prefix by construction — the radix tree gets that information declared rather than having to rediscover it by hashing. The frontend and RadixAttention are the same idea approached from opposite ends: the language tells the runtime about structure, and the runtime is built to exploit structure.

In practice most people now use SGLang through its OpenAI-compatible server and never touch the DSL, and the prefix sharing still works because the tree infers it. But the design order explains why the engine looks the way it does.

## Reading the two engines together

vLLM and SGLang solve the same problem and converge on much of the same feature set — continuous batching, chunked prefill, paged KV memory, tensor parallelism, speculative decoding, structured output. Where they differ is instructive, because the differences trace back to the founding observation in each case.

| | vLLM | SGLang |
|---|---|---|
| Founding insight | KV memory should be paged | LLM workloads are structurally repetitive |
| Cache index | hash-chained blocks in a flat pool | radix tree over token sequences |
| Eviction | LRU over free blocks | LRU over tree leaves, respecting dependents |
| Scheduling | token budget, cache-agnostic ordering | token budget, ordered by matched prefix |
| CPU overhead | separate process, persistent batch | scheduler overlapped a step ahead |
| Constrained output | grammar-masked logits | grammar-masked plus jump-forward |

Neither list is a verdict. Both engines are fast, both are moving quickly, and published benchmarks between them flip with every release and every workload shape. What is durable is the reasoning: if your traffic is a stream of unrelated prompts, the tree is overhead. If your traffic is agents and conversations — mostly the same tokens, over and over, branching — then a runtime that models the branching has structural information the other one has to infer.

The thing I would take away, if you build on top of these rather than on them: **both engines are trying very hard to avoid recomputing your prefix, and you can help or hinder that with prompt layout alone.** Stable content first, volatile content last. That single habit is worth more than most of the tuning flags.
