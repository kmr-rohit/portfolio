---
title: Context engineering, after the window stopped being the problem
description: Million-token windows did not end context management, they changed what it is. Attention is the scarce resource now, not space — and that changes what compaction, retrieval and sub-agents are for.
date: '2026-06-14'
tags:
  - Agents
  - Context
  - Retrieval
draft: false
---

For about two years, context management meant one thing: your stuff did not fit. You had eight thousand tokens, or thirty-two, and the engineering was compression — summarise the history, retrieve the three most relevant chunks, drop what you could afford to lose.

Then the windows got long. A million tokens is a codebase. It is a year of a conversation. The obvious conclusion was that the problem had been solved by scale, as several problems in this field have been.

It was not. It changed shape. Filling a large window is easy and usually makes things worse, and the reason is that **the window measures space while the actual constraint is attention.**

## The thing that does not scale

Two effects are well documented enough to design around.

The first is positional: models attend unevenly across a long input, with material in the middle of a large context recovered less reliably than material at either end. Put the critical instruction at token 400,000 of 800,000 and it competes with everything around it in a way it would not at position 50.

The second is that performance degrades with context length even on tasks that should be length-invariant. Take a question a model answers perfectly with 2,000 tokens of context, pad the context to 200,000 tokens of related-but-irrelevant material, and accuracy drops. The needle is still there. It is just harder to pick out of a bigger haystack, and irrelevant-but-plausible material is a much better distractor than noise.

The operational conclusion:

> Every token you add has a cost paid by every other token. Context is not free storage — it is a shared attention budget, and filling it dilutes everything already in it.

Which restores the discipline that big windows seemed to make obsolete, with a different justification. You are no longer compressing because things do not fit. You are curating because precision degrades.

## The budget

I find it useful to think of each turn's context as a fixed allocation across competing claimants, because it forces the tradeoffs to be explicit.

```
 ┌─────────────────────────────────────────────────────────┐
 │ system prompt + rules            stable, cache-friendly │
 ├─────────────────────────────────────────────────────────┤
 │ tool definitions                 stable                 │
 ├─────────────────────────────────────────────────────────┤
 │ durable memory                   slow-changing          │
 │   facts that must survive the whole run                 │
 ├─────────────────────────────────────────────────────────┤
 │ retrieved material               per-turn               │
 ├─────────────────────────────────────────────────────────┤
 │ compacted history                periodically rewritten │
 ├─────────────────────────────────────────────────────────┤
 │ recent trajectory                per-turn, verbatim     │
 └─────────────────────────────────────────────────────────┘
   ▲                                                      ▲
   stable prefix                             volatile suffix
```

The ordering is not cosmetic. Serving engines cache KV state by prefix, so everything above the first byte that changes is reused for free and everything below it is recomputed. Put a timestamp or a per-request identifier at the top and you have invalidated the entire prompt on every call — a large and completely invisible cost. Stable first, volatile last, always.

Within the budget the question each turn is what to evict. Some heuristics that have held up:

**Durable memory should be small and explicit.** A handful of facts the agent established and must not lose — the repo uses pnpm, the customer is on the enterprise plan, the user already rejected approach A. Write them somewhere structured, not into the conversation where they scroll away.

**Retrieved material is the most over-allocated.** Ten chunks are rarely better than three. If your retrieval cannot tell you which three, that is a retrieval problem and adding seven more is not the fix.

**Recent trajectory should be verbatim, older trajectory should not.** The last two or three steps carry detail the model needs exactly. Step forty is a fact about what happened, and that fact is one sentence.

## Compaction

When the trajectory outgrows its share, something must give. The choice of *what* is the whole game.

Sliding-window truncation — drop the oldest turns — is the default because it is one line of code, and it is the source of an entire failure class. The turn you drop is frequently the one where the agent discovered something it now silently no longer knows. It re-runs the failed command it already learned to avoid. It re-reads the file it already read.

Compaction means summarising the dropped region on purpose, with a prompt that knows what matters:

