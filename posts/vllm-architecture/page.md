---
title: vLLM from the inside
description: An architecture breakdown of the default open-source serving engine — the scheduler that stopped distinguishing prefill from decode, the block pool underneath PagedAttention, and where the CPU overhead went.
date: '2026-05-23'
tags:
  - vLLM
  - Inference
  - Architecture
draft: false
---

Most people know vLLM as "the PagedAttention one". That was true in 2023. The paper's core idea — treat KV cache memory as paged virtual memory — is still the foundation, but the engine that has grown on top of it is now a fairly elaborate piece of systems software, and the interesting parts are mostly not the attention kernel.

This post builds the engine from the outside in. We start with the shape of a request, then the scheduler that stopped caring about prefill vs decode, then the block pool that made PagedAttention real, and finally the host-side tax that V1 spent most of its energy killing. I am assuming you already have the [prefill/decode picture](/writing/the-two-clocks); if not, that post is the prerequisite.

**What we'll cover**

1. The API server / EngineCore split
2. The token-budget scheduler (and the distinction it dropped)
3. The KV block pool, admission control, and prefix caching
4. Persistent batches and piecewise CUDA graphs
5. One request's life, end to end
6. What is being built on top — disaggregation and offload

## The shape of the thing

At the top level vLLM splits into a front-end that speaks to users and a core that speaks to GPUs, and — since the V1 rewrite — those live in *separate processes* connected by a message queue.

![vLLM V1 puts tokenization and HTTP in one process and the GPU loop in another, linked by ZeroMQ.](/sketches/vllm-process-split.svg)

The split matters more than it looks. Tokenization, detokenization and HTTP serialisation are pure Python, and in V0 they ran on the same thread as the scheduling loop. Every millisecond spent turning token ids back into UTF-8 was a millisecond the GPU spent idle between forward passes. Pushing them into their own process means the engine loop does almost nothing but schedule and launch, and the two halves overlap.

This is a recurring theme in the V1 design and worth naming up front: **when the GPU step takes 10 ms, 3 ms of Python overhead is a 30% tax.** Most of the rewrite is an attack on that tax rather than on any GPU kernel.

## The scheduler, and the distinction it dropped

The single most clarifying change in V1 is what the scheduler *stopped* modelling.

V0 had explicit prefill and decode phases, with separate code paths, separate batching rules and a state machine to move requests between them. V1 threw that away. The scheduler now works on one thing: a **token budget** per step. Each iteration it walks the queue and decides how many tokens to process for each request, producing something conceptually as simple as:

```python
# what the scheduler hands to the model runner each step
{
    "req-a": 3,     # 3 tokens: a speculative chunk being verified
    "req-b": 1,     # 1 token: an ordinary decode step
    "req-c": 512,   # 512 tokens: a chunk of a long prefill
}
```

That is the whole interface. A request being prefilled and a request being decoded are the same kind of entry, differing only in the number. This falls out naturally once you accept chunked prefill: if a 4,000-token prompt can be split into eight chunks of 512 and fed through across eight steps, then "prefill" is just "a step with many tokens" and "decode" is "a step with one".

The payoff is that prefill and decode mix in a single batch. A newly arrived long prompt no longer blocks everyone's token stream while it processes — its chunks interleave with other requests' decode steps, and the convoy effect largely disappears. You trade a little prefill latency for a much steadier stream, which is almost always the right trade for interactive workloads.

It also makes several features fall out for free rather than needing special cases. Speculative decoding is a request that wants k tokens verified this step. Prefix-cached prefill is a request whose token count happens to be smaller because most of its prompt was already computed. Chunked prefill is the default rather than a mode you enable.

> The lesson generalises: much of the complexity in the old scheduler existed to maintain a distinction that the hardware does not actually care about. The GPU sees a batch of tokens.

## Memory: the block pool

Underneath sits the part everyone knows about, though the implementation has more machinery than the paper suggests.

GPU memory is carved up at startup. vLLM runs a profiling pass, measures peak activation memory for the configured maximum batch, subtracts that and the model weights from total memory, and turns whatever is left into a fixed pool of KV blocks. Each block holds a fixed number of tokens — 16 is the common default — for every layer and KV head.

![After weights and activation peak, leftover HBM becomes a fixed queue of KV blocks.](/sketches/kv-block-pool.svg)

A sequence never sees this. It sees a contiguous run of logical blocks, and a **block table** maps each to a physical index. When a sequence grows past its current block it takes one more from the free queue. When it finishes, its blocks go back. That is the whole allocation story, and it is why memory waste drops from the 60–80% that contiguous pre-reservation used to burn down to a few percent.

The consequence people underrate is that the *scheduler* now has a hard, precise admission criterion. It knows exactly how many free blocks exist, so it knows exactly whether the next request can be admitted without over-committing. There is no guessing and no fragmentation-induced failure. When memory does run short, vLLM preempts: it evicts the blocks of a lower-priority running sequence and puts it back in the waiting queue, either recomputing its prefix later or swapping the blocks to CPU memory.

### Prefix caching

