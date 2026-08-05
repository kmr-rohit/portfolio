<script lang="ts">
	import { Seo } from '$lib/components/site';
	import {
		channelLabels,
		kindLabels,
		placeholderLegend,
		referralFacts,
		resumeFor,
		templatesFor,
		trackLabels,
		type ReferralKind,
		type ReferralTrack
	} from '$lib/referral';

	const tracks: ReferralTrack[] = ['ai', 'software'];
	const kinds: ReferralKind[] = ['hr', 'alumni', 'random', 'x'];

	let track: ReferralTrack = 'ai';
	let kind: ReferralKind = 'hr';
	let copiedId: string | null = null;
	let copyTimer: ReturnType<typeof setTimeout>;

	$: active = templatesFor(track, kind);
	$: resumeHref = resumeFor(track);
	$: resumeLabel = track === 'software' ? 'Résumé · Software' : 'Résumé · AI';

	async function copyText(id: string, text: string) {
		try {
			await navigator.clipboard.writeText(text);
			copiedId = id;
			clearTimeout(copyTimer);
			copyTimer = setTimeout(() => (copiedId = null), 2000);
		} catch {
			// Clipboard may be unavailable.
		}
	}
</script>

<Seo
	title="Referral drafts"
	description="Private referral and cold-DM templates grounded in the application profile."
	noindex={true}
/>

<header class="ref-head">
	<p class="ref-kicker">Hidden · not in nav · noindex</p>
	<h1>Referral drafts</h1>
	<p class="ref-lede">
		Cold LinkedIn / email / X messages for referrals. Copy is grounded in
		<a href="/profile" class="bio-link">PROFILE.md</a>
		— replace <code>{'{{placeholders}}'}</code> before sending.
	</p>
</header>

