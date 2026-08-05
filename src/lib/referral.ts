/**
 * Cold referral / DM templates grounded in PROFILE.md.
 * Placeholders use {{double braces}} — replace before sending.
 *
 * Hidden at /referral (not in nav or sitemap).
 */

export type ReferralTrack = 'software' | 'ai';
export type ReferralKind = 'hr' | 'alumni' | 'random' | 'x';
export type ReferralChannel = 'linkedin' | 'email' | 'x';

export type ReferralTemplate = {
	id: string;
	track: ReferralTrack;
	kind: ReferralKind;
	channel: ReferralChannel;
	/** Short UI label */
	label: string;
	/** Email subject; omit for DMs */
	subject?: string;
	body: string;
};

export const trackLabels: Record<ReferralTrack, string> = {
	software: 'Software engineer roles',
	ai: 'AI developer roles'
};

export const kindLabels: Record<ReferralKind, string> = {
	hr: 'HR / recruiter DM',
	alumni: 'School alumni DM',
	random: 'Random referral DM',
	x: 'X DM (team members)'
};

export const channelLabels: Record<ReferralChannel, string> = {
	linkedin: 'LinkedIn',
	email: 'Email',
	x: 'X'
};

/** Facts pulled from PROFILE.md — keep in sync when the brief changes. */
export const referralFacts = {
	name: 'Rohit Kumar',
	oneLiner:
		'AI engineer at Oracle building agentic and retrieval systems in Fusion SCM; GSoC 2026 contributor on Kubeflow Docs Agent (agentic RAG + MCP).',
	lookingForAi:
		'Senior / mid-senior AI engineering: agent platforms, LLM serving & inference, retrieval / RAG at scale.',
	lookingForSwe:
		'Backend / platform roles where I own reliability end to end — APIs, messaging, observability, and shipping in production.',
	highlightsAi: [
		'Oracle Fusion SCM — agentic + RAG workflows (part matching ~+30% coverage; order agent 10k+ lines/run; planner RAG ~−40% repeated investigation)',
		'GSoC 2026 · kubeflow/docs-agent — multi-index agentic RAG + MCP tools (~10k chunks; issues/code/manifests/docs)',
		'MacBatch — batch AI on idle Apple Silicon (lease scheduler + worker pool)',
		'Writing on vLLM, SGLang, context engineering, and agent harnesses'
	],
	highlightsSwe: [
		'Alert Notification Microservice — FastAPI + Kafka + Oracle + SMTP: idempotent HTTP ingest, outbox, consumer-group delivery, DLQ, Prometheus → Alertmanager → Slack',
		'Oracle Fusion SCM — production Python services, batch agents, Elasticsearch retrieval paths',
		'Docker / Kubernetes / Helm packaging; Prometheus instrumentation',
		'NIT Warangal · B.Tech Mechanical · 2020–2024; competitive programming background'
	],
	links: {
		site: 'https://kmrrohit.space',
		profile: 'https://kmrrohit.space/profile',
		resumeAi: 'https://kmrrohit.space/rohit-kumar-resume-ai.pdf',
		resumeSoftware: 'https://kmrrohit.space/rohit-kumar-resume-software.pdf',
		/** @deprecated Prefer resumeAi / resumeSoftware — kept as AI default for old bookmarks */
		resume: 'https://kmrrohit.space/rohit-kumar-resume-ai.pdf',
		github: 'https://github.com/kmr-rohit',
		linkedin: 'https://www.linkedin.com/in/rr7433446/',
		gsoc: 'https://github.com/kubeflow/docs-agent',
		macbatch: 'https://macbatch.vercel.app/',
		writing: 'https://kmrrohit.space/writing'
	},
	school: 'NIT Warangal',
	location: 'Bengaluru, India'
} as const;

const L = referralFacts.links;

export function resumeFor(track: ReferralTrack): string {
	return track === 'software' ? L.resumeSoftware : L.resumeAi;
}

