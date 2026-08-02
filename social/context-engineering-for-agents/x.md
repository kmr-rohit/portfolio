# X — Context engineering

Million-token windows did not end context management — they changed what it is.

The scarce resource is attention, not space. Curation beats stuffing; sub-agents beat dumping a whole search into the main thread.

https://kmrrohit.space/writing/context-engineering-for-agents

---

## Optional thread

1/ Long windows made “does it fit?” the wrong question. Performance still degrades with length; the middle gets lost; plausible distractors hurt more than noise.

2/ Context is a shared attention budget. Stable prefix first (cache), volatile suffix last. Compact with hysteresis. Retrieve what earns its tokens.

3/ Strongest isolation trick: delegate wide search to a sub-agent and keep one verifiable line in the parent.

4/ https://kmrrohit.space/writing/context-engineering-for-agents
