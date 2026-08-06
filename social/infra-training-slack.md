# Slack draft — infra training write-up

Copy-paste to the architect who offered the 2-month Terraform / cluster training path (and intro to Anthony).

---

Hi — thanks again for the chat earlier, and for being willing to loop Anthony in on the training setup. As discussed, here is a short write-up of the infra-adjacent work I have already done, plus links.

**Context.** Day job is AI Application Developer at Oracle (agents/RAG in Fusion SCM). Outside that I am GSoC 2026 on Kubeflow Docs Agent. I have been deliberately picking up the cluster/IaC side of that work because I want to get competent at owning Terraform + Helm the way your team does — not only the application layer.

**1. Full Kubeflow on OCI (Terraform)**  
Repo: https://github.com/jaiakash/deploy-kubeflow  
PR: https://github.com/jaiakash/deploy-kubeflow/pull/5  

I wrote Terraform modules to:
- provision an **OKE** cluster (VCN, IGW/NAT/Service gateways, subnets, security lists tuned for Flannel, E5.Flex node pool)
- install the **Kubeflow platform** (cert-manager, Istio, Dex, Knative Serving, KServe, Pipelines, Central Dashboard, Profiles) via kustomize, with install scripts that handle OCI-specific sharp edges (CRI-O image short-names, MySQL PVC on `oci-bv`, webhook-aware retries, server-side apply)

Guides cover OCI auth, cluster deploy, Kubeflow install, and troubleshooting.

**2. docs-agent — Terraform, Helm, CI/CD to OKE**  
Repo: https://github.com/kubeflow/docs-agent  

- https://github.com/kubeflow/docs-agent/pull/210 — MCP tools + TEI + ingestion pipelines + **Terraform** for embeddings/Milvus/KServe/Pipelines + **GitHub Actions** that compile/test and optionally **deploy to OKE** (GHCR + OCI kubectl)  
- https://github.com/kubeflow/docs-agent/pull/218 — moved Istio edge (Gateway, TLS, CORS, rate limits, authz) out of raw Terraform YAML heredocs into a **Helm chart** (`gateway-guardrails`) so the edge is reviewable and ships with the deploy  

**Where this lives on my site.**  
Open source / contributions: https://kmrrohit.space/opensource  
Application brief: https://kmrrohit.space/profile  

I am keen on the 2-month training if Anthony is open to it — happy to prepare ahead (Terraform style guide, module layout, whatever you use internally) so I am useful quickly rather than sightseeing. Whenever you want to intro us, I am free.

Thanks again,
Rohit