function soft(track: ReferralTrack): string {
	const resume = resumeFor(track);
	return track === 'ai'
		? `I'm an AI engineer at Oracle (Fusion SCM) and a GSoC 2026 contributor on Kubeflow Docs Agent — agentic RAG + MCP. Brief: ${L.profile} · Résumé: ${resume}`
		: `I'm an AI/Application Developer at Oracle. Recently I built an Alert Notification Microservice (FastAPI, Kafka, Oracle, SMTP) with idempotent ingest, consumer-group delivery, DLQ, and Prometheus → Slack ops alerting. Brief: ${L.profile} · Résumé: ${resume}`;
}

function ask(track: ReferralTrack): string {
	return track === 'ai'
		? 'Would you be open to referring me for {{Role}} ({{Job link}}) — or pointing me to the right person if referrals go through a form?'
		: 'Would you be open to referring me for {{Role}} ({{Job link}}) — or sharing the internal referral / careers path if that is easier?';
}

/** Shared placeholder legend shown on the page. */
export const placeholderLegend = [
	{ token: '{{Name}}', meaning: 'Recipient first name' },
	{ token: '{{Company}}', meaning: 'Company name' },
	{ token: '{{Role}}', meaning: 'Exact role title' },
	{ token: '{{Job link}}', meaning: 'Job / Greenhouse / Lever URL' },
	{ token: '{{Team}}', meaning: 'Team or product (for X / teammate DMs)' },
	{ token: '{{Mutual}}', meaning: 'Shared context (alumni year, mutual, post you liked)' }
];

