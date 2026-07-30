<script lang="ts">
	import { Seo } from '$lib/components/site';
	import { call, nextCall, updates } from '$lib/community';
	import { formatDate, formatDayMonth, getYear } from '$lib/utils';

	const next = nextCall();
	const nextDate = next.toISOString().slice(0, 10);
</script>

<Seo
	title="Community"
	description={`${call.name}. ${call.cadence} at ${call.localTime}, plus talks and conference notes from the Kubeflow community.`}
/>

<header class="page-head">
	<h1>Community</h1>
	<p class="lede">Open-source work on Kubeflow, and the call that goes with it.</p>
</header>

<section class="mb-[clamp(64px,11vh,140px)]">
	<h2 class="section-label">The bi-weekly call</h2>

	<div class="prose-block mb-8">
		{#each call.description as paragraph}
			<p>{paragraph}</p>
		{/each}
	</div>

	<dl class="max-w-[620px] space-y-3 text-[14px]">
		<div class="flex items-baseline gap-3">
			<dt class="w-24 flex-shrink-0 track-nav text-[12px]" style="color: var(--ink-soft)">Next</dt>
			<dd class="tnum" style="color: var(--ink)">Saturday {formatDate(nextDate, 'long')}</dd>
		</div>
		<div class="flex items-baseline gap-3">
			<dt class="w-24 flex-shrink-0 track-nav text-[12px]" style="color: var(--ink-soft)">Time</dt>
			<dd class="tnum" style="color: var(--ink-body)">{call.localTime} · {call.utcTime}</dd>
		</div>
		<div class="flex items-baseline gap-3">
			<dt class="w-24 flex-shrink-0 track-nav text-[12px]" style="color: var(--ink-soft)">Cadence</dt>
			<dd style="color: var(--ink-body)">{call.cadence}, since 13 June 2026</dd>
		</div>
		<div class="flex items-baseline gap-3">
			<dt class="w-24 flex-shrink-0 track-nav text-[12px]" style="color: var(--ink-soft)">Where</dt>
			<dd style="color: var(--ink-body)">{call.where}</dd>
		</div>
		<div class="flex items-baseline gap-3">
			<dt class="w-24 flex-shrink-0 track-nav text-[12px]" style="color: var(--ink-soft)">Project</dt>
			<dd>
				<a href={call.repoHref} class="link" target="_blank" rel="noreferrer">{call.repo}</a>
			</dd>
		</div>
		<div class="flex items-baseline gap-3">
			<dt class="w-24 flex-shrink-0 track-nav text-[12px]" style="color: var(--ink-soft)">Who</dt>
			<dd style="color: var(--ink-body)">{call.audience}</dd>
		</div>
		<div class="flex items-baseline gap-3">
			<dt class="w-24 flex-shrink-0 track-nav text-[12px]" style="color: var(--ink-soft)">Join</dt>
			<dd>
				<a href={call.joinHref} class="link" target="_blank" rel="noreferrer">Standing Zoom link</a>
			</dd>
		</div>
	</dl>

	<p class="prose-block mt-8 !text-[14px]" style="color: var(--ink-soft)">
		Kubeflow
		<a href={call.announcementHref} class="link" target="_blank" rel="noreferrer">
			announced the series
		</a>
		in June 2026; that post carries the calendar invite and the agenda doc.
	</p>
</section>

<section>
	<h2 class="section-label">Elsewhere</h2>
	<div class="rows">
		{#each updates as update (update.href)}
			<a href={update.href} class="row" target="_blank" rel="noreferrer">
				<span class="year tnum">{getYear(update.date)}</span>
				<span class="title">{update.title}</span>
				<span class="blurb">{formatDayMonth(update.date).toLowerCase()}</span>
				<span class="row-thumb" aria-hidden="true">
					<p class="preview-title">{update.title}</p>
					<p class="preview-body">{update.blurb}</p>
				</span>
			</a>
		{/each}
	</div>
</section>
