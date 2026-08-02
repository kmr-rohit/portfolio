---
title: The harness is the product
description: Everyone ships the same models. What separates an agent that works from one that demos well is the loop around the model — context assembly, tool surfaces, error handling and the budget that stops it.
date: '2026-04-27'
tags:
  - Agents
  - Harness
  - Design
draft: false
---

There is a particular disappointment that people building agents all seem to experience. You wire up a model with tools, watch it solve something genuinely difficult on the first try, and conclude the hard part is done. Then you run it a hundred times on real inputs and find that it works maybe sixty of them — and the forty failures are not subtle model errors. They are the agent reading a stale file, or calling a tool with the wrong argument and giving up, or looping four times on the same broken command, or confidently reporting success on work it never did.

None of those are fixed by a better model. They are properties of the *harness*: everything that surrounds the model call. And since every team has access to roughly the same frontier models, the harness is the part that is actually yours.

This post takes that claim apart. We start from the loop, name each piece that is not the model, and then look at the failure modes that only show up after the demo works.

**What we'll cover**

1. What the harness is (and is not)
2. Context assembly and tool surfaces
3. Error handling, observation, and termination
4. Budgets — tokens, time, and dollars
5. Why demos lie

## What the harness is

Strip an agent down and there is a loop:

```
   ┌──────────────────────────────────────────────┐
   │                                              │
   ▼                                              │
 assemble context ──> model call ──> parse intent │
                                          │       │
                          ┌───────────────┘       │
                          ▼                       │
                   execute tool ──> observe ──────┘
                          │
                          └──> terminate?  ──> result
```

The model occupies exactly one box. The harness is every other box, plus every arrow, plus all the decisions the diagram hides: what goes into "assemble context" and in what order, what a tool's interface looks like, what happens when execution fails, what "observe" records and what it throws away, and who decides the loop is over.

Put that way it is obvious where the engineering is. It took me longer than it should have to internalise.

## Context assembly is a scheduling problem

Every turn, something has to decide what the model sees. Naively that is "the system prompt plus everything that has happened", and that works until the third tool call returns 40,000 tokens of log output.

The useful reframe is that context is a **budget you allocate**, not a transcript you append to. Each turn you are choosing how to spend a fixed number of tokens across competing claims:

- the system prompt and behavioural rules
- tool definitions
- durable memory, facts that must survive the whole run
- retrieved material relevant to the current step
- the recent trajectory, what was tried and what came back
- older trajectory, compacted

Those compete. Adding a fourth retrieved document means less room for trajectory. There is no universally right split, but there is a wrong one, which is letting whatever happened most recently crowd out everything else by default.

Two rules have earned their place for me. **Put stable content first.** Not for aesthetics — every serving engine in use caches KV state by prefix, so a volatile timestamp at the top of your system prompt invalidates the cache for the entire rest of the prompt on every single call. Stable prefix, volatile suffix, and prefill work drops enormously. (The [serving-side reason](/writing/vllm-architecture) is worth understanding if you have not run into it.)

**Compact deliberately, not incidentally.** When the trajectory outgrows its allocation, summarise it on purpose — with a prompt that knows what matters for this task — rather than letting a sliding window silently drop the turn where the agent learned the build system uses a different config path. I have written [separately about the compaction problem](/writing/context-engineering-for-agents), because it deserves more than a paragraph.

## Tool interfaces are prompts

This is the point that most changed how I build these things.

A tool definition is not an API contract. It is a piece of prompt that happens to be machine-readable, and it will be read by something that has no ability to ask a follow-up question. Every ambiguity in the description becomes a class of failure at runtime.

Consider two versions of the same capability:

```python
# reasonable API, poor tool
def search(query: str, limit: int = 10) -> list[dict]:
    """Search the index."""

# same capability, designed to be read by a model
def search_docs(
    query: str,           # natural-language question, not keywords
    product_area: str,    # one of: pipelines, katib, kserve, notebooks
    limit: int = 5,
) -> list[SearchHit]:
    """Search Kubeflow documentation for conceptual and how-to content.

    Use this for "how does X work" and "how do I configure Y".
    Do NOT use this to find error messages or bug reports — those live
    in issues, use search_issues instead.

    Returns hits with a source path and a version. If the top result's
    score is below 0.4 the index probably does not cover this topic;
    say so rather than answering from the weak match.
    """
```

The second is a worse Python API and a far better tool. It names the sibling tool it is often confused with, states the negative case, and tells the model what to do with a weak result. Those three additions eliminate more failures than most prompt tuning.

The broader principles:

**Fewer, larger tools beat many small ones.** Every additional tool is another chance to pick wrong, and the error rate climbs faster than linearly. If two tools are almost always called together, make them one.

**Return what the next decision needs.** A tool that returns a raw 2 MB JSON blob has moved the parsing problem into the context window, where it costs tokens and attention. Return the fields that matter, with a handle to fetch the rest if needed.

**Make the failure mode legible.** "Error: 400" tells the model nothing. "Error: product_area must be one of pipelines, katib, kserve, notebooks — you passed 'kubeflow-pipelines'" tells it exactly how to retry, and it usually will, correctly, on the next turn.

