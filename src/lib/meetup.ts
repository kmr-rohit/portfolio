export type Session = {
	/** ISO date, YYYY-MM-DD. */
	date: string;
	topic: string;
	blurb: string;
	/** Optional slug of a post on this site that covers the same ground. */
	post?: string;
};

export const meetup = {
	name: 'AI Systems Weekly',
	tagline: 'One hour, one system, every Saturday.',
	description: [
		'A small weekly call where we take one piece of the modern AI stack and go all the way down to the mechanism. Not a talk, not a demo — we read the paper or the source, and argue about why it is built the way it is.',
		'The format is deliberately plain. I open with fifteen minutes of context, then we walk the actual code or figures together and spend the rest of the hour on questions. Most weeks someone finds a detail that reframes the whole thing, which is the point.',
		'It is open to anyone who has shipped something with an LLM and wants to understand what happens underneath. No slides, no recording, cameras optional.'
	],
	/** 0 = Sunday. Saturday. */
	weekday: 6,
	/** Session start in UTC, 24h. 15:30 UTC = 21:00 IST. */
	utcHour: 15,
	utcMinute: 30,
	localTime: '9:00 PM IST',
	utcTime: '15:30 UTC',
	durationMinutes: 60,
	where: 'Google Meet',
	/**
	 * Set this to the standing meeting link once it exists. While empty the page
	 * falls back to an email CTA rather than rendering a dead link.
	 */
	joinHref: '',
	audience: 'Engineers building on LLMs who want the layer below the API.'
};

export const upcomingSessions: Session[] = [
	{
		date: '2026-08-01',
		topic: 'Continuous batching, end to end',
		blurb:
			'The Orca paper introduced iteration-level scheduling. We read it, then open the vLLM scheduler and find the loop that actually does it.',
		post: 'the-two-clocks'
	},
	{
		date: '2026-08-08',
		topic: 'RadixAttention and prefix reuse',
		blurb:
			'Why SGLang keeps a radix tree of KV blocks, what an LRU eviction policy over that tree buys you, and where it stops helping.',
		post: 'sglang-architecture'
	},
	{
		date: '2026-08-15',
		topic: 'Speculative decoding in practice',
		blurb:
			'Draft models, Medusa heads and EAGLE. Acceptance rates, the rejection-sampling correctness argument, and why the wins are smaller than the papers suggest.'
	},
	{
		date: '2026-08-22',
		topic: 'Prefill/decode disaggregation',
		blurb:
			'DistServe and Mooncake split the two phases onto separate hardware. We work through the KV-transfer cost that decides whether it is worth it.'
	},
	{
		date: '2026-08-29',
		topic: 'Evaluating agents without labels',
		blurb:
			'Trajectory evals, LLM-as-judge and its failure modes, and building a regression suite for something non-deterministic.'
	}
];

export const pastSessions: Session[] = [
	{
		date: '2026-07-25',
		topic: 'PagedAttention, and what an OS taught the KV cache',
		blurb: 'Virtual memory for attention: block tables, fragmentation, and copy-on-write prefix sharing.',
		post: 'vllm-architecture'
	},
	{
		date: '2026-07-18',
		topic: 'Anatomy of an agentic harness',
		blurb: 'The loop around the model, and why most agent quality lives there rather than in the weights.',
		post: 'the-agentic-harness'
	},
	{
		date: '2026-07-11',
		topic: 'MCP as a tool protocol',
		blurb: 'What a shared tool protocol actually fixes, and the parts of the problem it leaves to you.'
	},
	{
		date: '2026-07-04',
		topic: 'FlashAttention from the memory hierarchy up',
		blurb: 'Tiling into SRAM, online softmax, and never materialising the N×N matrix.'
	},
	{
		date: '2026-06-27',
		topic: 'Context engineering',
		blurb: 'Compaction, sub-agents and what to do when the useful context outgrows the window.',
		post: 'context-engineering-for-agents'
	}
];

/**
 * The next occurrence of the standing slot, so the page stays correct without
 * anyone editing a date. Returns a UTC-based Date.
 */
export function nextSession(from: Date = new Date()): Date {
	const next = new Date(
		Date.UTC(
			from.getUTCFullYear(),
			from.getUTCMonth(),
			from.getUTCDate(),
			meetup.utcHour,
			meetup.utcMinute,
			0,
			0
		)
	);

	let delta = (meetup.weekday - next.getUTCDay() + 7) % 7;
	if (delta === 0 && next.getTime() <= from.getTime()) {
		delta = 7;
	}

	next.setUTCDate(next.getUTCDate() + delta);
	return next;
}