export const templates: ReferralTemplate[] = [
	/* ── Software · HR ─────────────────────────────────────────── */
	{
		id: 'swe-hr-li',
		track: 'software',
		kind: 'hr',
		channel: 'linkedin',
		label: 'LinkedIn — short',
		body: `Hi {{Name}} — I saw the {{Role}} opening at {{Company}}.

I'm Rohit, AI/Application Developer at Oracle in Bengaluru. Recently I designed and shipped an Alert Notification Microservice (FastAPI + Kafka + Oracle + SMTP): idempotent HTTP ingest, transactional outbox, Kafka consumer-group delivery with DLQ, and Prometheus → Alertmanager → Slack for ops visibility.

Résumé: ${L.resumeSoftware}
Profile: ${L.profile}

Would you have 2 minutes to review whether I'm a fit, or share the right referral path? Happy to send a tailored note for the hiring manager.`
	},
	{
		id: 'swe-hr-mail',
		track: 'software',
		kind: 'hr',
		channel: 'email',
		label: 'Email',
		subject: 'Referral interest — {{Role}} at {{Company}} · Rohit Kumar',
		body: `Hi {{Name}},

I'm reaching out about the {{Role}} role at {{Company}} ({{Job link}}).

Quick context: I'm an AI/Application Developer at Oracle (Bengaluru). Day-to-day I ship production services in Fusion SCM; recently I built an Alert Notification Microservice on FastAPI, Kafka, and Oracle — durable enqueue with acks=all, idempotent (source, key) acceptance, consumer-group SMTP delivery with bounded retries and a dead-letter topic, plus Prometheus metrics and Alertmanager → Slack for lag/DLQ.

Also: GSoC 2026 on kubeflow/docs-agent, and prior agent/RAG work if useful context for full-stack backend strength.

Résumé: ${L.resumeSoftware}
Application brief: ${L.profile}
GitHub: ${L.github}

If referrals are open, I'd appreciate being considered — happy to fill any form or send a 5-bullet summary for the hiring manager.

Thanks for your time,
Rohit Kumar
${L.site}`
	},

	/* ── Software · Alumni ─────────────────────────────────────── */
	{
		id: 'swe-alumni-li',
		track: 'software',
		kind: 'alumni',
		channel: 'linkedin',
		label: 'LinkedIn — NITW',
		body: `Hi {{Name}} — fellow ${referralFacts.school} alum here (B.Tech Mech, 2020–24).

I'm applying to {{Role}} at {{Company}} ({{Job link}}) and wanted to ask if you'd be open to a referral.

${soft('software')}

Happy to send a short blurb + résumé you can forward as-is. No pressure if bandwidth is tight — even a "try this form / this person" pointer helps.

Thanks,
Rohit`
	},
	{
		id: 'swe-alumni-mail',
		track: 'software',
		kind: 'alumni',
		channel: 'email',
		label: 'Email — NITW',
		subject: `${referralFacts.school} alum · referral ask for {{Role}} at {{Company}}`,
		body: `Hi {{Name}},

Hope you're well — I'm Rohit Kumar, ${referralFacts.school} (B.Tech Mechanical, 2020–2024). {{Mutual}}

I'm applying for {{Role}} at {{Company}}: {{Job link}}

${soft('software')}

If you're open to referring me (or pointing me to the internal process), I can send a ready-to-forward blurb + PDF. Totally fine if now isn't a good time.

Résumé: ${L.resumeSoftware}
Brief: ${L.profile}

Thanks,
Rohit
${L.linkedin}`
	},

	/* ── Software · Random ─────────────────────────────────────── */
	{
		id: 'swe-random-li',
		track: 'software',
		kind: 'random',
		channel: 'linkedin',
		label: 'LinkedIn — cold',
		body: `Hi {{Name}} — sorry for the cold note. I noticed you work on {{Team}} at {{Company}}.

I'm exploring the {{Role}} opening ({{Job link}}). ${soft('software')}

${ask('software')}

Résumé: ${L.resumeSoftware}

Happy to keep it low-effort for you — I can paste a 4-line blurb if useful.`
	},
	{
		id: 'swe-random-mail',
		track: 'software',
		kind: 'random',
		channel: 'email',
		label: 'Email — cold',
		subject: 'Quick referral ask — {{Role}} @ {{Company}}',
		body: `Hi {{Name}},

I know this is out of the blue. I'm Rohit Kumar — AI/Application Developer at Oracle — and I'm applying to {{Role}} at {{Company}} ({{Job link}}).

Why I'm writing you: {{Mutual}}

Relevant recent work: Alert Notification Microservice (FastAPI, Kafka, Oracle, SMTP) with idempotent ingest, outbox → Kafka, at-least-once consumer delivery, DLQ, and Prometheus/Alertmanager Slack alerts. Profile: ${L.profile}

${ask('software')}

Résumé: ${L.resumeSoftware}

Thanks either way — even a redirect helps.
Rohit`
	},

	/* ── Software · X teammate ─────────────────────────────────── */
	{
		id: 'swe-x',
		track: 'software',
		kind: 'x',
		channel: 'x',
		label: 'X DM — teammate',
		body: `hey {{Name}} — saw {{Company}} is hiring for {{Role}} ({{Job link}}).

I'm Rohit (Oracle). Built a FastAPI/Kafka notification service recently — idempotent ingest, consumer group + DLQ, Prom → Slack. brief: ${L.profile}

any chance you'd refer / intro to the right person on {{Team}}? can send a 3-bullet blurb. no stress if not.`
	},

	/* ── AI · HR ───────────────────────────────────────────────── */
	{
		id: 'ai-hr-li',
		track: 'ai',
		kind: 'hr',
		channel: 'linkedin',
		label: 'LinkedIn — short',
		body: `Hi {{Name}} — writing about the {{Role}} role at {{Company}}.

I'm Rohit, AI engineer at Oracle (agentic + RAG in Fusion SCM) and GSoC 2026 on kubeflow/docs-agent (multi-index agentic RAG + MCP). I also write about LLM serving (vLLM / SGLang) and agent harnesses.

One-liner: ${referralFacts.oneLiner}

Résumé: ${L.resumeAi}
Brief: ${L.profile}
Writing: ${L.writing}

Would you be open to a quick fit check or referral path for {{Job link}}?`
	},
	{
		id: 'ai-hr-mail',
		track: 'ai',
		kind: 'hr',
		channel: 'email',
		label: 'Email',
		subject: 'AI engineer — interest in {{Role}} at {{Company}} · Rohit Kumar',
		body: `Hi {{Name}},

I'm applying for {{Role}} at {{Company}} ({{Job link}}).

Who I am: AI engineer at Oracle building agentic and retrieval systems in Fusion SCM; Google Summer of Code 2026 contributor on Kubeflow Docs Agent (agentic RAG + MCP). Looking for ${referralFacts.lookingForAi}

Selected proof points:
• Oracle — part-matching (~+30% coverage), order-classification agent (10k+ lines/run), planner RAG (~−40% repeated investigation)
• GSoC — multi-index retrieval over docs/issues/code/manifests; MCP tool boundaries; retrieval tests in CI
• MacBatch — batch AI workloads on idle Apple Silicon (https://macbatch.vercel.app/)
• Writing: ${L.writing}

Résumé: ${L.resumeAi}
Application brief (stock answers + projects): ${L.profile}
GitHub: ${L.github}

Happy to complete any ATS form or send a hiring-manager blurb. Thanks for considering.

Rohit Kumar
${L.site}`
	},

	/* ── AI · Alumni ───────────────────────────────────────────── */
	{
		id: 'ai-alumni-li',
		track: 'ai',
		kind: 'alumni',
		channel: 'linkedin',
		label: 'LinkedIn — NITW',
		body: `Hi {{Name}} — ${referralFacts.school} alum (Mech, '24). Hope you're doing well.

I'm applying to {{Role}} at {{Company}} ({{Job link}}) and wanted to ask for a referral if you're open to it.

${soft('ai')}

I can send a short forwardable blurb + PDF so it's low lift. Thanks either way.

Rohit · ${L.profile}`
	},
	{
		id: 'ai-alumni-mail',
		track: 'ai',
		kind: 'alumni',
		channel: 'email',
		label: 'Email — NITW',
		subject: `${referralFacts.school} alum · AI role referral — {{Role}} @ {{Company}}`,
		body: `Hi {{Name}},

Rohit Kumar here — ${referralFacts.school}, B.Tech Mechanical 2020–2024. {{Mutual}}

I'm applying for {{Role}} at {{Company}}: {{Job link}}

${soft('ai')}

Flagship default story for hiring managers: Kubeflow Docs Agent (docs-only RAG failed → multi-index + MCP + eval/CI). Longer brief: ${L.profile}

If a referral is possible, I'll send a ready-to-paste note. If not, any pointer to the process is still gold.

Thanks,
Rohit
${L.resumeAi}`
	},

	/* ── AI · Random ───────────────────────────────────────────── */
	{
		id: 'ai-random-li',
		track: 'ai',
		kind: 'random',
		channel: 'linkedin',
		label: 'LinkedIn — cold',
		body: `Hi {{Name}} — cold message, kept short.

I follow {{Company}}'s work on {{Team}} and I'm applying to {{Role}} ({{Job link}}).

${soft('ai')}

${ask('ai')}

Résumé: ${L.resumeAi}`
	},
	{
		id: 'ai-random-mail',
		track: 'ai',
		kind: 'random',
		channel: 'email',
		label: 'Email — cold',
		subject: 'Referral ask — {{Role}} @ {{Company}} (AI engineer)',
		body: `Hi {{Name}},

Apologies for the cold email. I'm Rohit Kumar (Oracle · GSoC Kubeflow Docs Agent) applying to {{Role}} at {{Company}} ({{Job link}}).

Why you: {{Mutual}}

Relevant: agent platforms / RAG / serving — brief at ${L.profile}, writing at ${L.writing}.

${ask('ai')}

Résumé: ${L.resumeAi}

Thanks for reading —
Rohit`
	},

	/* ── AI · X teammate ───────────────────────────────────────── */
	{
		id: 'ai-x',
		track: 'ai',
		kind: 'x',
		channel: 'x',
		label: 'X DM — teammate',
		body: `hey {{Name}} — applying to {{Role}} on {{Team}} at {{Company}} ({{Job link}}).

quick context: Oracle AI eng (agents/RAG in SCM) + GSoC on kubeflow/docs-agent (agentic RAG + MCP). also write about vLLM/SGLang/harnesses. brief: ${L.profile}

open to a referral or intro? can drop a 3-bullet blurb. totally fine if inbox is chaos.`
	}
];

export function templatesFor(track: ReferralTrack, kind: ReferralKind): ReferralTemplate[] {
	return templates.filter((t) => t.track === track && t.kind === kind);
}