```python
COMPACT = """Summarise the trajectory below for an agent that will
continue this task. It cannot see the original.

Preserve, in this order:
  1. Facts discovered about the environment (paths, versions, config,
     conventions) — these are expensive to rediscover.
  2. Approaches already tried and why they failed.
  3. Decisions made, and the reason.
  4. Anything the user explicitly asked for or ruled out.

Discard: tool output already superseded, exploratory reads that led
nowhere, and your own restatements of the plan.

Be concrete. "The build uses Bazel 7 with a custom toolchain at
tools/bzl" is useful. "Explored the build system" is not."""
```

Two details matter in practice. **Compact on a threshold with hysteresis**, not every turn — recompacting a summary repeatedly degrades it, a slow game of telephone. And **keep the last few turns verbatim below the summary**, so the model has both the compressed past and the precise present.

## Sub-agents as context isolation

The strongest tool for context management is not compression at all. It is refusing to put things in the main context in the first place.

Some sub-tasks are enormous to perform and tiny to report. "Find where retry logic is implemented" might read thirty files and produce one path. If that search happens in the main agent's context, thirty files of source now sit there, diluting attention for the rest of the run. If it happens in a sub-agent, the parent receives one line.

```
 inline                              delegated
 ─────────────────                   ─────────────────────
 main context:                       sub-agent context:
   ...                                 30 file reads
   30 file reads   <── 45k tokens      reasoning
   reasoning           permanently     ▼
   answer                              returns: "core/retry.py:88"
   ...
                                     main context:
   everything after this               ...
   competes with 45k                   "core/retry.py:88"  <── 12 tokens
   tokens of source                    ...
```

The tradeoff is that the sub-agent cannot see the parent's context, so it must be briefed, and a badly briefed sub-agent returns a confidently wrong one-liner that the parent has no way to check. The rule I use: delegate when the task has a **narrow, verifiable output** and a wide search. Delegate a lookup, a search, a summarisation of a known document. Do not delegate a judgement that depends on the full picture, because the sub-agent does not have it.

## Retrieval as a context decision

Once you view context as an attention budget, retrieval stops being a search-quality problem and becomes an allocation problem. The question is not "what is relevant" but "what is worth the space".

That reframing changes a few things.

**Precision beats recall, decisively.** In classical search a marginal result costs the user a glance. Here it costs attention for every other token in the window, and a plausible-but-wrong chunk is worse than nothing because the model has no way to know it is wrong.

**Route before you retrieve.** A question about an error message and a question about how a feature works want different indexes. One embedding search over everything answers both badly. Give the agent separate tools for separate sources and let it choose — it is usually good at that choice, and when it is wrong the [tool description](/writing/the-agentic-harness) is where to fix it.

**Return provenance, always.** A chunk with a source path and version lets both the model and your verification layer check the claim. A bare string cannot be checked by anyone.

**Let it say nothing.** A retriever that always returns its top five will return five irrelevant chunks for an out-of-scope question, and the model will dutifully build an answer on them. A score floor, below which the tool reports no coverage, prevents a whole category of confident wrongness.

## Measuring it

Context problems are diagnosable if you record enough, and invisible if you do not. From trajectory logs, the questions worth asking:

What is the actual token composition of a typical turn, broken down by claimant? Most teams discover their tool definitions are three times larger than they assumed, or that one verbose tool's output dominates everything.

What fraction of retrieved chunks are ever cited or acted on? If it is under a third, you are retrieving too many.

Do failures cluster after compaction events? If they do, your compaction prompt is dropping something load-bearing, and you can find out what by diffing the pre- and post-compaction context on failing runs.

What is your prefix cache hit rate? A low rate on a workload with a long stable system prompt means something volatile crept into the prefix, and it is costing real money.

## What it comes down to

Long windows removed a hard constraint and replaced it with a soft one, and soft constraints are harder to engineer against because nothing fails loudly. Nothing throws when you put 200,000 tokens of marginal context in front of a model. The answers just get a little worse, in ways that look like model limitations.

The discipline that survives is the one that was always right: **put in what is needed, in an order that respects both attention and the KV cache, and be deliberate about what leaves.** The window got bigger. The job did not change.
