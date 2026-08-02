# X — vLLM from the inside

vLLM is more than PagedAttention now.

V1’s real story: kill the host-side tax — process split, a token-budget scheduler, a KV block pool with prefix caching, and piecewise CUDA graphs around eager attention.

Architecture notes: https://kmrrohit.space/writing/vllm-architecture

---

## Optional thread

1/ “The PagedAttention one” was 2023. The engine that grew on top is the interesting part.

2/ When a GPU step is ~10 ms, 3 ms of Python is a 30% tax. A lot of V1 is an attack on that tax — not a new attention kernel.

3/ Outside-in walkthrough: API/EngineCore split → scheduler → block pool → persistent batch → one request end to end.

4/ https://kmrrohit.space/writing/vllm-architecture
