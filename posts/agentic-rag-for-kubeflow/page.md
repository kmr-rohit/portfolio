---
title: Teaching a docs agent to read the repo
description: Notes from turning kubeflow/docs-agent into an agentic RAG system — why documentation-only retrieval fails for infrastructure questions, and what it takes to index issues, code and manifests alongside prose.
date: '2026-07-19'
tags:
  - Kubeflow
  - RAG
  - MCP
  - Open source
draft: false
---

I spend my open-source time on [kubeflow/docs-agent](https://github.com/kubeflow/docs-agent), which is the assistant behind the Kubeflow website and my Google Summer of Code 2026 project. The goal is to expand it from a documentation chatbot into an agentic RAG reference architecture that other projects can copy.

The starting point was a reasonable system that did the standard thing: chunk the Markdown docs, embed them, retrieve top-k, generate. It worked, in the sense that it answered documentation questions from documentation. The problem is that most of the questions people actually bring to a Kubeflow assistant are not documentation questions.

This post builds from that failure mode. We look at where answers actually live, why a single undifferentiated index cannot find them, and what it takes to turn issues, code and manifests into MCP tools an agent can choose between.

**What we'll cover**

1. Why docs-only RAG fails on infrastructure questions
2. Multi-index retrieval with source metadata
3. MCP tool boundaries instead of one blob
4. Evaluation and CI so ranking regressions fail the build
5. What I would still change

## Where the answer actually lives

Watch what someone types into a help box for a platform like this. A representative sample:

> My pipeline pods are stuck in Pending with `FailedScheduling`, and the run just sits there.

> What does `ttlSecondsAfterFinished` default to on a KFP run, and where do I override it?

> KServe InferenceService shows Ready=False, `RevisionMissing`. What now?

Not one of those is answerable from prose documentation, and it is worth being precise about why, because the reason determines the fix.

The first is a symptom, not a concept. Someone has hit it before, and the resolution is sitting in a closed GitHub issue with the words "we fixed this by setting resource requests on the workflow controller." No documentation page is organised around that error string.

The second has a *definitive* answer that lives in a default value in source, or in a CRD field description. The docs may mention the field; they will not tell you the current default, and if they do, they may be a release behind.

The third needs the reconciliation logic — what condition sequence produces that state — which is behaviour encoded in a controller, described nowhere in prose.

So the picture is:

```
   question type            where the answer is        docs coverage
   ────────────────         ────────────────────       ─────────────
   "how does X work"        documentation               good
   "how do I configure Y"   docs + CRD reference        partial
   "what is the default"    source / CRD schema         poor
   "why is this failing"    GitHub issues               none
   "what does this
    condition mean"         controller source           none
```

Retrieval quality was not the bottleneck. **The corpus was.** No amount of reranking recovers an answer that was never indexed.

## Indexing four things instead of one

The work, then, was ingestion: build pipelines for the sources that hold the answers, and keep them distinct rather than pouring everything into one vector space.

**Documentation.** Over a thousand Markdown pages. Chunked on heading boundaries rather than fixed windows, because a section is a semantic unit and a 512-token window is not.

**GitHub issues.** The highest-value addition by a wide margin. An issue is a thread, and the useful part is usually the resolution comment, not the original report. So an issue is indexed as a unit that carries the title, the problem statement and the resolution together, with the state and labels as metadata — a closed issue with a fix is worth more than an open one describing the same symptom.

**Application code.** Chunked on function and class boundaries with the enclosing file path and symbol name attached. Splitting source on token count produces fragments that begin mid-function and retrieve terribly.

**Kubernetes manifests and CRDs.** These turned out to matter more than expected. A CRD schema is a precise, machine-readable statement of every field, its type and its default — exactly the thing "what does this default to" needs, and exactly the thing prose documentation is worst at keeping current.

Altogether that produces roughly ten thousand searchable chunks, each carrying path, product area, version and source type.

## Metadata is the part that does the work

The embeddings get the attention; the metadata does most of the useful lifting.

Kubeflow is not one product. It is Pipelines, Katib, KServe, Notebooks, Training Operator and more, developed by different groups with different conventions, and versioned independently. A question about Katib experiments retrieving a KServe page is not a near miss, it is a wrong answer with confident formatting.

Every chunk therefore carries:

```yaml
source_type: issue          # docs | issue | code | manifest
product_area: pipelines     # which component
version: "2.5"              # which release this describes
path: docs/components/...   # exact provenance, always
```

Which enables the thing plain top-k cannot do: **filter first, then rank.** A question scoped to Pipelines on 2.5 searches Pipelines-on-2.5 content, not the whole corpus. Recall goes up because the competition goes down.

Provenance is non-negotiable for a second reason. Every answer cites the path it came from. Users can check it, and — more importantly — so can the evaluation suite.

## Three tools, not one endpoint

The retrieval layer is exposed over MCP as separate tools rather than a single `search` call, and this was the design decision I went back and forth on most.

The single-endpoint version is tempting: one tool, search everything, let ranking sort it out. It is less surface area and the model cannot pick wrong.

The problem is that it also cannot pick *right*. "Why is my pod Pending" and "how does the pipeline DAG execute" want different sources, and a unified index resolves that by similarity alone, which is exactly the signal that does not distinguish them. Separate tools let the agent make an explicit routing decision, and models are good at that decision when the tool descriptions say what each source is for — including what it is *not* for:

```python
search_kubeflow_docs(query, product_area=None, version=None)
    """Conceptual and how-to content from the documentation.
    Use for "how does X work" and "how do I configure Y".
    Do NOT use for error messages or bug reports — use
    search_github_issues for those."""

search_github_issues(query, product_area=None, state=None)
    """Reported problems and their resolutions.
    Use for error strings, symptoms, and "has anyone hit this".
    Closed issues usually contain the fix; prefer them."""

search_kubeflow_code(query, product_area=None, kind=None)
    """Application source and Kubernetes manifests.
    Use for defaults, CRD field definitions, and controller
    behaviour that documentation does not specify."""
```

The other reason for MCP specifically is that the boundary is now reusable. The same tool server backs the website assistant, an IDE client, and anyone else's agent, without any of them importing the retrieval code. For an open-source project where the consumers are not all known in advance, that is worth a lot.

## Testing something non-deterministic

The change I would push hardest on any similar project is the test suite. Fifty-plus retrieval tests, running in CI, gating merges.

Not answer-quality tests — those need a judge and are slow and noisy. **Retrieval tests**, which are cheap and deterministic enough to gate on. Each one is a known question paired with the document that must appear in the results:

```python
@pytest.mark.parametrize("query,must_retrieve", [
    ("pipeline pods stuck in Pending FailedScheduling",
     "issues/kubeflow/pipelines/8901"),
    ("ttlSecondsAfterFinished default for a KFP run",
     "manifests/kfp/workflow-controller-configmap.yaml"),
    ("KServe InferenceService RevisionMissing",
     "issues/kserve/kserve/3204"),
])
def test_retrieval_covers_known_answers(query, must_retrieve):
    hits = retrieve(query, limit=5)
    assert must_retrieve in [h.path for h in hits]
```

This is unglamorous and it has caught more real regressions than anything else in the project. Changing the chunking strategy, swapping the embedding model, adjusting the metadata filter — every one of those is a change that improves some queries and quietly breaks others, and without a suite you find out from a user. The tests turn "this feels better" into a number.

The corollary is that the suite has to be *grown from failures*. Every time the agent gives a bad answer, the fix is two commits: the change, and a test containing the question that exposed it.

## Serving it

The retrieval side is only half of a public deployment. The agent runs on OCI/OKE with ingestion as Kubeflow Pipelines jobs, embeddings served through TEI, and the whole thing behind an Istio edge.

The edge turned out to be where the last stretch of work went, and it is the part least discussed in RAG write-ups. A public chatbot backed by an LLM is an open invitation to spend someone else's inference budget, so the deployment needs rate limits, a locked-down CORS policy, and anonymous session-scoped JWTs so an unauthenticated user still has a bounded identity to rate-limit against.

The detail I care about: all of that lives in a Helm chart rather than in cluster configuration applied by hand. Guardrails that ship with the deployment are guardrails that exist in every environment. Guardrails documented in a runbook are guardrails that exist in whichever cluster someone remembered.

## What I would tell someone starting

**Find out where the answers live before you tune retrieval.** Sample fifty real questions and ask, for each one, which artifact contains the answer. If a third of them point at something you are not indexing, ingestion is your problem and no reranker will save you.

**Chunk according to the structure of the thing.** Prose splits on headings, code splits on symbols, issues split into threads, schemas do not split at all. Uniform windows are a convenience for the indexer, paid for by the retriever.

**Metadata is worth more than embedding quality.** Filtering to the right product and version does more for precision than any model swap I tried.

**Separate tools where the sources are genuinely different.** Let the agent route, and put the routing guidance in the tool description.

**Write retrieval tests from day one.** Cheap, deterministic, and the only way to know whether your last improvement was one.

The generalisable claim, if there is one: for any sufficiently large technical system, the documentation is a *summary* of the truth, and the truth is distributed across the issues, the source and the schemas. An assistant that reads only the summary will be pleasant and frequently unhelpful. The interesting engineering is in reading the rest — and in keeping the four corpora distinct enough that the agent can tell you which one it is speaking from.