<section class="ref-facts" aria-label="Profile facts">
	<h2 class="section-label">Grounding (from profile)</h2>
	<p class="ref-one-liner">{referralFacts.oneLiner}</p>
	<ul class="ref-fact-list">
		{#each track === 'ai' ? referralFacts.highlightsAi : referralFacts.highlightsSwe as item}
			<li>{item}</li>
		{/each}
	</ul>
	<p class="ref-links">
		<a href={referralFacts.links.profile} class="bio-link">Profile</a>
		·
		<a href={resumeHref} class="bio-link">{resumeLabel}</a>
		·
		<a href={referralFacts.links.github} class="bio-link" target="_blank" rel="noreferrer">GitHub</a>
		·
		<a href={referralFacts.links.writing} class="bio-link">Writing</a>
	</p>
</section>

<div class="ref-controls" role="group" aria-label="Template filters">
	<div class="ref-control-block">
		<span class="ref-control-label">Track</span>
		<div class="ref-pills">
			{#each tracks as t}
				<button
					type="button"
					class="ref-pill"
					class:active={track === t}
					aria-pressed={track === t}
					on:click={() => (track = t)}
				>
					{trackLabels[t]}
				</button>
			{/each}
		</div>
	</div>
	<div class="ref-control-block">
		<span class="ref-control-label">Type</span>
		<div class="ref-pills">
			{#each kinds as k}
				<button
					type="button"
					class="ref-pill"
					class:active={kind === k}
					aria-pressed={kind === k}
					on:click={() => (kind = k)}
				>
					{kindLabels[k]}
				</button>
			{/each}
		</div>
	</div>
</div>

<section class="ref-placeholders" aria-label="Placeholders">
	<h2 class="section-label">Placeholders</h2>
	<dl class="ref-token-grid">
		{#each placeholderLegend as row}
			<div>
				<dt><code>{row.token}</code></dt>
				<dd>{row.meaning}</dd>
			</div>
		{/each}
	</dl>
</section>

<section class="ref-list" aria-label="Templates">
	{#each active as tpl (tpl.id)}
		<article class="ref-card">
			<header class="ref-card-head">
				<div>
					<p class="ref-card-meta">
						{channelLabels[tpl.channel]}
						{#if tpl.subject}
							· subject included
						{/if}
					</p>
					<h3>{tpl.label}</h3>
				</div>
				<button
					type="button"
					class="ref-copy"
					on:click={() =>
						copyText(
							tpl.id,
							tpl.subject ? `Subject: ${tpl.subject}\n\n${tpl.body}` : tpl.body
						)}
				>
					{copiedId === tpl.id ? 'Copied' : 'Copy'}
				</button>
			</header>

			{#if tpl.subject}
				<div class="ref-subject">
					<span>Subject</span>
					<pre>{tpl.subject}</pre>
					<button
						type="button"
						class="ref-copy-inline"
						on:click={() => copyText(`${tpl.id}-subject`, tpl.subject ?? '')}
					>
						{copiedId === `${tpl.id}-subject` ? 'Copied' : 'Copy subject'}
					</button>
				</div>
			{/if}

			<pre class="ref-body">{tpl.body}</pre>
			<button
				type="button"
				class="ref-copy-inline"
				on:click={() => copyText(`${tpl.id}-body`, tpl.body)}
			>
				{copiedId === `${tpl.id}-body` ? 'Copied' : 'Copy body'}
			</button>
		</article>
	{/each}
</section>

<style>
	.ref-head {
		margin-bottom: 2.5rem;
	}

	.ref-kicker {
		font-family: 'Geist Mono', ui-monospace, monospace;
		font-size: 11px;
		letter-spacing: 0.12em;
		text-transform: uppercase;
		color: var(--ink-soft);
		margin-bottom: 0.75rem;
	}

	.ref-head h1 {
		font-size: clamp(28px, 4vw, 40px);
		letter-spacing: -0.02em;
		margin-bottom: 0.75rem;
	}

	.ref-lede {
		max-width: 42rem;
		font-size: 15px;
		line-height: 1.7;
		color: var(--ink-soft);
	}

	.ref-lede code {
		font-size: 0.9em;
	}

	.ref-facts {
		margin-bottom: 2rem;
		padding-bottom: 1.75rem;
		border-bottom: 1px dashed color-mix(in srgb, var(--ink) 14%, transparent);
	}

	.ref-one-liner {
		font-size: 15px;
		line-height: 1.65;
		color: var(--ink);
		margin: 0.75rem 0 1rem;
		max-width: 40rem;
	}

	.ref-fact-list {
		list-style: none;
		padding: 0;
		margin: 0 0 1rem;
		display: flex;
		flex-direction: column;
		gap: 0.45rem;
		font-size: 13.5px;
		line-height: 1.55;
		color: var(--ink-soft);
		max-width: 44rem;
	}

	.ref-fact-list li::before {
		content: '—';
		margin-right: 0.5rem;
		opacity: 0.4;
	}

	.ref-links {
		font-size: 13px;
		color: var(--ink-soft);
	}

	.ref-controls {
		display: flex;
		flex-direction: column;
		gap: 1.25rem;
		margin-bottom: 2rem;
	}

	.ref-control-label {
		display: block;
		font-family: 'Geist Mono', ui-monospace, monospace;
		font-size: 11px;
		letter-spacing: 0.12em;
		text-transform: uppercase;
		color: var(--ink-soft);
		margin-bottom: 0.55rem;
	}

	.ref-pills {
		display: flex;
		flex-wrap: wrap;
		gap: 0.45rem;
	}

	.ref-pill {
		appearance: none;
		border: 1px solid color-mix(in srgb, var(--ink) 16%, transparent);
		background: transparent;
		color: var(--ink-soft);
		font-size: 13px;
		letter-spacing: 0.01em;
		padding: 0.4rem 0.75rem;
		border-radius: 2px;
		cursor: pointer;
		transition: color 0.15s ease, border-color 0.15s ease, background 0.15s ease;
	}

	.ref-pill:hover {
		color: var(--ink);
		border-color: color-mix(in srgb, var(--ink) 28%, transparent);
	}

	.ref-pill.active {
		color: var(--ink);
		border-color: color-mix(in srgb, var(--ink) 45%, transparent);
		background: color-mix(in srgb, var(--ink) 5%, transparent);
	}

	.ref-placeholders {
		margin-bottom: 2rem;
	}

	.ref-token-grid {
		display: grid;
		grid-template-columns: repeat(auto-fill, minmax(200px, 1fr));
		gap: 0.65rem 1.25rem;
		margin-top: 0.75rem;
	}

	.ref-token-grid dt code {
		font-size: 12px;
		color: var(--ink);
	}

	.ref-token-grid dd {
		margin: 0.15rem 0 0;
		font-size: 12.5px;
		color: var(--ink-soft);
	}

	.ref-list {
		display: flex;
		flex-direction: column;
		gap: 1.5rem;
		margin-bottom: 3rem;
	}

	.ref-card {
		border: 1px solid color-mix(in srgb, var(--ink) 12%, transparent);
		border-radius: 2px;
		padding: 1.1rem 1.15rem 1rem;
		background: color-mix(in srgb, var(--paper) 92%, var(--ink) 2%);
	}

	.ref-card-head {
		display: flex;
		align-items: flex-start;
		justify-content: space-between;
		gap: 1rem;
		margin-bottom: 0.85rem;
	}

	.ref-card-meta {
		font-family: 'Geist Mono', ui-monospace, monospace;
		font-size: 11px;
		letter-spacing: 0.1em;
		text-transform: uppercase;
		color: var(--ink-soft);
		margin-bottom: 0.25rem;
	}

	.ref-card h3 {
		font-size: 16px;
		letter-spacing: 0.01em;
		color: var(--ink);
		margin: 0;
	}

	.ref-copy {
		appearance: none;
		flex-shrink: 0;
		border: 1px solid color-mix(in srgb, var(--ink) 18%, transparent);
		background: transparent;
		color: var(--ink);
		font-family: 'Geist Mono', ui-monospace, monospace;
		font-size: 11px;
		letter-spacing: 0.1em;
		text-transform: uppercase;
		padding: 0.4rem 0.7rem;
		border-radius: 2px;
		cursor: pointer;
	}

	.ref-copy:hover {
		border-color: color-mix(in srgb, var(--ink) 36%, transparent);
	}

	.ref-subject {
		margin-bottom: 0.75rem;
		padding: 0.65rem 0.75rem;
		border: 1px dashed color-mix(in srgb, var(--ink) 16%, transparent);
		border-radius: 2px;
	}

	.ref-subject > span {
		display: block;
		font-family: 'Geist Mono', ui-monospace, monospace;
		font-size: 10px;
		letter-spacing: 0.12em;
		text-transform: uppercase;
		color: var(--ink-soft);
		margin-bottom: 0.35rem;
	}

	.ref-subject pre,
	.ref-body {
		margin: 0;
		white-space: pre-wrap;
		word-break: break-word;
		font-family: 'Geist Mono', ui-monospace, monospace;
		font-size: 12.5px;
		line-height: 1.65;
		color: var(--ink);
		background: transparent;
		border: none;
		padding: 0;
	}

	.ref-body {
		margin-bottom: 0.65rem;
	}

	.ref-copy-inline {
		appearance: none;
		border: none;
		background: transparent;
		padding: 0;
		font-family: 'Geist Mono', ui-monospace, monospace;
		font-size: 11px;
		letter-spacing: 0.08em;
		text-transform: uppercase;
		color: var(--ink-soft);
		cursor: pointer;
	}

	.ref-copy-inline:hover {
		color: var(--ink);
	}

	@media (max-width: 640px) {
		.ref-card-head {
			flex-direction: column;
			align-items: stretch;
		}

		.ref-copy {
			align-self: flex-start;
		}
	}
</style>
