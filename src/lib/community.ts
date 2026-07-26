export type Update = {
	/** ISO date, YYYY-MM-DD. */
	date: string;
	title: string;
	blurb: string;
	href: string;
};

/**
 * The bi-weekly community call for kubeflow/docs-agent. Kubeflow announced the
 * series on 11 June 2026 and it runs on alternate Saturdays from 13 June, so
 * the next date is derived rather than kept up to date by hand.
 */
export const call = {
	name: 'Kubeflow Docs Agent community call',
	tagline: 'Every other Saturday, on kubeflow/docs-agent.',
	description: [
		'The Kubeflow Docs Agent project runs a community call every other Saturday. It is a working session rather than a talk: what landed since last time, what is still open, where the priorities sit, and which pieces are small enough for someone new to pick up.',
		'I am there as the Google Summer of Code contributor on the project, so most of what I bring is whatever the agent is currently getting wrong — a question its retrieval misses, an index that wants resplitting, a tool boundary that turned out to be drawn in the wrong place.',
		'Anyone is welcome. Agenda items go into a shared doc ahead of time, and the Zoom link below is the standing one.'
	],
	cadence: 'Every other Saturday',
	localTime: '11:00 PM IST',
	utcTime: '17:30 UTC',
	where: 'Zoom, hosted on LFX',
	audience: 'Anyone who wants to contribute to Kubeflow Docs Agent, or watch how it gets built.',
	joinHref:
		'https://zoom-lfx.platform.linuxfoundation.org/meeting/99511158809?password=29577223-6733-4df0-828b-75a95f474555',
	announcementHref:
		'https://www.linkedin.com/posts/kubeflow_google-calendar-easier-time-management-activity-7470910569932279809-4Op2',
	repo: 'kubeflow/docs-agent',
	repoHref: 'https://github.com/kubeflow/docs-agent',
	/** First session of the series. Every later one is `intervalDays` on. */
	seriesStart: '2026-06-13',
	intervalDays: 14,
	utcHour: 17,
	utcMinute: 30
};

export const updates: Update[] = [
	{
		date: '2026-06-26',
		title: 'Agentic RAG on Kubeflow, at the Community Showcase',
		blurb:
			'Speaking with Santhosh Toorpu at the Kubeflow Community Showcase 2026 on moving agentic RAG off the prototype bench: ingestion, embeddings and index updates as pipeline steps, with retrieval evaluation and agent testing as first-class stages rather than an afterthought.',
		href: 'https://www.linkedin.com/posts/rr7433446_kubeflow-mlops-llmops-activity-7476387596428963840-61Wn'
	},
	{
		date: '2026-06-20',
		title: 'First KubeCon — CloudNativeCon India, Mumbai',
		blurb:
			'A day at the Kubeflow booth arguing about agent-integrated architectures and where the project is heading, then talks on distributed vLLM, large-scale inference and model serving.',
		href: 'https://www.linkedin.com/posts/rr7433446_kubecon-cloudnativecon-kubernetes-activity-7474070788711657472-XlXk'
	}
];

/**
 * The next occurrence on or after `from`, counting fortnights from the first
 * session. Returns a UTC-based Date.
 */
export function nextCall(from: Date = new Date()): Date {
	const [year, month, day] = call.seriesStart.split('-').map(Number);
	const start = Date.UTC(year, month - 1, day, call.utcHour, call.utcMinute);
	const period = call.intervalDays * 24 * 60 * 60 * 1000;
	const elapsed = from.getTime() - start;

	if (elapsed <= 0) return new Date(start);
	return new Date(start + (Math.floor(elapsed / period) + 1) * period);
}
