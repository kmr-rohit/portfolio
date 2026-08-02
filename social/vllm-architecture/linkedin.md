# LinkedIn — vLLM from the inside

Most people know vLLM as “the PagedAttention one.” That was true in 2023. The idea still sits at the foundation — but the engine on top is now a serious piece of systems software.

What I found most clarifying in V1:

1. **Process split** — tokenization/HTTP off the GPU loop (Python overhead is a real tax when a step is ~10 ms).
2. **Token-budget scheduler** — stop modelling prefill vs decode as separate phases; schedule tokens.
3. **Block pool + prefix cache** — fixed KV blocks, admission control, shared prefixes by reference.
4. **Persistent batches + piecewise CUDA graphs** — kill host-side churn around the forward pass.

I wrote an outside-in architecture walkthrough. Prerequisite: the prefill/decode picture in “The two clocks.”

Read: https://kmrrohit.space/writing/vllm-architecture

#vLLM #Inference #LLM #SystemsEngineering
