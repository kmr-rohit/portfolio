---
title: The two clocks
description: Almost everything hard about serving a large language model comes from one fact — generation runs on two different clocks, and they are not the same speed.
date: '2026-03-14'
tags:
  - Inference
  - GPUs
  - Serving
draft: false
---

Training a model is something you do once. Serving it is something you do a billion times. The economics of a deployed LLM live almost entirely on the inference side, and yet most people's mental model stops at "run the forward pass and sample a token."

That model is fine right up until you have to make it fast, cheap and concurrent. Then you hit a wall, and the wall has a very specific shape. It is not that GPUs are slow — modern accelerators have absurd amounts of compute. The wall is that during generation, most of that compute sits idle while the chip waits on memory.

This post builds the picture from the ground up. We start with the single observation that organises everything — inference runs in two phases with opposite bottlenecks — and then derive, one at a time, why the KV cache has to exist, why batching is nearly free, why a trick borrowed from operating systems made serving an order of magnitude cheaper, and why the frontier labs now run the two phases on physically separate machines.

## The tour

1. Prefill and decode: the two clocks
2. The KV cache, and why it must exist
3. The roofline: proving decode is memory-bound
4. Batching: from static to continuous
5. PagedAttention: an OS trick for the KV cache
6. FlashAttention: never write the big matrix
7. Quantization: trading bits for bandwidth
8. Speculative decoding: buying compute with compute
9. Parallelism and disaggregation
10. Metrics: what "fast" actually means

## 1. Prefill and decode

An LLM generates text autoregressively: it reads a prompt, produces one token, appends it, and repeats. That single loop contains two very different kinds of work.

**Prefill** is what happens to your prompt. All N prompt tokens go through the network at once, in one large parallel forward pass. Every token attends to every earlier token, the matrix multiplies are big and dense, and the tensor cores are saturated. Prefill produces exactly one thing you can see — the first output token — plus a large hidden byproduct we will get to shortly.

**Decode** is what happens after. Now you generate one token at a time. Each step feeds a single new token through the whole network and out comes the next one. The matrix multiplies degenerate into skinny matrix-vector products. There is almost no parallel work available to hide the cost of reading the model's weights out of memory.

![Prefill is one parallel pass; decode is many skinny memory-bound steps.](/sketches/two-clocks.svg)

This distinction is the load-bearing idea of the entire field. Hold onto it, because every technique that follows is an answer to the same question: given that decode wastes the GPU's compute, how do we get that compute back?

> **Takeaway.** Prefill is compute-bound. Decode is memory-bound. They are the two clocks, and they tick at very different rates.

## 2. The KV cache, and why it must exist

Here is a question that pins down why decode behaves the way it does. In attention, each token's output depends on the keys and values of every token before it. When you generate token 500, you need K and V for tokens 1 through 499.

The naive approach recomputes them from scratch every step. That is quadratic waste — by the time you finish a long response you have re-derived the same early keys hundreds of times. So instead you compute each token's K and V once and keep them. That store is the KV cache, and it is the large hidden byproduct that prefill was quietly building the whole time.

![Prefill writes Keys and Values into the KV-cache; decode restores them and only appends the new token.](/sketches/prefill-decode-kv.svg)

The cache is a spectacular optimisation for compute, but it moves the problem. That state is enormous, it grows with every token, and it lives in the same scarce GPU memory as the model weights. The size is worth committing to memory:

```
KV bytes per token = 2 × layers × kv_heads × head_dim × dtype_bytes
                     ^
                     one each for K and V
```

Plug in Llama-2-70B — 80 layers, and thanks to grouped-query attention only 8 KV heads of dimension 128, in fp16:

```
2 × 80 × 8 × 128 × 2 bytes  ≈  320 KB per token
                             × 4096 tokens
                             ≈  1.3 GB for a single sequence
```

