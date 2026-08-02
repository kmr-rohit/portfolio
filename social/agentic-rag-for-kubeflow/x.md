# X — Teaching a docs agent to read the repo

Docs-only RAG fails on infrastructure questions. The answers live in issues, CRDs, and controller source — not in prose pages.

Notes from turning kubeflow/docs-agent into multi-index, tool-routed retrieval (GSoC):

https://kmrrohit.vercel.app/writing/agentic-rag-for-kubeflow

---

## Optional thread

1/ Chunked Markdown → embed → top-k works for “how does X work.” It does not work for “why is this failing.”

2/ Different question types live in different places. One undifferentiated index cannot represent that.

3/ Index issues/code/manifests separately, expose them as tools, evaluate in CI.

4/ https://kmrrohit.vercel.app/writing/agentic-rag-for-kubeflow
