export type Role = {
	title: string;
	org: string;
	orgHref?: string;
	period: string;
	location?: string;
	points: string[];
};

export const roles: Role[] = [
	{
		title: 'Software Development Engineer 2',
		org: 'Akamai · Next-Gen AppBattery (NGAB)',
		orgHref: 'https://www.akamai.com',
		period: 'Oct 2026 — present',
		location: 'Bengaluru, India',
		points: [
			'Work on NGAB, Akamai\'s internal Kubernetes PaaS that lets app teams provision, build, sign, deploy and operate services on RKE2 clusters through a control-plane API, CI/CD pipelines and Argo CD GitOps.',
			'Build on the Python services behind it: the Flask control-plane API, Jenkins/CloudBees build and deploy pipelines, Jinja2-rendered Kubernetes manifests with traffic splits, and Helm charts for the platform stack.',
			'Platform work spans supply-chain security (cosign signing and verification, KMI-backed secrets, mTLS) and per-node daemons for secrets, metadata, logging and leader election, across commercial and gov environments.'
		]
	},
	{
		title: 'Maintainer & GSoC 2026 contributor, docs-agent (Flo)',
		org: 'Kubeflow (CNCF) · Google Summer of Code 2026',
		orgHref: 'https://github.com/kubeflow/docs-agent',
		period: 'May 2026 — present',
		location: 'Remote',
		points: [
			'Expanding kubeflow/docs-agent from a documentation chatbot into an agentic RAG reference architecture for the Kubeflow project.',
			'Built multi-index retrieval across GitHub issues, application code, Kubernetes manifests and 1,000+ Markdown pages — roughly 10,000 searchable chunks carrying path, product-area, version and source metadata.',
			'Merged a 5.4k-line change adding a three-tool MCP server, TEI embeddings, the issues and code ingestion pipelines, Terraform for cluster-side pieces (embeddings, Milvus, KServe, Pipelines), and GitHub Actions CI with optional CD onto OCI/OKE.',
			'Hardened the public edge: migrated Istio Gateway/TLS/CORS/rate-limit config from raw Terraform manifests into a Helm chart (`gateway-guardrails`), plus anonymous session-JWT auth work for the public chatbot.',
			'Authored Terraform modules to deploy a full OKE cluster and Kubeflow platform on OCI (VCN networking, node pool, cert-manager, Istio, Dex, Knative, KServe, Pipelines) in jaiakash/deploy-kubeflow.',
			'Added a 71-test suite and CI workflow covering retrieval behaviour, so a regression in ranking fails the build instead of surfacing in production.',
			'Took Flo, the docs assistant, to production with GitOps: Argo CD multi-source Applications, a staging copy that runs an LLM-as-judge eval set on every sync, and promotion by pinned commit so a release is one small PR and a rollback is a revert.',
			'Closed the loop with users: thumbs up/down recorded as Langfuse scores with nightly triage of bad answers, a Material 3 chat widget, and a weekly retention job for Langfuse traces in ClickHouse and S3.',
			'Now making ingestion run on its own: docs, issues and code pipelines registered as Kubeflow Pipelines recurring runs from an Argo CD PostSync job, community-distribution docs indexed, the cross-encoder reranker deployed, and pages removed upstream pruned from the index.'
		]
	},
	{
		title: 'AI Application Developer',
		org: 'Oracle',
		period: 'Jun 2024 — Oct 2026',
		location: 'Bengaluru, India',
		points: [
			'Build agentic and retrieval-backed features inside Oracle Fusion SCM Cloud across three customer-facing workflows: catalog lookup, order review and planner assistance.',
			'Designed and built an Alert Notification Microservice (FastAPI, Kafka, Oracle, SMTP, Docker/Helm) — HTTP ingestion durably enqueues caller-rendered alerts onto a replicated Kafka topic, then a consumer group delivers asynchronously with at-least-once semantics, bounded retries and a dead-letter topic.',
			'Implemented idempotent acceptance on `(source, idempotency_key)` with a transactional outbox so caller/producer retries collapse to a single Kafka record, and replaced hand-rolled DB row-leasing with Kafka partition assignment and rebalancing for concurrency and worker failover.',
			'Instrumented ingestion, produce, consume and delivery with Prometheus metrics (including consumer lag and DLQ depth), configured alert rules, and routed operational alerts through Alertmanager to Slack.',
			'Designed a part-matching pipeline combining fuzzy matching, semantic retrieval, clustering and a web-search fallback over manufacturer and retailer catalogs, lifting match coverage for asset-mapping workflows by around 30%.',
			'Shipped an order-classification agent with batch processing, rule-evaluation guardrails, exception routing and a human-review handoff, handling 10,000+ order lines per run.',
			'Built RAG planner-assist flows over exceptions, notes and tabular data that cut repeated manual investigation by around 40% through source-grounded answers.',
			'Won the Oracle Gen AI Hackathon — first among 33 teams, top five among 300+ participants.'
		]
	},
	{
		title: 'Application Developer Intern',
		org: 'Oracle',
		period: 'May 2023 — Jul 2023',
		location: 'Hyderabad, India',
		points: [
			'Implemented Copy Data for lead-time columns in Oracle SCM, and optimised the retrieval and update path with Elasticsearch queries and PATCH-based API updates.',
			'Added linear-regression trend analysis to Oracle JET charts for supply-chain forecasting views.'
		]
	}
];

export const education = {
	degree: 'B.Tech, Mechanical Engineering',
	school: 'National Institute of Technology, Warangal',
	period: '2020 — 2024'
};

export const achievements = [
	'Selected for Google Summer of Code 2026 with Kubeflow, for an agentic RAG project.',
	'Won the Oracle Gen AI Hackathon: 1st of 33 teams, top 5 among 300+ employees.',
	'Runner-up, Tri-NIT Hackathon 2024, backend track.',
	'600+ problems solved across LeetCode, GeeksforGeeks, CodeChef and Codeforces; ran 15+ competitive programming contests with student discussions.'
];

export type SkillGroup = {
	label: string;
	items: string[];
};

export const skills: SkillGroup[] = [
	{
		label: 'Agents & LLM systems',
		items: [
			'LangGraph',
			'LangChain',
			'MCP',
			'Agentic RAG',
			'Tool calling',
			'Evals',
			'QLoRA / LoRA',
			'Structured output'
		]
	},
	{
		label: 'Serving & retrieval',
		items: ['vLLM', 'SGLang', 'KServe', 'TEI', 'Milvus', 'FAISS', 'ChromaDB', 'Elasticsearch']
	},
	{
		label: 'Platform',
		items: [
			'Kubernetes',
			'Argo CD',
			'Kubeflow Pipelines',
			'Docker',
			'Istio',
			'Helm',
			'Terraform',
			'OCI / OKE',
			'GitHub Actions',
			'Kafka',
			'Prometheus',
			'Alertmanager'
		]
	},
	{
		label: 'Languages & frameworks',
		items: [
			'Python',
			'TypeScript',
			'Java',
			'C++',
			'FastAPI',
			'Next.js',
			'React',
			'PostgreSQL',
			'Oracle DB'
		]
	}
];