Now imagine a hundred concurrent users with a few thousand tokens of context each. The KV cache, not the model weights, becomes the thing that decides how many requests you can serve at once. This one number is why half the techniques in this post exist.

That "8 KV heads" is not an accident, incidentally. Plain multi-head attention would use all 64 heads and blow the cache up eightfold to 2.5 MB per token. Grouped-query attention lets many query heads share a single K/V head — an architectural choice made specifically to shrink the inference-time cache. The model is co-designed with its own serving cost in mind.

> **Takeaway.** The KV cache trades recompute for memory. It makes decode cheap in FLOPs but turns GPU memory capacity into the real limit on concurrency.

## 3. The roofline

We keep asserting that decode is memory-bound. Let us actually show it, because the proof tells us exactly what to do about it.

Every GPU has two headline numbers: how many floating-point operations per second it can do, and how fast it can move bytes between HBM and the chip. The ratio gives a break-even point called the ridge. For an H100 it is roughly a few hundred FLOPs of work per byte read.

A kernel's *arithmetic intensity* is how much math it does per byte it touches. Above the ridge you are compute-bound, which is where you want to be. Below it you are memory-bound and the tensor cores starve while the chip waits.

Decode's intensity is trivial to estimate. To generate one token a dense model does about `2 × params` FLOPs and must read about `params × dtype_bytes` bytes of weights. In fp16 that is:

```
intensity ≈ (2 × params) / (2 bytes × params) ≈ 1 FLOP per byte
```

One FLOP per byte, against a ridge of several hundred. Decode is not merely below the ridge — it is on the floor. The tensor cores are almost entirely idle and the whole step is, functionally, a memory read of the model.

```
 throughput
     ▲
     │              ┌──────────────────  compute roof
     │            ╱ │
     │          ╱   │        ● prefill
     │        ╱     │
     │      ╱       ridge
     │    ╱
     │  ╱ ● decode  (~1 FLOP/byte)
     └────────────────────────────────>  arithmetic intensity (log)

     batching moves decode rightward:
     more work per weight-read, same bytes moved
```

This yields the most useful consequence in all of serving: **because decode is memory-bound, extra sequences are almost free.** When you read a weight matrix out of HBM you can multiply it against one token-vector or against sixty-four of them for nearly the same memory cost. The FLOPs go up 64x; the expensive memory traffic barely moves. You were wasting that compute anyway.

> **Takeaway.** Decode runs at roughly 1 FLOP per byte, far below the ridge. That wasted compute is the budget every serving optimisation spends.

## 4. Batching

If more sequences are free, batch them. Easy in principle, genuinely awkward in practice, because generation requests do not line up neatly. They arrive at different times and finish at wildly different lengths — one user wants yes or no, the next wants an essay.

Static batching is the naive version: gather N requests, run them together, return them together. The problem is the ragged finish line. The batch cannot move on until its slowest member is done, so every short request sits idle holding a GPU slot.

```
STATIC                                CONTINUOUS
blocked until the longest finishes    a freed slot refills immediately

req A  ████████░░░░░░░░               slot 1  ████│███████│████
req B  ███░░░░░░░░░░░░░               slot 2  ██│██████│███████
req C  ██████████████░░               slot 3  ███████│████│████
req D  ██████░░░░░░░░░                        │ = a request boundary
       └─ all released together
       ░ = slot held but idle                 slots stay full
```

The fix is continuous batching, sometimes called in-flight batching, introduced by the Orca paper and now standard in every serious serving stack. The insight is to stop treating a batch as a fixed group and start scheduling at the granularity of a single decode iteration. After each step, finished sequences leave, waiting sequences join, and the batch is reassembled on the fly. No slot sits idle waiting for a straggler.

This one change is often worth a 10–20x throughput improvement over static batching, and it is the reason a single GPU can serve many concurrent users at all. But it creates a new headache. If sequences are constantly entering and leaving with different, growing lengths, how do you manage KV-cache memory for all of them without it turning into swiss cheese?

