export type ProjectLink = {
	label: string;
	href: string;
};

export type Project = {
	title: string;
	/** One line. Shown in the list view, so keep it to a single sentence. */
	summary: string;
	/** Longer paragraphs, shown on the projects page under the summary. */
	detail?: string[];
	year: string;
	stack: string[];
	links?: ProjectLink[];
	featured?: boolean;
	/**
	 * Ordering bucket. `work` is open source and production systems, `lab` is
	 * smaller experiments kept around because the idea was worth writing down.
	 */
	group: 'work' | 'lab';
};

export const projects: Project[] = [
	{
		title: 'Kubeflow docs-agent',
		summary:
			'Agentic RAG over the whole Kubeflow surface — docs, GitHub issues, manifests and source — served as an MCP toolset behind the Kubeflow website.',
		detail: [
			'My Google Summer of Code 2026 project, and the thing I spend most of my open source time on. The starting point was a documentation chatbot that could only read Markdown. A Kubeflow user with a broken pipeline does not have a documentation problem, they have a "this exact error appeared in an issue eighteen months ago" problem, so the agent needed to read more than prose.',
			'I added ingestion pipelines for GitHub issues, application code and Kubernetes manifests, and exposed them as separate MCP tools so the agent can choose where to look instead of retrieving from one undifferentiated blob. Every chunk carries path, product area, version and source metadata, which is what makes filtered retrieval possible at query time.',
			'The largest application change was merged as a single 5.4k-line PR covering a three-tool MCP server, TEI embeddings, the issues and code pipelines, Terraform for embeddings/Milvus/KServe/Pipelines, and GitHub Actions that compile, test, and optionally deploy to OKE. Since then the infra work has moved to the edge: rate limits, CORS lockdown and session-JWT auth, with Istio configuration migrated into a Helm chart so the guardrails ship with the deployment rather than living as unreviewed YAML heredocs in Terraform.'
		],
		year: '2026',
		stack: [
			'Python',
			'MCP',
			'Agentic RAG',
			'Kubeflow Pipelines',
			'KServe',
			'Istio',
			'Helm',
			'Terraform',
			'OKE',
			'GitHub Actions'
		],
		links: [
			{ label: 'Repository', href: 'https://github.com/kubeflow/docs-agent' },
			{
				label: 'My pull requests',
				href: 'https://github.com/kubeflow/docs-agent/pulls?q=is%3Apr+author%3Akmr-rohit'
			},
			{ label: 'Open source page', href: '/opensource' }
		],
		featured: true,
		group: 'work'
	},
	{
		title: 'Deploy Kubeflow on OCI',
		summary:
			'Terraform modules that provision an OKE cluster and install a full Kubeflow platform on Oracle Cloud — networking through Pipelines and KServe.',
		detail: [
			'Built for jaiakash/deploy-kubeflow so someone can stand up Kubeflow on OCI without hand-assembling VCN rules and kustomize applies. Two Terraform modules: oke-cluster (VCN, IGW/NAT/Service gateways, three subnets, Flannel-tuned security lists, E5.Flex node pool) and kubeflow-platform (cert-manager, Istio, Dex, Knative, KServe, Pipelines, Central Dashboard, Profiles).',
			'The install path is the unglamorous part that actually matters: CRI-O short-name image patching, MySQL PVC auto-creation on oci-bv, webhook-aware retries, server-side apply with force-conflicts, plus OCI auth / cluster / install / troubleshooting guides.'
		],
		year: '2026',
		stack: ['Terraform', 'OCI', 'OKE', 'Kubeflow', 'Istio', 'KServe', 'Kustomize'],
		links: [
			{ label: 'Repository', href: 'https://github.com/jaiakash/deploy-kubeflow' },
			{ label: 'Merged PR', href: 'https://github.com/jaiakash/deploy-kubeflow/pull/5' }
		],
		featured: true,
		group: 'work'
	},
	{
		title: 'MacBatch',
		summary:
			'Batch AI workloads on a pool of idle Apple Silicon machines — a job queue, lease scheduler and worker CLI for embedding, OCR and classification that can wait.',
		detail: [
			'Offline AI work is usually billed like interactive traffic. Re-embedding a corpus, OCR over an archive, or overnight classification does not need a latency SLA — it needs cheap throughput on hardware that is already paid for and often idle overnight.',
			'macbatch is three moving parts: a FastAPI control plane that holds the queue, workers that lease shards (600s lease, then reassign), and Ollama on each Mac running a whole model locally. Workers pull; the control plane never opens a connection inbound, so a laptop behind home NAT can join with outbound HTTPS only.',
			'Measured 252,686 embed items/hour on one MacBook Air with shard batching (2.8× from batching alone on the same machine). The CLI and control plane are open source; a hosted product surface sits at macbatch.vercel.app.'
		],
		year: '2026',
		stack: ['TypeScript', 'Python', 'FastAPI', 'Ollama', 'Apple Silicon', 'npm'],
		links: [
			{ label: 'Product', href: 'https://macbatch.vercel.app/' },
			{ label: 'Docs', href: 'https://kmr-rohit.github.io/macbatch/' },
			{ label: 'Source', href: 'https://github.com/kmr-rohit/macbatch' }
		],
		featured: true,
		group: 'work'
	},
	{
		title: 'CrackRound',
		summary:
			'An agentic mock-interview platform: five streaming interviewer personas, a real-time voice loop, and a live code judge wired into the model context.',
		detail: [
			'Built end to end, from an empty repository to something people pay per session to use. The interviewer is not a chat window with a prompt — it is a persona that holds a rubric, drives the round, interrupts, and follows up on a weak answer.',
			'The voice loop is the part I am most happy with: streaming speech-to-text into GPT-4o and back out through streamed TTS over a WebSocket, at roughly 1.5 seconds end to end. Anything slower and the conversation stops feeling like an interview.',
			'A DSA judge and a system-design whiteboard both feed into the model context, so the interviewer can see what you actually wrote rather than what you claimed. Scoring is JSON-schema constrained across five dimensions, with latency tracing and a hard $2-per-session cost ceiling.'
		],
		year: '2025',
		stack: [
			'Next.js',
			'TypeScript',
			'GPT-4o',
			'WebSockets',
			'Prisma',
			'PostgreSQL',
			'Sarvam'
		],
		featured: true,
		group: 'work'
	},
	{
		title: 'AirCab',
		summary:
			'A voice-first booking agent that turns a spoken request into a confirmed ride, with the whole conversation under one tool-calling loop.',
		detail: [
			'An experiment in how far you can push a voice agent when the task has real side effects. Booking a ride is a good test case because it is short, has a clear success condition, and punishes a model that hallucinates a confirmation.',
			'The interesting problem was not the speech pipeline but the state machine underneath it: what the agent is allowed to assume, when it must read back a detail before committing, and how to recover when the user changes their mind three turns in.'
		],
		year: '2025',
		stack: ['Python', 'LLM tool calling', 'STT/TTS', 'FastAPI'],
		group: 'work'
	},
	{
		title: 'FlowForge',
		summary:
			'A node-based canvas for composing LLM workflows, where the graph you draw is the execution plan the runtime actually walks.',
		detail: [
			'Visual agent builders usually stop at demo quality because the canvas and the runtime drift apart. FlowForge keeps one representation: the graph is compiled straight into the execution plan, so what runs is what you drew.',
			'Nodes cover the usual set — prompts, tools, retrievers, branches, loops — and the runtime handles fan-out and joins. It exists because I got tired of rewriting the same orchestration glue by hand for every new agent idea.'
		],
		year: '2025',
		stack: ['TypeScript', 'React', 'ReactFlow', 'LangGraph', 'FastAPI'],
		group: 'work'
	},
	{
		title: 'AI Learn',
		summary:
			'Voice-to-voice learning platform that teaches interview topics in Hinglish, built as a Next.js PWA over a FastAPI provider layer.',
		detail: [
			'Most tutoring products assume you want to read. This one assumes you are commuting. The teaching style is deliberately Hinglish because that is how the explanation actually sounds when a senior engineer walks a junior through a concept in an Indian office.',
			'STT, TTS and the LLM sit behind swappable adapters, so the same session logic runs against mocks in tests and Sarvam in production.'
		],
		year: '2026',
		stack: ['Next.js', 'FastAPI', 'Sarvam', 'PWA'],
		links: [
			{ label: 'Live', href: 'https://aitutor-two-hazel.vercel.app' },
			{ label: 'Source', href: 'https://github.com/kmr-rohit/aitutor' }
		],
		group: 'work'
	},
	{
		title: 'VizCode',
		summary:
			'Generates step-by-step algorithm visualisations from a prompt, with Gemini emitting a structured trace the renderer replays.',
		detail: [
			'The trick is to never let the model draw. It emits a typed trace of state transitions — array writes, pointer moves, node visits — and a deterministic renderer animates it. That keeps the visualisation correct even when the explanation is not.'
		],
		year: '2025',
		stack: ['TypeScript', 'React', 'Gemini', 'Python'],
		links: [{ label: 'Source', href: 'https://github.com/kmr-rohit/VizCode' }],
		group: 'lab'
	},
	{
		title: 'Blog to Podcast',
		summary:
			'Scrapes any public blog post and returns a listenable episode: Firecrawl for extraction, GPT-4 for the script, ElevenLabs for the voice.',
		year: '2025',
		stack: ['Python', 'Streamlit', 'GPT-4', 'Firecrawl', 'ElevenLabs'],
		links: [{ label: 'Source', href: 'https://github.com/kmr-rohit/P1-BlogToPodcast' }],
		group: 'lab'
	},
	{
		title: 'Online handwriting recognition',
		summary:
			'BiLSTM + CTC over pen-stroke sequences from IAM-OnDB — recognising handwriting from how it was written, not how it looks.',
		detail: [
			'Offline HTR throws away the most informative signal in handwriting: the order and velocity of the strokes. This model takes the raw coordinate sequence through a 1D CNN into a bidirectional LSTM with a CTC head, trained on 12,179 lines from 221 writers.'
		],
		year: '2025',
		stack: ['PyTorch', 'BiLSTM', 'CTC', 'IAM-OnDB'],
		links: [{ label: 'Source', href: 'https://github.com/kmr-rohit/LstmOnlineHTR' }],
		group: 'lab'
	},
	{
		title: 'CodeNITW',
		summary:
			'Placement-prep site for NIT Warangal students, with a Codeforces-API leaderboard that a few hundred people actually used.',
		year: '2023',
		stack: ['React', 'Firebase', 'Tailwind'],
		links: [{ label: 'Live', href: 'https://codenitw.vercel.app' }],
		group: 'lab'
	}
];

export const featuredProjects = projects.filter((project) => project.featured);
