# X — SGLang, or a runtime that remembers

LLM calls are not independent — they form a tree of shared prefixes.

SGLang leans into that: RadixAttention over the KV cache, a scheduler that runs a step ahead of the GPU, and jump-forward decoding for grammar-determined tokens.

https://kmrrohit.space/writing/sglang-architecture

---

## Optional thread

1/ vLLM: manage KV like virtual memory. SGLang: applications don’t send independent requests — they branch and repeat.

2/ A radix tree makes longest-prefix reuse the natural query. The scheduler can then *order* work so shared prefixes stay hot.

3/ Plus: overlapped host/GPU scheduling, and jump-forward so deterministic grammar paths cost zero forward passes.

4/ https://kmrrohit.space/writing/sglang-architecture