## Errors are input, not exceptions

That last point generalises into what I think is the single highest-leverage property of a good harness.

In ordinary software an error propagates up until something handles it. In an agent loop, an error is *information* — it is the environment telling the agent something true about the world. The harness's job is to deliver that information in a form the model can act on, and then let the loop continue.

```
 poor:   tool raises  ──>  harness catches  ──>  "an error occurred"
                                                  (agent has no idea what to do)

 better: tool raises  ──>  harness formats  ──>  what failed
                                                  why it failed
                                                  what valid input looks like
                                                  what to try instead
```

A concrete version: a command that fails because a file does not exist should come back with the error *and* a listing of the directory it looked in. Nine times out of ten the model spots the typo immediately. Without the listing it guesses, and guessing is where loops come from.

The counterpart is knowing when to stop offering retries. An agent that has failed the same call three times with three variations is not converging, and the harness should say so explicitly — inject a message that names the repetition and instructs it to try a different approach or report the blocker. Left alone, models will happily burn twenty turns on the same wrong idea.

## Verification, or how not to be lied to

Ask an agent whether it completed the task and it will usually say yes. Not from dishonesty — it has no privileged access to the outcome. It has its own trajectory, which contains its intentions, and intentions read a lot like accomplishments in a transcript.

So the harness has to check. The general shape: for any claim the agent makes about the world, find a cheap oracle that consults the world directly.

- Claim: the code works. Oracle: run the tests.
- Claim: the file was updated. Oracle: read it back and diff.
- Claim: the answer is grounded in the docs. Oracle: check the cited spans actually contain it.
- Claim: the config is valid. Oracle: run the validator.

The important discipline is that the oracle's result goes *back into the loop* rather than into a log. An agent that is told "you said the tests pass, here is the failing output" will very often fix it. An agent whose false claim is silently recorded ships a bug.

This is also the cleanest reason to prefer tasks with executable verification. Code, config, queries and structured extraction all have oracles. "Write me a strategy memo" does not, which is why agents feel so much more reliable in the first category — not because the writing is easier, but because the harness can close the loop.

## Budgets and termination

Every agent needs a bound on every axis it can run away along: wall-clock time, turns, tokens, money, and calls to any tool that costs something or touches something.

The part that gets skipped is what happens when a budget is hit. Killing the run and returning nothing is the worst option, because the agent has usually accumulated real work. Better is a graceful wind-down: when the budget is 80% consumed, tell the model, and instruct it to finish the current step and summarise state. You get a partial result plus a handoff, which is recoverable. A hard kill is not.

```python
if turn_budget.used > 0.8 * turn_budget.total:
    messages.append(system(
        "You have used most of your turn budget. Stop starting new work. "
        "Finish the current step, then report: what you completed, what "
        "remains, and the exact next action for whoever picks this up."
    ))
```

## Observability

You cannot debug what you cannot replay. The minimum a harness should record, per run:

Every model call with its exact rendered input — not the template, the rendered string — and its raw output. Every tool call with arguments, result, latency, and whether it errored. Every context-management decision: what was compacted, what was retrieved and with what scores, what was dropped. Token and cost accounting per step. The final outcome, and whichever verification oracles were run.

That last one is what makes evaluation possible at all. With trajectories on disk you can ask the questions that actually matter: which tool has the highest error rate, at what turn depth do runs go wrong, how often does compaction precede a failure, which retrieval queries return nothing. Without them you are tuning prompts by vibes.

## A short taxonomy of failure

Almost every agent failure I have debugged falls into one of these, and none of them is a model capability problem.

**Context starvation.** The information needed was in the trajectory earlier and got dropped by naive truncation. Fix: deliberate compaction, and pin durable facts outside the sliding window.

**Tool confusion.** Two tools with overlapping descriptions; the model picks the wrong one consistently. Fix: merge them, or name the distinction explicitly in both descriptions.

**Silent failure propagation.** A tool returned something empty or malformed, the agent treated it as a valid negative result, and everything downstream is built on it. Fix: distinguish "no results" from "the query was wrong" in the tool's own return value.

**Loops.** Same action, same failure, repeatedly. Fix: detect repetition in the harness and intervene with an explicit message.

**Premature success.** Reported done without verifying. Fix: oracles, feeding back into the loop.

**Context poisoning.** Something wrong entered the context early — a bad retrieval, a hallucinated file path — and every subsequent turn is conditioned on it. This is the nastiest one, because the trajectory stays internally consistent. Fix: verify at the point of entry, and be willing to restart a sub-task with clean context rather than trying to argue the agent out of a belief.

## The uncomfortable conclusion

The frontier models are extremely good and are not the constraint on most agent products. Two teams with identical model access will ship agents with wildly different reliability, and the difference will be almost entirely in the parts described above — how context is budgeted, how tools are described, how errors are surfaced, what gets verified, and how the whole thing is instrumented.

That is good news, mostly. It means the work is ordinary systems engineering: interface design, error handling, resource budgeting, observability. Skills that transfer, applied to a component that happens to be stochastic.

It also means the honest answer to "which model should we use" is usually "it will not matter as much as you think." Spend the week on the harness.