Once KV state lives in shared, addressable blocks, sharing it between requests becomes an addressing problem rather than a memory-management one.

vLLM hashes each block by the tokens it contains *plus the hash of the block before it*. That prefix-chained hash means two sequences with an identical first 600 tokens produce identical hashes for the blocks covering them, and the second request can simply point its block table at the blocks the first one already filled.

![Two requests with the same system prompt share the physical blocks for that prefix.](/sketches/prefix-cache.svg)

Blocks are reference-counted; a freed block whose refcount is still positive stays alive. Freed blocks go onto an LRU-ordered queue rather than being wiped, so a block can be re-adopted by a later matching request until the pool needs to reuse it. In V1 the bookkeeping was made cheap enough to leave this on by default, which for anything with a long shared system prompt — which is every agent, every RAG pipeline — cuts a large fraction of prefill work outright.

The interaction with prompt design is worth stating explicitly, because it changes how you write applications: **anything that varies early in the prompt invalidates every cached block after it.** Putting a timestamp or a per-request id at the top of your system prompt silently destroys prefix reuse for every request. Put the volatile parts last.

## The execution path

The scheduler's output goes to the model executor, which fans it out to one worker per GPU. Each worker owns a ModelRunner, and the ModelRunner is where a second class of overhead was hiding.

The naive implementation rebuilds input tensors from Python lists every step — token ids, positions, block tables, sequence lengths, slot mappings. For a batch of 256 sequences that is a meaningful amount of allocation and host-to-device copying per iteration, and it happens on the critical path.

V1 keeps a **persistent batch** instead. The input tensors live for the lifetime of the runner and are updated in place: when a request finishes, its slot is marked free and the next admitted request writes into that slot. Only the deltas move to the device. It is an unglamorous change and one of the larger latency wins in the rewrite.

Below that, the forward pass runs under CUDA graphs. Capturing a graph removes per-kernel launch overhead, which matters enormously for decode, where the kernels are small and there are hundreds of them per step. The complication is that attention has dynamic shapes and cannot be captured naively, so vLLM uses **piecewise graphs**: `torch.compile` splits the model, attention is left out as an eager region, and the long stretches of dense ops around it are captured.

![Piecewise CUDA graphs capture dense ops around an eager attention region.](/sketches/cuda-graphs.svg)

Attention itself dispatches to a backend — FlashAttention, FlashInfer, or a platform-specific kernel — through a common interface. The backends differ in which hardware and which features they support, and the abstraction is genuinely load-bearing: it is how vLLM runs on NVIDIA, AMD, TPU and CPU from one codebase.

## Where the request actually goes

Putting it together, one request's life:

1. Arrives at the API server. Tokenized, multimodal inputs preprocessed, pushed over IPC to EngineCore.
2. Enters the waiting queue. The scheduler checks whether enough free KV blocks exist to admit it.
3. On admission, the KV cache manager computes block hashes for its prompt and looks them up. Any matching blocks are adopted by reference, so only the uncached suffix needs computing.
4. The remaining prompt is scheduled across one or more steps as chunks, interleaved with other requests' decode steps.
5. Each step, the ModelRunner updates its persistent batch in place and launches the forward pass. Sampled tokens come back.
6. Token ids stream back over IPC, get detokenized in the front-end process, and go out over SSE.
7. On completion, blocks are released to the LRU queue — still hashed, still adoptable by the next request with a matching prefix.

## What is being built on top

Two directions are worth watching, because they are where the architecture is being stretched.

**Disaggregated serving.** The two-clocks argument says prefill and decode want different hardware. vLLM now supports splitting them across instances through a KV connector interface, with implementations like NIXL and LMCache handling the transfer. The engine change is smaller than you would expect precisely because the KV cache was already an addressable pool of blocks rather than a tangle of per-sequence allocations — "ship these blocks over there" is a sensible operation on that data structure in a way it would not have been on the pre-2023 design.

**KV cache offload.** The same abstraction lets blocks live somewhere other than HBM: CPU memory, local NVMe, or a shared cluster-wide cache. For agent workloads, where the same long conversation comes back after a minute of tool execution, keeping its KV state warm somewhere cheap is worth far more than recomputing a 30,000-token prefill.

Both are the block pool paying off a second time. The original design decision was made to stop fragmentation; it turned out to be the thing that made cache mobility possible a few years later.

## The through-line

If you want one sentence for the whole architecture: **vLLM's original insight was that KV cache memory should be managed like virtual memory, and its second insight was that Python is the bottleneck once you have done that.**

The first gave the field PagedAttention, prefix sharing, precise admission control and eventually cache mobility. The second produced the process split, the token-budget scheduler, the persistent batch and piecewise CUDA graphs — none of which have anything to do with machine learning, and all of which came from the observation that a 10 ms GPU step cannot afford a 3 ms host-side tax.

[SGLang](/writing/sglang-architecture) starts from a different first insight — that the *structure* of the workload, not just its memory, is exploitable — and arrives at a noticeably different engine. Reading the two side by side is the fastest way I know to understand which parts of a serving stack are essential and which are one team's answer to a question with several good ones.