> **Takeaway.** Schedule at the iteration, not the batch. Continuous batching keeps every slot full and converts decode's free compute into real throughput.

## 5. PagedAttention

Before vLLM, serving systems reserved KV-cache memory the obvious way: one contiguous block per sequence, sized for the maximum possible length. This is disastrous. If a request *might* reach 2,048 tokens you reserve for 2,048 even if it stops at 30. The unused space is stranded — internal fragmentation — and the fixed-size holes left by finished requests rarely fit the next one, which is external fragmentation. Measurements found real systems wasting 60–80% of their KV memory this way.

![External fragmentation: free bytes exist, but not as one contiguous run a new request can use.](/sketches/external-fragmentation.svg)

The fix is lifted straight out of operating systems. Your OS does not hand a process one contiguous run of physical RAM. It hands out fixed-size pages and keeps a page table mapping the process's tidy logical address space onto scattered physical frames. PagedAttention does exactly this for the KV cache.

![GPU memory left after weights and activations is carved into a fixed pool of KV blocks.](/sketches/kv-block-pool.svg)

Grow one block at a time — no over-reservation, no fragmentation. Two requests sharing a system prompt point their block tables at the *same* physical blocks: copy-on-write, exactly like forked processes.

![Shared system-prompt blocks are reference-counted across requests.](/sketches/prefix-cache.svg)

The payoff is twofold. Memory waste drops from roughly 70% to a few percent, so you fit far more concurrent sequences — which, remember, is the actual constraint on throughput. And you get prefix sharing almost free: many requests share a long system prompt, and now they can share the physical KV blocks for it, exactly like forked Unix processes sharing pages. This is the idea that made vLLM the default open-source serving engine, and I have written a [longer breakdown of how the rest of that engine fits together](/writing/vllm-architecture).

> **Takeaway.** Treat the KV cache as paged virtual memory. Fixed blocks plus a block table kill fragmentation and unlock prefix sharing.

## 6. FlashAttention

PagedAttention solved *where* the cache lives. FlashAttention solves how the attention computation itself touches memory, and it is a lovely example of the same theme: the bottleneck is memory traffic, not math.

Standard attention computes the full N×N score matrix, writes it to HBM, reads it back to apply softmax, writes it again, and reads it once more to multiply by V. For long sequences that intermediate matrix is huge and quadratic, and all that round-tripping — not the multiplies — dominates the time.

FlashAttention refuses to ever materialise the full matrix in HBM. It is IO-aware: it tiles the computation into blocks small enough to live in the chip's fast on-die SRAM, and uses an online softmax, a running normalisation trick that accumulates the correct softmax-weighted result block by block without ever seeing all the scores at once.

```
STANDARD                          FLASH

HBM ──── N×N scores ────┐         HBM ── K,V once ──┐
 ▲                      │                           ▼
 └──── write/read ×3 ───┘         SRAM: tile ─> online softmax
                                        (matrix never leaves chip)
 quadratic traffic dominates                       │
                                                   ▼
                                              output, one pass
```

Same numbers, a fraction of the memory traffic, and no quadratic memory footprint — which is also what makes long context windows tractable at all. It is now the default attention kernel essentially everywhere.

> **Takeaway.** Attention was memory-bound too. Tile into SRAM and use an online softmax so the N×N matrix is never written out.

## 7. Quantization

Return to the roofline once more. Decode's cost is bytes moved, and the weights are the biggest thing you move each step. So the most direct lever imaginable is to make the weights smaller.

Move from fp16 to int8 and you halve the bytes read per step, roughly doubling decode throughput. Go to 4-bit and halve it again. Because decode is bandwidth-bound this translates almost directly into speed — it is not just a memory-footprint win, it is a latency win.

There are three distinct things you can quantize and they buy different things:

