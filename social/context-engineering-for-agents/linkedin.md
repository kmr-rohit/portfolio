# LinkedIn — Context engineering

For a while, context management meant one thing: your stuff did not fit. Eight thousand tokens, or thirty-two. Compress, retrieve, drop.

Then windows got long. A million tokens is a codebase. The obvious conclusion was that scale had solved the problem.

It had not. It changed shape.

Filling a large window is easy and usually makes things worse — because **the window measures space while the real constraint is attention.** Every token you add has a cost paid by every other token.

That shift reframes the whole toolkit:
- stable prefix first (so KV cache still pays off)
- compaction with hysteresis, not every turn
- retrieval as an allocation decision, not a search-quality vanity metric
- sub-agents as context isolation — return one verifiable line, not thirty files of source

Notes from rebuilding the discipline after the window stopped being the bottleneck:

https://kmrrohit.space/writing/context-engineering-for-agents

#Agents #ContextEngineering #LLM #RAG
