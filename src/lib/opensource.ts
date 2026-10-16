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
		'Most of my open-source time is Kubeflow. As a GSoC 2026 contributor and Kubeflow org member, I built Flo, the agentic RAG docs assistant on docs-agent, and ran it in production with GitOps, evals, and user feedback. Before that, the Terraform/Helm path that puts a full Kubeflow platform on OCI.',
	github: 'https://github.com/kmr-rohit'
};

/**
 * Infra + application contributions worth showing an architect.
 * Ordered newest-first.
 */
export const contributions: Contribution[] = [
	{
		repo: 'kubeflow/docs-agent',
		repoHref: 'https://github.com/kubeflow/docs-agent',
		title: 'Promotion by commit, Argo CD auto-sync, and data retention',
		blurb:
			'Production pins a reviewed main commit and deploys the matching image tags, so a promotion is one small PR and a rollback is a revert. A script builds the promotion PR with changelog and eval results. Safe apps auto-sync through an app-of-apps, and a weekly CronJob trims Langfuse traces in ClickHouse and S3 (4 weeks live, 2 weeks eval).',
		href: 'https://github.com/kubeflow/docs-agent/pull/274',
		status: 'Merged · Oct 2026 · +342 / −26',
		tags: ['Argo CD', 'GitOps', 'Release', 'ClickHouse', 'Langfuse']
	},
	{
		repo: 'kubeflow/docs-agent',
		repoHref: 'https://github.com/kubeflow/docs-agent',
		title: 'User feedback loop and a Material 3 chat widget',
		blurb:
			'Thumbs up/down on every answer, recorded as Langfuse scores against the trace, plus a nightly job that triages thumbs-down answers. Redesigned the docs chat widget in Material 3 with suggestion chips, dark mode, mobile layout, and a clear data-collection notice.',
		href: 'https://github.com/kubeflow/docs-agent/pull/268',
		status: 'Merged · Oct 2026 · +2k / −894',
		tags: ['Langfuse', 'Feedback', 'Frontend', 'Material 3']
	},
	{
		repo: 'kubeflow/docs-agent',
		repoHref: 'https://github.com/kubeflow/docs-agent',
		title: 'Staging environment with evals on every sync',
		blurb:
			'A staging copy of the agent that Argo CD keeps on main, with a PostSync hook that runs an LLM-as-judge eval set (Qwen) and posts results to Langfuse, so every merged change is scored before it reaches production.',
		href: 'https://github.com/kubeflow/docs-agent/pull/267',
		status: 'Merged · Oct 2026 · +885',
		tags: ['Argo CD', 'Evals', 'LLM-as-judge', 'Langfuse']
	},
	{
		repo: 'kubeflow/docs-agent',
		repoHref: 'https://github.com/kubeflow/docs-agent',
		title: 'Argo CD setup and Qwen judge release',
		blurb:
			'Brought the whole deployment under Argo CD with multi-source Applications (public charts, private config), observe-only first so drift could be reviewed safely, plus the Qwen judge model release and session-issuer image builds in CI.',
		href: 'https://github.com/kubeflow/docs-agent/pull/266',
		status: 'Merged · Oct 2026 · +889 / −193',
		tags: ['Argo CD', 'Helm', 'GitOps', 'CI/CD']
	},
	{
		repo: 'kubeflow/docs-agent',
		repoHref: 'https://github.com/kubeflow/docs-agent',
		title: 'Issue-triage instructions and labels',
		blurb:
			'Markdown instructions and a label set that let the agent triage new GitHub issues consistently, grounded in the same retrieval as the docs assistant.',
		href: 'https://github.com/kubeflow/docs-agent/pull/257',
		status: 'Merged · Sep 2026 · +911',
		tags: ['Agents', 'GitHub', 'Triage']
	},
	{
		repo: 'kubeflow/docs-agent',
		repoHref: 'https://github.com/kubeflow/docs-agent',
		title: 'Better RAG retrieval and Helm upgrades',
		blurb:
			'Improved retrieval quality across the docs, issues and code indexes and moved deployments to Helm upgrades, so releases are repeatable instead of hand-applied.',
		href: 'https://github.com/kubeflow/docs-agent/pull/240',
		status: 'Merged · Sep 2026 · +2.5k / −158',
		tags: ['RAG', 'Milvus', 'Helm']
	},
	{
		repo: 'kubeflow/docs-agent',
		repoHref: 'https://github.com/kubeflow/docs-agent',
		title: 'Grounded, cited answers and no more 30s A2A cut-offs',
		blurb:
			'Fixed long agent answers being truncated at 30 seconds over A2A, and made replies grounded in retrieved sources with citations.',
		href: 'https://github.com/kubeflow/docs-agent/pull/234',
		status: 'Merged · Aug 2026 · +1.7k / −156',
		tags: ['A2A', 'kagent', 'Grounding']
	},
	{
		repo: 'kubeflow/docs-agent',
		repoHref: 'https://github.com/kubeflow/docs-agent',
		title: 'Anonymous session-JWT auth for the public chatbot',
		blurb:
			'A small session issuer hands anonymous visitors short-lived JWTs that the Istio edge verifies, so the public chatbot is protected without asking anyone to log in.',
		href: 'https://github.com/kubeflow/docs-agent/pull/219',
		status: 'Merged · Aug 2026 · +755',
		tags: ['Istio', 'Auth', 'JWT', 'Gateway']
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
		repo: 'jaiakash/deploy-kubeflow',
		repoHref: 'https://github.com/jaiakash/deploy-kubeflow',
		title: 'OKE cluster + Kubeflow platform on OCI',
		blurb:
			'Terraform modules for a full OKE stack (VCN, subnets, security lists, node pool) and a Kubeflow platform install (cert-manager, Istio, Dex, Knative, KServe, Pipelines, Central Dashboard, Profiles) with install scripts, guides, and troubleshooting for OCI.',
		href: 'https://github.com/jaiakash/deploy-kubeflow/pull/5',
		status: 'Merged · Mar 2026 · +1.3k lines',
		tags: ['Terraform', 'OKE', 'OCI', 'Kubeflow', 'Istio', 'KServe']
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
		oneLiner: 'GSoC 2026 — Flo, an agentic RAG assistant: MCP tools, guarded Istio edge, Argo CD GitOps, staging evals, Langfuse feedback.'
	}
];
