# LinkedIn — SGLang, or a runtime that remembers

If vLLM starts from “manage KV like virtual memory,” SGLang starts from a different premise:

**The calls an application makes to an LLM are not independent.**

They branch from shared prefixes. They repeat. They come back. Drawn out, real traffic is a tree — chat history, few-shot prompts, agent loops, self-consistency forks.

SGLang makes that tree explicit:

- **RadixAttention** — a radix tree over the KV cache so longest-prefix match is the natural query
- **Cache-aware scheduling** — order work so shared prefixes stay resident
- **Overlapped scheduling** — run host work for step n+1 while the GPU finishes step n
- **Jump-forward decoding** — skip forward passes for tokens the grammar already determined

I wrote this as a companion to the vLLM piece — same level of detail, different design bet.

Read: https://kmrrohit.vercel.app/writing/sglang-architecture

#SGLang #Inference #LLM #Systems
