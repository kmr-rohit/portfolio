# X — The two clocks

Almost everything hard about serving an LLM comes from one fact: generation runs on two clocks.

Prefill is compute-bound. Decode is memory-bound. The KV cache, batching, PagedAttention, speculative decoding — all of them are moves in that game.

https://kmrrohit.space/writing/the-two-clocks

---

## Optional thread

1/ Training once. Serving a billion times. The economics of a deployed LLM live on the inference side — and the wall has a specific shape.

2/ Prefill: big parallel pass, tensor cores busy. Decode: one token at a time, skinny matvecs, chip waiting on HBM.

3/ That asymmetry is why the KV cache exists, why batching is nearly free for decode, and why frontier stacks now split prefill and decode onto separate GPU pools.

4/ Full walkthrough (10 sections, from roofline to metrics): https://kmrrohit.space/writing/the-two-clocks
