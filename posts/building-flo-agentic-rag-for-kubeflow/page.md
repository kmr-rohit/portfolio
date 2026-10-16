---
title: 'Building Flo: an agentic RAG assistant for Kubeflow, end to end'
description: A technical write-up of my Google Summer of Code 2026 work on kubeflow/docs-agent — from indexing issues and code next to the docs, through hybrid retrieval, a self-hosted model and a locked-down edge, to GitOps, an eval on every merge, and a feedback loop that routes bad answers to the team that can fix them.
date: '2026-10-14'
tags:
  - Kubeflow
  - RAG
  - Agents
  - GitOps
  - Evaluation
  - Open source
draft: false
---

For Google Summer of Code 2026 I worked on [kubeflow/docs-agent](https://github.com/kubeflow/docs-agent), the assistant behind the Kubeflow website. We call it Flo. The brief was to turn a documentation chatbot into an agentic RAG system that runs entirely on Kubernetes, and that other cloud native projects could copy.

This post walks through the whole project in the order the problems appeared. The first half is about getting good answers: what to index, how to retrieve it, which model to run, and how to expose it safely. The second half is about everything that happens after the answer: deploying changes, measuring them, and learning from real users. That second half turned out to be most of the work.

**Contents**

1. The problem: where answers live
2. Architecture
3. Ingestion: index the sources, not just the docs
4. Retrieval: hybrid search and an intent router
5. Agents and tools
6. Choosing the model
7. The public edge
8. Delivery: GitOps on one cluster
9. An eval on every merge
10. Tracing two environments
11. Feedback that becomes work
12. Challenges, in one table
13. Results and what is next

## 1. The problem: where answers live

The original system did the standard thing: chunk the Markdown docs, embed them, retrieve the top results, generate. It answered documentation questions from documentation. Most of the questions people bring to a Kubeflow assistant are not documentation questions:

> My pipeline pods are stuck in Pending with `FailedScheduling`.

> What does this field default to, and where do I override it?

> My InferenceService shows `Ready=False`. What now?

The first has its fix in a closed GitHub issue. The second is a default value in source code or a CRD schema. The third needs the behaviour of a controller. None of them is organised around an error string or a field name in the prose docs.

![Where each question type's answer actually lives, and how well the docs cover it.](/sketches/answer-sources.svg)

Retrieval quality was not the bottleneck. The corpus was. No ranking trick recovers an answer that was never indexed.

## 2. Architecture

![Flo end to end: widget, Istio gateway, kagent agent, Gemma; the MCP server's tools, intent router and Milvus; ingestion, tracing and the judge.](/sketches/flo-architecture.svg)

| Layer | What runs | Why it is separate |
|---|---|---|
| Widget | Chat UI on the docs site, streaming answers with a Sources panel | Ships with the website, not the cluster |
| Edge | Istio gateway with TLS, rate limits, a CORS allow-list and anonymous session tokens | Public traffic and abuse controls live in one Helm chart |
| Agents | [kagent](https://kagent.dev) `Agent`, `ModelConfig` and `RemoteMCPServer` resources | Agents are Kubernetes objects, reviewed and deployed like any other |
| Tools | An MCP server with three search tools | The same tools serve the website, an IDE, or any other agent |
| Data | Milvus collections for docs, issues and code; a TEI embedding service | Each source keeps its own shape and metadata |
| Models | [KServe](https://kserve.github.io/website/) with vLLM, one model per GPU | Model changes never ride along with app changes |
| Platform | Argo CD, OpenTelemetry, Langfuse | Delivery, tracing and evaluation |

Everything runs on one Oracle Kubernetes Engine cluster with two NVIDIA A10 GPUs.

## 3. Ingestion: index the sources, not just the docs

The first big change was ingestion, built as [Kubeflow](https://www.kubeflow.org) Pipelines that write into Milvus:

- **Documentation** from `kubeflow/website`. The Hugo pages are parsed with their front matter, split on headings with a token-aware chunker, and tagged with section, version and release date.
- **GitHub issues** across the Kubeflow repositories. An issue is indexed with its title, problem and resolution together, plus state and labels. A closed issue with a fix is worth more than an open one describing the same symptom.
- **Code and manifests**, chunked on structure: YAML resources stay whole, so a CRD field and its default are retrieved together.

The rule underneath all three: **chunk according to the structure of the thing.** Prose splits on headings, issues split into threads, manifests do not split at all. Uniform windows make the indexer's life easy and the retriever's life hard.

Ingestion is idempotent (delete by id, then insert), so a pipeline can be re-run after a fix without duplicating anything.

## 4. Retrieval: hybrid search and an intent router

Pure vector search is good at "how does X work" and bad at "what changed in 1.10". Version numbers, flag names and error strings are exactly the tokens embeddings blur. The docs collection therefore stores both a dense vector and a native BM25 sparse vector in Milvus, and an intent router chooses per query:

- **Version, date and "latest" questions** use BM25 with a deeper candidate pool, re-ranked by release date.
- **Conceptual questions** use hybrid search, dense and BM25 fused with reciprocal rank fusion.
- **Older collections** without BM25 fall back to dense search.

Results come back as evidence with a strict citation contract. The text the model sees has its URLs stripped, so it cannot invent links. The URLs travel separately as structured citations that the widget renders in a Sources panel. That one rule removed a whole class of hallucinated links.

## 5. Agents and tools

The MCP server exposes three tools rather than one `search` endpoint:

```text
search_kubeflow_docs    how-to and conceptual content
search_github_issues    error messages, symptoms, "has anyone hit this"
search_kubeflow_code    defaults, CRD fields, manifests, controller behaviour
```

A single endpoint is tempting, because the model cannot pick the wrong tool. It also cannot pick the right one. "Why is my pod Pending" and "how does the pipeline DAG execute" need different sources, and a unified index decides between them by similarity alone, which is the signal that does not tell them apart. With separate tools the agent makes an explicit routing decision. Models are good at that when each tool's description says what it is for and what it is not for.

The agents are kagent resources: a docs agent, the same agent with thinking enabled, and a debug agent that also searches code. The system prompt is in the Helm chart, so a prompt change is reviewed and deployed like code.

## 6. Choosing the model

We started with Qwen2.5-7B. Two evaluations decided the switch to Gemma 4 E4B: a retrieval and answer-quality eval I ran over the indexed docs, and Santhosh's tool-use eval of 97 cases, each repeated three times ([#261](https://github.com/kubeflow/docs-agent/pull/261)).

| | Qwen2.5-7B | Gemma 4 E4B |
|---|---|---|
| Retrieval hit@5 (22 questions) | 22/22 | 22/22 |
| Faithfulness | 0.71 | 0.69 |
| Correctness | 0.75 | 0.75 |
| Tool-use cases passed (of 291) | 168 | 270 |
| Mean latency | 17.3 s | 4.4 s |

Answer quality was level, tool use was far better, and answers came back about four times faster. The model sits behind a stable served name, `flo-llm`, so switching models is one value in one Helm release, and Qwen stays in the chart's catalogue as the rollback.

## 7. The public edge

A public chatbot backed by an LLM is an open invitation to spend someone else's GPU. The edge is a Helm chart, `gateway-guardrails`, so the protections ship with every deployment rather than living in a runbook:

- TLS from cert-manager, a CORS allow-list, and global and per-IP rate limits.
- **Anonymous session tokens.** The widget asks for a short-lived signed token and sends it on every request. Istio checks the signature and expiry at the gateway, so there are no user accounts, but every client has a bounded identity. The token issuer started life as an image in my personal registry; it is now built by the project's CI into `ghcr.io/kubeflow`, because a project's production should not depend on one contributor's account.
- **No catch-all route.** The agent UI behind the gateway also serves an admin API. The gateway routes only the agent stream, with a strict path regex, because the UI decodes `%2F` after routing and `/a2a/..%2fapi/sessions` would otherwise escape to the admin API.

One bug from this layer is worth repeating. Long answers were cut off mid-sentence. The cause was a 30-second route timeout: it applied to the whole streamed response, not just to the first byte, and a 7B model regularly streams for longer than that. Streaming changes what a timeout means.

## 8. Delivery: GitOps on one cluster

By late September Flo worked, and nobody could safely change it. When I compared Git with the cluster object by object, the model had been patched by hand, the MCP server ran an image built from a fork, and an OpenTelemetry collector, a proxy and several agents existed only in the cluster. Each was a reasonable fix made under time pressure. Together they meant the running system could not be rebuilt from the repository.

One difference was invisible to the usual tools. Tracing keys had been added to the MCP server with `kubectl set env`. Neither `kubectl diff` nor Argo CD reported it, because both compare what the chart renders and ignore fields that were added by hand. A clean redeploy from Git would have silently switched off tracing.

The fix was in stages:

1. **Argo CD in observe-only mode** ([#266](https://github.com/kubeflow/docs-agent/pull/266)). An Application per Helm release, pointing at `main`, with no sync policy. Argo CD reports drift and changes nothing. The list of hand-made changes became a dashboard, and we fixed them one pull request at a time.
2. **Staging as a namespace, not a branch** ([#267](https://github.com/kubeflow/docs-agent/pull/267)). `docs-agent-staging` runs the same chart. Argo CD syncs it from `main` automatically and self-heals it. Branch pairs drift and need merge-backs, and in an open-source repository every contributor would have to know which branch to target.
3. **Configuration in Git, secrets in the cluster.** Environment values in `deploy/envs/` are public and reviewed. Secrets are Kubernetes Secrets referenced by name and never committed. Review kept the values honest too: Tarek flagged a node-IP anti-affinity rule copied from the live release, and it turned out to be redundant, because the GPU nodes are already tainted.
4. **Production promoted by commit** ([#274](https://github.com/kubeflow/docs-agent/pull/274)), described below.

Staging shares the model and Milvus with production. Retrieval only reads, and the model is the most expensive thing in the cluster. What staging must isolate is the code and configuration we are about to ship, and a namespace does that.

**Promoting a commit, not editing a tag.** My first design promoted by pull request: bump the image tag in the production values. Living with it showed two problems. Staging was pinned to an image tag too, so a merge that changed code changed nothing staging deployed, and most merges were never tested there. And a hand-edited tag per release would not survive releasing every week or two with 10 to 20 commits in between.

The design we settled on uses the commit as the unit. CI tags every image on `main` with its short SHA, and Argo CD exposes the commit it is deploying as [`$ARGOCD_APP_REVISION_SHORT`](https://argo-cd.readthedocs.io/en/stable/user-guide/build-environment/). Staging sets its image tag from that variable, so every merge changes what staging runs, and every merge is evaluated. Production is pinned to a commit. `deploy/promote.sh` moves the pin and opens a pull request whose description lists the commits since the last release and the staging eval scores for the new one. Merging it is the deploy, because production syncs automatically to whatever commit is pinned; reverting it is the rollback. A root [app of apps](https://argo-cd.readthedocs.io/en/stable/operator-manual/cluster-bootstrapping/), `flo-apps`, applies the Application definitions from `main`, so nobody runs `kubectl` after a merge. The GPU releases and Langfuse stay manual: a model reload or a database restart should be a decision.

![How a merge reaches users: every merge is built, deployed to staging and evaluated; every week or two a promotion PR moves production.](/sketches/flo-delivery.svg)

One trap appeared before the first sync, while reading the diff. The Langfuse chart creates database passwords with Helm's `lookup`, which reuses the existing Secret during `helm upgrade`. Argo CD renders charts without cluster access, so `lookup` returns nothing and every render invents new passwords. A sync would have overwritten the live credentials and locked Langfuse out of its own data. The fix is two lines of [diffing configuration](https://argo-cd.readthedocs.io/en/stable/user-guide/diffing/): ignore `/data` on those Secrets, and `RespectIgnoreDifferences=true` so the sync honours it. **Read the diff before the first sync of anything stateful.**

## 9. An eval on every merge

After every staging sync, which is now every merge, Argo CD runs a Job that sends 58 real questions through the deployed stack: agent, tools, Milvus and model, exactly the path a user's question takes. It checks:

| Check | Question | Gate |
|---|---|---|
| Routing | Did the agent call the right tool, or no tool for small talk? | ≥ 85% |
| Query fidelity | Did the search keep the key terms of the question? | reported |
| Groundedness | Is every claim supported by what the tools returned? | ≥ 65% fully grounded |
| Errors | Did any request fail? | none |

If a gate fails, the Job fails and so does the Argo CD sync. The current baseline is 100% routing, about 73% fully grounded, and a 2.6-second median answer.

Groundedness needs a judge, and **the answer model does not judge itself.** The second GPU, which had been idle, runs Qwen2.5-7B as a separate judge. A different model family grades Gemma's answers, and grading never takes GPU time from users. Qwen is a small judge, so its scores are best for comparing two commits on the same questions, not as an absolute grade.

Each run is stored in Langfuse as an [experiment](https://langfuse.com/docs/evaluation/experiments/overview) named after the commit, the pull request and its author. A contributor finds their PR by number or GitHub username and compares it with the previous run, question by question. That makes answer quality visible to someone who has never had access to the cluster.

## 10. Tracing two environments

Two environments in one cluster created a new problem: their traces landed in the same Langfuse project, so eval runs polluted the project that holds real conversations.

The standard fix is a resource attribute, `deployment.environment=staging`, set through `OTEL_RESOURCE_ATTRIBUTES`. I set it on the staging agents, and their traces kept arriving in production. kagent's agent runtime builds its OpenTelemetry resource without reading that variable.

So the collector decides instead. Its `k8sattributes` processor looks up the namespace of the pod that sent each span, and a routing connector sends staging to the evaluation project and everything else to the live one, tagging each with a Langfuse environment. The agents need to know nothing about it. **Don't trust a workload to label itself when the platform already knows where it runs.**

The MCP server's own tracing existed only in that forked image. We ported it into the repository as a small decorator, so each tool call, retrieval and embedding is a span with the search mode, hit count and top scores. Porting it, rather than copying files out of the image, mattered: the image predated several fixes on `main`.

## 11. Feedback that becomes work

The eval covers the 58 questions we chose. Users ask the other ten thousand.

Every answer in the widget now has a small *Helpful?* bar ([#268](https://github.com/kubeflow/docs-agent/pull/268), in review), and a thumbs-down can carry a comment. The vote goes to a small service that finds the trace for that exact answer, from the chat's session ID and turn number, and records a score on it. Changing a vote overwrites the score.

Each night a triage job reads the day's thumbs-down. For each one it takes the question, tool calls, retrieved chunks and answer from the trace, searches the index again independently, and asks the judge two questions. Did the agent see a passage that answers this? Does such a passage exist at all?

![From a thumbs-down to an owner: score on the trace, nightly triage, then a pipeline bug for docs-agent or a docs gap for the component's working group.](/sketches/flo-feedback.svg)

| Layer | Meaning | Owner |
|---|---|---|
| Retrieval | The answer is in the index, but the search missed it | docs-agent |
| Generation | The right passage was found, but the answer was still wrong | docs-agent |
| Tool routing | A GitHub issue had the answer, but issues were never searched | docs-agent |
| Content gap | The docs do not cover it | The component's working group |

That last split matters for an open-source project. A missing Katib example is not fixed by tuning our prompt; it is fixed by a docs pull request in Katib. The job writes its verdict onto the trace and prints a report grouped by owner, and a person files the issues. Automatic filing can wait until the judge is calibrated. The first real vote showed why: a user commented that a "trainer" question was really about Pipelines, and the keyword-based component guess said Katib.

**Collecting feedback is collecting data**, so two smaller changes ship with it. The widget's disclaimer now says that conversations and feedback are recorded to improve answer quality, and asks people not to share personal information. And the data does not stay forever. Self-hosted Langfuse keeps everything by default, and its [built-in retention](https://langfuse.com/docs/administration/data-retention) is an Enterprise feature, so a weekly CronJob deletes traces, scores and raw events older than four weeks in the live project and two weeks in the evaluation project. The evaluation questions themselves are never deleted, and each release's scores outlive the traces because they are written into its promotion pull request.

## 12. Challenges, in one table

| Challenge | Root cause | What we did |
|---|---|---|
| Answers cut off mid-sentence | A 30 s route timeout applied to the whole streamed response | Raised the stream deadline to 300 s; timeouts for SSE cover the full generation |
| A path that reached the admin API | The UI decodes `%2F` after the gateway has routed | No catch-all route; a strict regex for the agent stream only |
| The cluster could not be rebuilt from Git | Hand fixes under time pressure | Observe-only Argo CD, then one PR per drift item |
| A difference no diff tool showed | Three-way diffs ignore fields added by hand | Compared live objects field by field; moved the keys into the chart |
| Staging traces in the live project | kagent ignores `OTEL_RESOURCE_ATTRIBUTES` | Route by namespace in the collector |
| Eval runs recorded but invisible | Langfuse v4 builds experiments from span attributes and ignores the old run API | Send one experiment span per question over OTLP |
| A model grading itself | One model answering and judging | A separate Qwen judge on the second GPU |
| Access rules that were never enforced | Istio policies need sidecars, and the namespaces had none | Verified with a test pod; documented with a rollout plan |
| CI deployed production on its first green run | A deploy job hidden behind weeks of failing tests, which [#269](https://github.com/kubeflow/docs-agent/pull/269) made pass | CI now only tests and builds; Argo CD is the only deployer |
| Most merges never reached staging | Staging was pinned to one image tag | The image tag comes from the commit Argo CD deploys |
| A sync that would have locked Langfuse out | Helm `lookup` does not run in Argo CD, so every render made new passwords | Ignore those Secrets' data, and respect that on sync |
| Image pulls failing | Docker Hub's anonymous rate limit | `IfNotPresent` pulls and mirrors that are not Docker Hub |

## 13. Results and what is next

Where Flo stands after the project:

- Answers from docs, issues and code, with citations rendered from structured data rather than generated links.
- A self-hosted model chosen by evaluation, about four times faster than its predecessor.
- A public edge with session tokens, rate limits and no route to anything but the agent stream.
- Every component described in Git, deployed by Argo CD, with drift visible.
- A staging environment and an end-to-end eval on every merge, visible to any contributor.
- Production promoted by commit every week or two, with the changelog and eval in the pull request and a revert as the rollback.
- Live and evaluation traces kept apart, a feedback loop that sorts failures by owner, and a retention window on the data it collects.

What comes next:

- **Calibrate the judge** against human labels before trusting its absolute scores.
- **Enforce in-cluster access** with sidecars, starting with the namespace that holds the models and data.
- **Check the eval automatically** when a promotion pull request is opened, instead of a reviewer pasting the scores.
- **Rewrite the MCP unit tests** that the retrieval refactor left behind.

Flo is now a subproject of the new Kubeflow Agents working group, and it is being discussed as a reference implementation for CNCF work on cloud native agent architecture. The [project documentation](https://kmr-rohit.github.io/docs-agent/) covers the details, and I am walking through all of it at this Saturday's Kubeflow community meeting.

**Lessons**

- **Find out where the answers live before tuning retrieval.**
- **Chunk by structure, and keep different sources in different tools.**
- **Make drift visible before you fix it, and give the cluster one writer.**
- **Never let a model grade itself, and compare runs rather than reading one score.**
- **Deploy every commit to staging, and promote commits, not tags.**
- **Let the platform label telemetry instead of each workload.**
- **Attach feedback to the exact trace, and end the loop with a person and an owner.**

**References**

- Code: [kubeflow/docs-agent](https://github.com/kubeflow/docs-agent); documentation: [kmr-rohit.github.io/docs-agent](https://kmr-rohit.github.io/docs-agent/) (preview on my fork until it moves upstream)
- Pull requests: [#261](https://github.com/kubeflow/docs-agent/pull/261) Gemma 4 E4B and tool-use evals, [#266](https://github.com/kubeflow/docs-agent/pull/266) Argo CD and the Qwen judge, [#267](https://github.com/kubeflow/docs-agent/pull/267) staging and eval on every sync, [#268](https://github.com/kubeflow/docs-agent/pull/268) feedback and triage, [#269](https://github.com/kubeflow/docs-agent/pull/269) CI checks, [#274](https://github.com/kubeflow/docs-agent/pull/274) promotion and data retention
- Argo CD: [build environment](https://argo-cd.readthedocs.io/en/stable/user-guide/build-environment/), [diffing customization](https://argo-cd.readthedocs.io/en/stable/user-guide/diffing/), [app of apps](https://argo-cd.readthedocs.io/en/stable/operator-manual/cluster-bootstrapping/)
- Langfuse: [experiments](https://langfuse.com/docs/evaluation/experiments/overview), [data retention](https://langfuse.com/docs/administration/data-retention)
- [kagent](https://kagent.dev), [KServe](https://kserve.github.io/website/), [Kubeflow](https://www.kubeflow.org)

*Thanks to my mentors Chase Christensen, Tarek Abouzeid and Santhosh Toorpu. Santhosh built the hybrid retrieval and the Gemma migration this post leans on, and all three reviewed and questioned everything else.*
