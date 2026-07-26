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
		title: 'Open source contributor, docs-agent',
		org: 'Kubeflow · Google Summer of Code 2026',
		orgHref: 'https://github.com/kubeflow/docs-agent',
		period: 'May 2026 — present',
		location: 'Remote',
		points: [
			'Expanding kubeflow/docs-agent from a documentation chatbot into an agentic RAG reference architecture for the Kubeflow project.',
			'Built multi-index retrieval across GitHub issues, application code, Kubernetes manifests and 1,000+ Markdown pages — roughly 10,000 searchable chunks carrying path, product-area, version and source metadata.',
			'Merged a 5.4k-line change adding a three-tool MCP server, TEI embeddings, the issues and code ingestion pipelines, and CI/CD onto OCI/OKE.',
			'Now hardening the public edge: rate limiting, CORS lockdown and anonymous session-JWT auth, with Istio configuration migrated into a Helm chart so guardrails ship with the deployment.',
			'Added a 71-test suite and CI workflow covering retrieval behaviour, so a regression in ranking fails the build instead of surfacing in production.'
		]
	},
	{
		title: 'AI Application Developer',
		org: 'Oracle',
		period: 'Jun 2024 — present',
		location: 'Bengaluru, India',
		points: [
			'Build agentic and retrieval-backed features inside Oracle Fusion SCM Cloud across three customer-facing workflows: catalog lookup, order review and planner assistance.',
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
		items: ['Kubernetes', 'Kubeflow Pipelines', 'Docker', 'Istio', 'Helm', 'OCI / OKE', 'GitHub Actions']
	},
	{
		label: 'Languages & frameworks',
		items: ['Python', 'TypeScript', 'Java', 'C++', 'FastAPI', 'Next.js', 'React', 'PostgreSQL']
	}
];
