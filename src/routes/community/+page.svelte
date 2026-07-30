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

<header class="proj-head">
	<h1>Community</h1>
	<p class="lede">Open-source work on Kubeflow, and the call that goes with it.</p>
</header>

<section>
	<h2 class="section-label">The bi-weekly call</h2>

	<div class="proj-body mb-8">
		{#each call.description as paragraph}
			<p>{paragraph}</p>
		{/each}
	</div>

	<dl class="max-w-[620px] space-y-3 text-[14px]">
		<div class="flex items-baseline gap-3">
			<dt class="w-24 flex-shrink-0 text-[12px]" style="color: var(--ink-soft); letter-spacing: var(--track-nav)">
				Next
			</dt>
			<dd class="tnum" style="color: var(--ink)">Saturday {formatDate(nextDate, 'long')}</dd>
		</div>
		<div class="flex items-baseline gap-3">
			<dt class="w-24 flex-shrink-0 text-[12px]" style="color: var(--ink-soft); letter-spacing: var(--track-nav)">
				Time
			</dt>
			<dd class="tnum" style="color: rgba(29, 29, 31, 0.82)">{call.localTime} · {call.utcTime}</dd>
		</div>
		<div class="flex items-baseline gap-3">
			<dt class="w-24 flex-shrink-0 text-[12px]" style="color: var(--ink-soft); letter-spacing: var(--track-nav)">
				Cadence
			</dt>
			<dd style="color: rgba(29, 29, 31, 0.82)">{call.cadence}, since 13 June 2026</dd>
		</div>
		<div class="flex items-baseline gap-3">
			<dt class="w-24 flex-shrink-0 text-[12px]" style="color: var(--ink-soft); letter-spacing: var(--track-nav)">
				Where
			</dt>
			<dd style="color: rgba(29, 29, 31, 0.82)">{call.where}</dd>
		</div>
		<div class="flex items-baseline gap-3">
			<dt class="w-24 flex-shrink-0 text-[12px]" style="color: var(--ink-soft); letter-spacing: var(--track-nav)">
				Project
			</dt>
			<dd>
				<a href={call.repoHref} class="bio-link" target="_blank" rel="noreferrer">{call.repo}</a>
			</dd>
		</div>
		<div class="flex items-baseline gap-3">
			<dt class="w-24 flex-shrink-0 text-[12px]" style="color: var(--ink-soft); letter-spacing: var(--track-nav)">
				Who
			</dt>
			<dd style="color: rgba(29, 29, 31, 0.82)">{call.audience}</dd>
		</div>
		<div class="flex items-baseline gap-3">
			<dt class="w-24 flex-shrink-0 text-[12px]" style="color: var(--ink-soft); letter-spacing: var(--track-nav)">
				Join
			</dt>
			<dd>
				<a href={call.joinHref} class="bio-link" target="_blank" rel="noreferrer">Standing Zoom link</a>
			</dd>
		</div>
	</dl>

	<p class="proj-body mt-8" style="font-size: 14px; color: var(--ink-soft); margin-bottom: 0">
		Kubeflow
		<a href={call.announcementHref} class="bio-link" target="_blank" rel="noreferrer">
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
				<span class="row-thumb is-text" aria-hidden="true">
					<p class="preview-title">{update.title}</p>
					<p class="preview-body">{update.blurb}</p>
				</span>
			</a>
		{/each}
	</div>
</section>
