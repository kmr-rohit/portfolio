# Rohit Kumar — Application Profile

> Dense brief for custom application questions, recruiter forms, and “tell me about an AI project” prompts.  
> Live page: [kmrrohit.space/profile](https://kmrrohit.space/profile) · Site: [kmrrohit.space](https://kmrrohit.space)  
> Last updated: August 2026

---

## Quick facts (forms)

| Field | Value |
| --- | --- |
| Full name | Rohit Kumar |
| Role | AI engineer |
| Current employer | Oracle (AI Application Developer) |
| Open source | Google Summer of Code 2026 · Kubeflow Docs Agent |
| Location | Bengaluru, India |
| Email | rr7433446@gmail.com |
| GitHub | [github.com/kmr-rohit](https://github.com/kmr-rohit) |
| LinkedIn | [linkedin.com/in/rr7433446](https://www.linkedin.com/in/rr7433446/) |
| Portfolio | [kmrrohit.space](https://kmrrohit.space) |
| Résumé | [kmrrohit.space/rohit-kumar-resume.pdf](https://kmrrohit.space/rohit-kumar-resume.pdf) |
| Education | B.Tech, Mechanical Engineering · NIT Warangal · 2020–2024 |
| Work authorization | India (Bengaluru-based; open to remote / relocation per role) |

---

## Elevator pitches (pick a length)

**One line.**  
AI engineer at Oracle building agentic and retrieval systems in Fusion SCM; GSoC 2026 contributor on Kubeflow Docs Agent (agentic RAG + MCP).

**Three lines.**  
I build AI systems that have to survive production: tool-calling loops, multi-index retrieval, and the eval harness that tells you whether a prompt change helped. By day I ship agentic workflows inside Oracle Fusion SCM Cloud. Outside that I expand kubeflow/docs-agent through Google Summer of Code 2026 and write about inference, agents, and RAG.

**Short paragraph.**  
I’m an AI engineer focused on the layer between a model and a product someone will trust — agents with real side effects, retrieval that spans more than docs, and serving systems where latency and cost are first-class. At Oracle I own agentic and RAG features across catalog, order, and planner workflows. Through GSoC 2026 I turned Kubeflow’s docs chatbot into a multi-source agentic RAG reference architecture with MCP tools, and I run the project’s bi-weekly community call. I’m looking for senior AI engineering work on agent platforms, inference/serving, or retrieval at a scale where the naive approach stops working.

---

## What I’m looking for

- Senior / mid-senior AI engineering roles: agent platforms, LLM serving & inference, retrieval / RAG at scale, applied ML systems.
- Environments where production correctness, evals, and cost/latency matter as much as demos.
- Preference for ownership of a system end-to-end (ingestion → retrieval → agent loop → serving → observability).

---

## About me

I build AI applications — the unglamorous part, mostly. Getting a model to produce something impressive once is easy now. Getting a system to produce something correct on the ten thousandth call, when the input is malformed and the tool times out and the user changes their mind halfway through, is where the engineering is.

At Oracle I work inside Fusion SCM Cloud on agentic and retrieval-backed workflows. Outside that I work on [kubeflow/docs-agent](https://github.com/kubeflow/docs-agent) through Google Summer of Code 2026, and turn up to the Kubeflow Docs Agent community call every other Saturday.

I write to force myself to understand things properly — posts on vLLM, SGLang, context engineering, agent harnesses, and building agentic RAG for Kubeflow.

**Background.** Mechanical Engineering at NIT Warangal; moved into software via competitive programming, internships at Oracle, and shipping agent products end to end. 600+ problems solved across LeetCode / GFG / CodeChef / Codeforces; ran 15+ student CP contests.

---

## Work experience

### Open source contributor, docs-agent — Kubeflow · Google Summer of Code 2026  
**May 2026 — present · Remote** · [github.com/kubeflow/docs-agent](https://github.com/kubeflow/docs-agent)

- Expanding kubeflow/docs-agent from a documentation chatbot into an agentic RAG reference architecture for the Kubeflow project.
- Built multi-index retrieval across GitHub issues, application code, Kubernetes manifests and 1,000+ Markdown pages — roughly 10,000 searchable chunks carrying path, product-area, version and source metadata.
- Merged a 5.4k-line change adding a three-tool MCP server, TEI embeddings, the issues and code ingestion pipelines, and CI/CD onto OCI/OKE.
- Hardening the public edge: rate limiting, CORS lockdown and anonymous session-JWT auth, with Istio configuration migrated into a Helm chart so guardrails ship with the deployment.
- Added a 71-test suite and CI workflow covering retrieval behaviour, so a regression in ranking fails the build instead of surfacing in production.
- Co-speak at Kubeflow Community Showcase 2026 on production agentic RAG (ingestion, embeddings, index updates as pipeline steps; retrieval evaluation and agent testing as first-class stages).
- Host / contribute to the bi-weekly Docs Agent community call (every other Saturday).

### AI Application Developer — Oracle  
**Jun 2024 — present · Bengaluru, India**

- Build agentic and retrieval-backed features inside Oracle Fusion SCM Cloud across three customer-facing workflows: catalog lookup, order review and planner assistance.
- Designed and built an **Alert Notification Microservice** (FastAPI, Kafka, Oracle, SMTP, Docker/Helm): a thin HTTP ingestion API durably enqueues caller-rendered alerts onto a replicated Kafka topic, then a consumer group delivers asynchronously with at-least-once semantics, bounded retries and a dead-letter topic.
- Implemented idempotent acceptance on `(source, idempotency_key)` with a transactional outbox so caller/producer retries collapse to a single Kafka record; replaced hand-rolled DB row-leasing with Kafka partition assignment and rebalancing for concurrency and worker failover.
- Instrumented ingestion, produce, consume and delivery with **Prometheus** metrics (including consumer lag and DLQ depth), configured alert rules, and routed operational alerts through **Alertmanager → Slack**.
- Designed a part-matching pipeline combining fuzzy matching, semantic retrieval, clustering and a web-search fallback over manufacturer and retailer catalogs, lifting match coverage for asset-mapping workflows by around **30%**.
- Shipped an order-classification agent with batch processing, rule-evaluation guardrails, exception routing and a human-review handoff, handling **10,000+** order lines per run.
- Built RAG planner-assist flows over exceptions, notes and tabular data that cut repeated manual investigation by around **40%** through source-grounded answers.
- Won the Oracle Gen AI Hackathon — **1st among 33 teams**, top five among 300+ participants.

### Application Developer Intern — Oracle  
**May 2023 — Jul 2023 · Hyderabad, India**

- Implemented Copy Data for lead-time columns in Oracle SCM; optimised retrieval and update path with Elasticsearch queries and PATCH-based API updates.
- Added linear-regression trend analysis to Oracle JET charts for supply-chain forecasting views.

---

## Flagship AI projects (ready “showcase” answers)

Use these when a form asks: *Describe an AI project you built*, *What’s your strongest technical work?*, *Tell us about impact*, etc.

### 1. Kubeflow Docs Agent — agentic RAG + MCP (best default)

**One sentence.**  
Agentic RAG over Kubeflow docs, GitHub issues, manifests and source — served as an MCP toolset behind the Kubeflow website (GSoC 2026).

**Problem.**  
A docs-only chatbot fails on real Kubeflow questions. Users bring error strings, CRD defaults, and controller behaviour — answers that live in issues, code, and manifests, not Markdown prose.

**What I built.**  
- Ingestion pipelines for issues, application code, and Kubernetes manifests alongside 1,000+ docs pages (~10k chunks with path / product-area / version / source metadata).  
- Three MCP tools so the agent chooses *where* to look instead of retrieving from one blob.  
- TEI embeddings, filtered retrieval, CI/CD onto OKE, Istio/Helm edge guardrails (rate limits, CORS, session JWT).  
- 71-test retrieval suite in CI.

**Impact / proof.**  
Large merged PR (~5.4k LOC); public chatbot path hardened for anonymous use; community showcase talk; ongoing community call for contributors.

**Stack.** Python, MCP, Agentic RAG, Kubeflow Pipelines, KServe, Istio, Helm, OKE, TEI.

**Links.** [Repository](https://github.com/kubeflow/docs-agent) · [My PRs](https://github.com/kubeflow/docs-agent/pulls?q=is%3Apr+author%3Akmr-rohit) · [Write-up](https://kmrrohit.space/writing/agentic-rag-for-kubeflow)

**Why this project (for interviews).**  
It shows production RAG judgment: multi-index design, tool boundaries, metadata for filtered retrieval, eval/CI, and serving/security — not just “I called an LLM API.”

---

### 2. CrackRound — agentic mock interviews (product / voice / agents)

**One sentence.**  
Agentic mock-interview platform: streaming interviewer personas, real-time voice loop (~1.5s E2E), and a live code judge wired into model context.

**Problem.**  
Interview practice that is “chat with a prompt” does not feel like an interview. Latency kills presence; the model cannot score what it cannot see.

**What I built.**  
- Five streaming interviewer personas with rubrics, interruption, and follow-ups.  
- Voice loop: streaming STT → GPT-4o → streamed TTS over WebSocket (~1.5s end to end).  
- DSA judge + system-design whiteboard feeding model context.  
- JSON-schema scoring across five dimensions; latency tracing; hard **$2/session** cost ceiling.  
- Shipped end to end; paid per-session usage.

**Stack.** Next.js, TypeScript, GPT-4o, WebSockets, Prisma, PostgreSQL, Sarvam.

**Why this project.**  
End-to-end product ownership, real-time systems, constrained structured output, and cost/latency as product requirements.

---

### 3. MacBatch — batch AI on idle Apple Silicon

**One sentence.**  
Open-source + hosted batch inference: distribute latency-tolerant AI jobs (embed / OCR / classify) across a pool of idle Macs with lease-based sharding and automatic reassignment.

**Problem.**  
Backfills and overnight enrichment are billed like urgent interactive traffic. GPU rental is the wrong unit; Apple Silicon often sits idle overnight and can run mid-size open models locally.

**What I built.**  
- Control plane (FastAPI) holding jobs → shards → tasks; workers lease shards (600s, then reclaim) and run a whole model via Ollama.  
- Worker CLI (`npm i -g macbatch`) — pull-based so machines behind NAT join with outbound HTTPS only.  
- Measured **252,686 embed items/hour** on one MacBook Air; **2.8×** from shard batching alone on the same machine.  
- Product site + package docs; MIT-licensed queue, scheduler and CLI.

**Stack.** TypeScript, Python, FastAPI, Ollama, Apple Silicon, npm.

**Links.** [Product](https://macbatch.vercel.app/) · [Docs](https://kmr-rohit.github.io/macbatch/) · [Source](https://github.com/kmr-rohit/macbatch)

**Why this project.**  
Systems design for unreliable workers, cost/throughput honesty, and shipping both an open-source scheduler and a product surface.

---

### 4. Oracle Fusion SCM — production agents & RAG (enterprise impact)

**One sentence.**  
Agentic and retrieval features in Fusion SCM: part matching (+~30% coverage), order-classification agent (10k+ lines/run), planner RAG (−~40% repeated investigation) — plus a Kafka-backed alert notification microservice.

**Highlights to quote.**  
- Part-matching: fuzzy + semantic retrieval + clustering + web-search fallback.  
- Order classification: batch processing, rule guardrails, exception routing, human-review handoff.  
- Planner assist: source-grounded answers over exceptions, notes, tabular data.  
- Alert Notification Microservice: FastAPI/Kafka/Oracle/SMTP with idempotent ingest, DLQ, Prometheus + Alertmanager → Slack.

**Why this project.**  
Enterprise constraints, measurable impact, human-in-the-loop, and agents that touch real supply-chain workflows — plus production messaging reliability.

---

### 5. Alert Notification Microservice — Kafka reliability (systems / backend)

**One sentence.**  
Reliable FastAPI/Kafka notification platform: idempotent HTTP ingestion, consumer-group SMTP delivery with dead-lettering, Prometheus observability, Alertmanager-to-Slack ops alerts.

**What to emphasize in interviews.**  
Upstream owns business rules and renders the email; this service owns the reliability boundary (validate → durable enqueue → `202` after produce ack → async delivery). Outbox + `(source, idempotency_key)` dedup; offsets commit only after successful SMTP; retry-exhausted → `alerts.dlq` + Oracle status store. Kafka consumer groups replaced hand-rolled DB lease/heartbeat/fencing.

**Stack.** Python, FastAPI, Kafka, Oracle DB, SMTP, Docker, Kubernetes/Helm, Prometheus, Alertmanager, Slack.

---

### 6. Shorter alternatives (if they want variety)

| Project | One-liner |
| --- | --- |
| **AirCab** | Voice-first booking agent: spoken request → confirmed ride under one tool-calling loop (state machine for side effects). |
| **FlowForge** | Node canvas where the drawn graph *is* the LLM execution plan (ReactFlow + LangGraph). |
| **AI Learn** | Voice-to-voice Hinglish interview tutor PWA (Next.js + FastAPI + Sarvam). |
| **VizCode** | Prompt → structured algorithm trace → deterministic visualisation (Gemini emits state transitions, not drawings). |

---

## All projects

### Work

**Kubeflow docs-agent** (2026) — Agentic RAG + MCP over docs/issues/code/manifests.  
Stack: Python, MCP, Agentic RAG, KFP, KServe, Istio, Helm, OKE.  
Links: [repo](https://github.com/kubeflow/docs-agent)

**MacBatch** (2026) — Batch AI jobs across idle Apple Silicon (lease scheduler + worker CLI + Ollama).  
Stack: TypeScript, Python, FastAPI, Ollama, npm.  
Links: [product](https://macbatch.vercel.app/) · [docs](https://kmr-rohit.github.io/macbatch/) · [source](https://github.com/kmr-rohit/macbatch)

**CrackRound** (2025) — Agentic mock interviews with voice + live code judge.  
Stack: Next.js, TypeScript, GPT-4o, WebSockets, Prisma, PostgreSQL, Sarvam.

**AirCab** (2025) — Voice booking agent with tool-calling and confirmation state machine.  
Stack: Python, LLM tool calling, STT/TTS, FastAPI.

**FlowForge** (2025) — Visual LLM workflow builder; graph compiles to runtime plan.  
Stack: TypeScript, React, ReactFlow, LangGraph, FastAPI.

**AI Learn** (2026) — Voice-to-voice Hinglish learning PWA.  
Stack: Next.js, FastAPI, Sarvam, PWA.  
Links: [live](https://aitutor-two-hazel.vercel.app) · [source](https://github.com/kmr-rohit/aitutor)

### Lab / smaller

**VizCode** (2025) — Algorithm visualisations from structured model traces. [source](https://github.com/kmr-rohit/VizCode)  
**Blog to Podcast** (2025) — Firecrawl + GPT-4 + ElevenLabs pipeline. [source](https://github.com/kmr-rohit/P1-BlogToPodcast)  
**Online handwriting recognition** (2025) — BiLSTM + CTC on IAM-OnDB stroke sequences. [source](https://github.com/kmr-rohit/LstmOnlineHTR)  
**CodeNITW** (2023) — Placement-prep + Codeforces leaderboard for NITW. [live](https://codenitw.vercel.app)

---

## Achievements

- Selected for **Google Summer of Code 2026** with Kubeflow (agentic RAG).
- Won **Oracle Gen AI Hackathon**: 1st of 33 teams, top 5 among 300+ employees.
- Runner-up, **Tri-NIT Hackathon 2024**, backend track.
- **600+** problems solved across LeetCode, GeeksforGeeks, CodeChef and Codeforces; ran **15+** competitive programming contests with student discussions.
- Spoke at **Kubeflow Community Showcase 2026** on production agentic RAG.
- Attended **KubeCon + CloudNativeCon India 2026** (Mumbai); Kubeflow booth discussions on agent-integrated architectures.

---

## Skills

**Agents & LLM systems** — LangGraph, LangChain, MCP, Agentic RAG, tool calling, evals, QLoRA / LoRA, structured output  

**Serving & retrieval** — vLLM, SGLang, KServe, TEI, Milvus, FAISS, ChromaDB, Elasticsearch  

**Platform** — Kubernetes, Kubeflow Pipelines, Docker, Istio, Helm, OCI / OKE, GitHub Actions, Kafka, Prometheus, Alertmanager  

**Languages & frameworks** — Python, TypeScript, Java, C++, FastAPI, Next.js, React, PostgreSQL, Oracle DB  

---

## Writing (technical)

| Title | Topic | Link |
| --- | --- | --- |
| Teaching a docs agent to read the repo | Kubeflow agentic RAG / MCP | [/writing/agentic-rag-for-kubeflow](https://kmrrohit.space/writing/agentic-rag-for-kubeflow) |
| SGLang, or a runtime that remembers | SGLang architecture | [/writing/sglang-architecture](https://kmrrohit.space/writing/sglang-architecture) |
| vLLM from the inside | vLLM architecture | [/writing/vllm-architecture](https://kmrrohit.space/writing/vllm-architecture) |
| Context engineering, after the window stopped being the problem | Agents / context / retrieval | [/writing/context-engineering-for-agents](https://kmrrohit.space/writing/context-engineering-for-agents) |
| The harness is the product | Agent harness design | [/writing/the-agentic-harness](https://kmrrohit.space/writing/the-agentic-harness) |
| The two clocks | LLM serving / prefill vs decode | [/writing/the-two-clocks](https://kmrrohit.space/writing/the-two-clocks) |

---

## Community

- **Kubeflow Docs Agent community call** — every other Saturday, 11:00 PM IST (17:30 UTC), Zoom via LFX. Working session: what landed, what’s open, good first issues.  
  Details: [kmrrohit.space/community](https://kmrrohit.space/community)

---

## Stock answers to common questions

### “Tell me about yourself” (~60–90 seconds)

I’m Rohit, an AI engineer at Oracle in Bengaluru. I work on agentic and retrieval-backed features inside Fusion SCM — things like part matching, order classification agents, and planner assist over messy enterprise data. Outside Oracle I’m a Google Summer of Code contributor on Kubeflow Docs Agent, where I expanded a docs chatbot into multi-source agentic RAG with MCP tools, and I help run the project’s community call. Before that I studied Mechanical Engineering at NIT Warangal and came up through competitive programming. I’m looking for roles where I own agent or inference systems end to end — not just demos, but systems that stay correct under load and bad inputs.

### “Walk me through your strongest AI project”

Default to **Kubeflow Docs Agent** (section above). Emphasize: docs-only RAG failed → multi-index + MCP tools → metadata for filtered retrieval → eval/CI → edge auth/Helm → community.

Alternate product story: **CrackRound** (voice latency, structured scoring, cost ceiling).

### “What’s a hard technical problem you solved?”

**Retrieval for infrastructure Q&A:** users ask with error strings and runtime symptoms; answers live in issues/code/manifests. Solution was separate indexes and MCP tools with rich chunk metadata, plus tests so ranking regressions fail CI.

**Or reliable async notifications:** moved from a DB row-lease queue to Kafka — outbox + idempotent produce, consumer-group delivery with offset-after-SMTP, DLQ, and Prometheus/Alertmanager ops path separate from business email delivery.

**Or voice interview latency:** anything slower than ~1.5s broke the illusion of an interview; streaming STT/TTS over WebSockets with the judge/whiteboard in context.

### “How do you measure success?”

Coverage / investigation-time metrics at Oracle (~30% match coverage lift, ~40% less repeated investigation); notifier visibility via consumer lag, delivery failures and DLQ depth; session cost ceilings and latency budgets on CrackRound; retrieval test suite and production edge controls on docs-agent; MacBatch throughput/cost benchmarks published with artifacts.

### “What are you looking for next?”

Senior AI engineering on agent platforms, LLM serving, or retrieval at scale — ownership of the path from data → retrieval → agent loop → serving → observability.

---

## Education

**B.Tech, Mechanical Engineering**  
National Institute of Technology, Warangal · 2020 — 2024

---

## Contact

- Email: rr7433446@gmail.com  
- GitHub: [kmr-rohit](https://github.com/kmr-rohit)  
- LinkedIn: [in/rr7433446](https://www.linkedin.com/in/rr7433446/)  
- Site: [kmrrohit.space](https://kmrrohit.space)  
- This brief: [kmrrohit.space/profile](https://kmrrohit.space/profile) · source: `PROFILE.md` in the portfolio repo