- **Weights.** The big prize for decode. GPTQ and AWQ push to 4-bit with calibration-driven rounding that protects the weights that matter most, keeping quality loss small.
- **KV cache.** Quantizing K and V to int8 or lower shrinks the thing that limits concurrency, so you fit more sequences. This attacks the capacity bottleneck from section 2 directly.
- **Activations.** Quantizing the runtime tensors too, for example FP8 on H100-class hardware, lets the tensor cores run in a lower-precision, higher-throughput mode. This helps *prefill*. It is also the trickiest, because activations have nasty outliers.

The engineering is all in what breaks. Naive rounding wrecks quality because a few outlier values dominate the numeric range; the good methods isolate or rescale those outliers. The universal tradeoff is that fewer bits means more speed and less memory, right up until quality falls off a cliff — and where that cliff sits depends on the model, the method, and how much degradation your product can absorb.

The rule of thumb worth remembering: for memory-bound decode, quantize weights and the KV cache, because you are buying bandwidth and capacity. For compute-bound prefill, low-precision activations buy you tensor-core throughput. Match the technique to the clock you are trying to speed up.

> **Takeaway.** Fewer bits means fewer bytes moved means faster decode. Weights and KV cache for decode; activations for prefill.

## 8. Speculative decoding

Here is the cleverest trick in the set, and it falls straight out of the roofline. Decode's fundamental problem is that it is *sequential* — one token, one full memory read of the model, repeat — and during each read the tensor cores sit idle. We have spare compute. Speculative decoding spends it to break the sequential chain.

Use two models: a small fast draft model and the large target model you actually want. The draft cheaply guesses the next k tokens. Then — and this is the key move — the target verifies all k guesses in a *single* forward pass, because checking "would I have produced these?" is a parallel operation over the whole guessed chunk, exactly the kind of work decode is starved for.

```
1 · draft guesses k tokens        (cheap, sequential)
      the   cat   sat   on   a

2 · target verifies ALL of them   (one parallel forward pass)
      the✓  cat✓  sat✓  on✗  ─── drop the rest

    cost ≈ one normal decode step … but yields 3 tokens
```

If the draft agrees with the target you accept several tokens for the price of one target pass. If it diverges you keep the correct prefix and fall back, so you are never worse than plain decode by more than the draft's small overhead. And crucially, with the right acceptance rule — rejection sampling — the output distribution is provably identical to the target model's. It is a free lunch in quality terms: same model, fewer sequential steps.

The whole thing works precisely because decode had idle compute to burn. Variants like Medusa, which bolts extra prediction heads onto the target, and EAGLE, which drafts in feature space, refine how the guesses are produced, but the principle does not change: convert a memory-bound sequential bottleneck into parallel verification work the GPU was going to waste anyway.

> **Takeaway.** A cheap draft proposes, the target verifies many tokens at once. It spends idle decode compute to shorten the sequential chain, losslessly.

## 9. Parallelism and disaggregation

Everything so far fits a model on one GPU. Frontier models do not fit, and even when they do you split them to go faster. Two axes matter for inference, and they trade off differently than they do in training.

**Tensor parallelism** shards each layer's matrices across GPUs so they compute one token together. It cuts per-token latency and splits the weight-read across more aggregate bandwidth, which is great for memory-bound decode — but it needs a fast interconnect, because the GPUs synchronise with an all-reduce inside every layer.

**Pipeline parallelism** puts different layers on different GPUs and streams requests through like an assembly line. It is cheap on communication but adds latency and needs a full pipeline of work to stay busy. A throughput play, not a latency one.

The deepest structural idea in modern serving, though, comes from taking the two-clocks insight to its logical end. Prefill and decode have opposite resource profiles, and if you run them on the same GPUs they interfere. A long prefill stalls the steady drip of everyone else's decode tokens — a convoy effect — so you cannot tune the system for both at once.

