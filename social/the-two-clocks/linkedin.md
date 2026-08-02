# LinkedIn — The two clocks

Training a model is something you do once. Serving it is something you do a billion times — and most of the hard parts of LLM inference come from one fact:

Generation runs on **two clocks**.

**Prefill** is a big parallel pass over the prompt. The tensor cores are busy. **Decode** is one skinny step per token — mostly waiting on memory while those same cores sit idle.

Almost every serious serving trick is a move in that game:
- the KV cache (trade recompute for memory)
- continuous batching (spend idle decode compute on more sequences)
- PagedAttention, FlashAttention, quantization, speculative decoding
- and finally disaggregation — giving each clock its own hardware

I wrote this as a first-principles walkthrough of why those techniques exist, not just what they are called.

Read: https://kmrrohit.vercel.app/writing/the-two-clocks

#LLM #Inference #GPUs #Systems
