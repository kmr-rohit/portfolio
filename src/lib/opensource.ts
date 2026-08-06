/**
 * Open-source highlights for /opensource.
 * Contribution entries are curated from GitHub (kmr-rohit) — update when
 * major PRs merge. The bi-weekly call still lives in `community.ts`.
 */

export type Contribution = {
	repo: string;
	repoHref: string;
	title: string;
	blurb: string;
	href: string;
	/** e.g. "Merged · Mar 2026" */
	status: string;
	tags: string[];
};

export const opensourceIntro = {
	title: 'Open Source',
	lede:
		'Most of my open-source time is Kubeflow — agentic RAG on docs-agent, and the Terraform/Helm path that puts a full platform on OCI.',
	github: 'https://github.com/kmr-rohit'
};

/**
 * Infra + application contributions worth showing an architect.
 * Ordered newest-first within the list we surface.
 */
export const contributions: Contribution[] = [
	{
		repo: 'jaiakash/deploy-kubeflow',
		repoHref: 'https://github.com/jaiakash/deploy-kubeflow',
		title: 'OKE cluster + Kubeflow platform on OCI',
		blurb:
			'Terraform modules for a full OKE stack (VCN, subnets, security lists, node pool) and a Kubeflow platform install (cert-manager, Istio, Dex, Knative, KServe, Pipelines, Central Dashboard, Profiles) with install scripts, guides, and troubleshooting for OCI.',
		href: 'https://github.com/jaiakash/deploy-kubeflow/pull/5',
		status: 'Merged · Mar 2026 · +1.3k lines',
		tags: ['Terraform', 'OKE', 'OCI', 'Kubeflow', 'Istio', 'KServe']
	},
	{
		repo: 'kubeflow/docs-agent',
		repoHref: 'https://github.com/kubeflow/docs-agent',
		title: 'Gateway guardrails Helm chart (Istio edge)',
		blurb:
			'Migrated public chatbot edge config out of raw Terraform kubectl heredocs into a Helm chart — Gateway, TLS, CORS lockdown, rate limits, and AuthorizationPolicies — so the edge is reviewable, versioned, and deployable with the rest of the stack.',
		href: 'https://github.com/kubeflow/docs-agent/pull/218',
		status: 'Merged · Aug 2026 · +1.7k / −483',
		tags: ['Helm', 'Istio', 'Terraform', 'Rate limits', 'CORS']
	},
	{
		repo: 'kubeflow/docs-agent',
		repoHref: 'https://github.com/kubeflow/docs-agent',
		title: 'MCP tools, TEI embeddings, pipelines, OKE CI/CD',
		blurb:
			'Three Milvus-backed MCP tools, TEI embeddings, issues/code ingestion pipelines, Terraform for embeddings/KServe/Milvus/KFP pieces, and GitHub Actions that compile/test and optionally deploy to OKE (GHCR push + OCI kubectl).',
		href: 'https://github.com/kubeflow/docs-agent/pull/210',
		status: 'Merged · Jun 2026 · +5.4k lines',
		tags: ['CI/CD', 'OKE', 'Terraform', 'MCP', 'TEI', 'GitHub Actions']
	},
	{
		repo: 'kubeflow/docs-agent',
		repoHref: 'https://github.com/kubeflow/docs-agent',
		title: 'Anonymous session-JWT auth for the public chatbot',
		blurb:
			'Follow-on gateway work: session JWT auth for anonymous public chatbot traffic on the Istio edge (open / in progress).',
		href: 'https://github.com/kubeflow/docs-agent/pull/219',
		status: 'Open',
		tags: ['Istio', 'Auth', 'Gateway']
	}
];

export const opensourceRepos = [
	{
		name: 'jaiakash/deploy-kubeflow',
		href: 'https://github.com/jaiakash/deploy-kubeflow',
		oneLiner: 'Terraform automation to stand up OKE + Kubeflow on Oracle Cloud.'
	},
	{
		name: 'kubeflow/docs-agent',
		href: 'https://github.com/kubeflow/docs-agent',
		oneLiner: 'GSoC 2026 — agentic RAG reference architecture, MCP tools, Helm edge, OKE CD.'
	}
];