```
              ┌─────────────────┐   ship KV   ┌──────────────────┐
 requests ──> │  PREFILL pool   │ ──────────> │   DECODE pool    │ ──> tokens
              │ compute-optimal │   (the one  │ bandwidth-optimal│
              │ big batches     │   handoff)  │ many sequences   │
              │ tuned for TTFT  │             │ tuned for TPOT   │
              └─────────────────┘             └──────────────────┘

        each pool scaled and tuned independently — no interference
```

So the frontier answer is disaggregation: run prefill and decode on physically separate GPU pools. DistServe and Mooncake showed it works, and P/D disaggregation now ships in vLLM and TensorRT-LLM. Prefill machines are provisioned and batched for compute, decode machines for bandwidth and concurrency. When prefill finishes it ships the KV cache over the interconnect to a decode machine, which streams out the tokens. The price is exactly that transfer, which is why so much recent engineering is about making the handoff cheap.

> **Takeaway.** Tensor parallelism cuts decode latency, pipeline parallelism raises throughput. And because the two clocks want opposite hardware, the frontier splits them onto separate pools entirely.

## 10. Metrics

You cannot optimise what you cannot name, and "fast" hides at least four different quantities that trade against each other. Notice how cleanly they map onto the two clocks.

- **TTFT**, time to first token. How long until the user sees anything. Dominated by prefill and queueing. This is what makes a chat feel responsive.
- **TPOT** or ITL, time per output token. The pace of the stream after the first token. Dominated by decode. It should comfortably beat human reading speed.
- **Throughput**, total tokens per second across all concurrent requests. This is the number that sets your cost per token, and it is what batching maximises.
- **Goodput**, the subtle one: throughput that actually meets your latency targets. You can crank raw throughput by batching harder, but past a point every request's per-token latency degrades and you are serving fast-but-unusable responses. Goodput counts only the requests that stayed inside their SLO.

```
 request in
     │
     ├─── prefill ───> 1st token ─── decode ─── decode ─── … done
     │<────TTFT─────>│            │<TPOT>│
```

The central tension of the whole field lives in these four numbers: latency versus throughput. Bigger batches raise throughput and lower cost but worsen each user's latency; smaller batches do the reverse. Every technique in this post is a way to shift that curve — to serve more tokens per second without blowing the latency budget. Goodput is how you keep score.

## One mental model to keep

If you remember nothing else, remember the two clocks, and that almost every technique here is a move in the same game.

Prefill is compute-bound and decode is memory-bound; that single asymmetry generates the whole design space. The KV cache trades recompute for memory and then becomes the real limit on how many users you can serve at once. Decode wastes compute at about 1 FLOP per byte, and every trick spends that waste differently — batching fills it with more sequences, speculative decoding fills it with verification, quantization shrinks the bytes so there is less to move. PagedAttention and FlashAttention both attack memory, one the cache's layout and the other attention's traffic, because memory rather than math is the adversary. And disaggregation is the two-clocks idea taken all the way: give each clock its own hardware.

Inference engineering looks like a grab-bag of unrelated hacks until you see the thread running through it. It is not a grab-bag. It is a sustained campaign against one opponent — the memory wall — fought on every front the system offers. Once you have that frame, a new paper or kernel or serving trick stops being mysterious. You just ask the two questions that organise everything: which clock does this speed up, and which resource is it spending to do it?

## Where to go next

Read the primary sources — the vLLM and PagedAttention paper, FlashAttention, Orca on continuous batching, DistServe and Mooncake on disaggregation, and the GPTQ and AWQ quantization work. Then go run vLLM or SGLang yourself and watch the throughput/latency curve move as you turn the knobs. The mental model only really sticks once you have felt the tradeoff with your own hands.

If you want the next level of detail on a specific engine, I have written architecture breakdowns of [vLLM](/writing/vllm-architecture) and [SGLang](/writing/sglang-architecture), which take different positions on several of the choices above.

*The framing here — two clocks, one memory wall — is mine. The techniques are not: they come from the papers named above. Numbers are order-of-magnitude estimates meant to build intuition rather than exact benchmarks, so verify against the primary sources before quoting them.*
