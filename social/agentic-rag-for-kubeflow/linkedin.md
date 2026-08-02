# LinkedIn — Teaching a docs agent to read the repo

I spend open-source time on kubeflow/docs-agent (GSoC 2026) — expanding it from a documentation chatbot into an agentic RAG reference other projects can copy.

The starting system did the standard thing: chunk Markdown, embed, top-k, generate. It answered docs questions from docs.

The problem: most questions people bring to a Kubeflow assistant are **not** documentation questions.

- “Pods stuck Pending / FailedScheduling” → closed GitHub issues
- “What’s the default for X?” → CRD schema / source
- “Ready=False, RevisionMissing” → controller behaviour

Retrieval quality was not the bottleneck. **The corpus was.** No amount of reranking recovers an answer that was never indexed.

So the work became ingestion and tool boundaries: docs, issues, code, manifests — kept distinct, exposed as MCP tools an agent can choose between, with evaluation in CI so ranking regressions fail the build.

Write-up: https://kmrrohit.space/writing/agentic-rag-for-kubeflow

#Kubeflow #RAG #OpenSource #GSoC #MCP
