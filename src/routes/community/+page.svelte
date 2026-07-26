<script lang="ts">
	import { Seo } from '$lib/components/site';
	import { call, nextCall, updates } from '$lib/community';
	import { formatDate, formatDayMonth } from '$lib/utils';

	const next = nextCall();
	const nextDate = next.toISOString().slice(0, 10);
</script>

<Seo
	title="Community"
	description={`${call.name}. ${call.cadence} at ${call.localTime}, plus talks and conference notes from the Kubeflow community.`}
/>

<div class="space-y-14">
	<header class="max-w-prose space-y-4">
		<h1 class="text-2xl text-foreground">Community</h1>
		<p class="text-ink-50">Open-source work on Kubeflow, and the call that goes with it.</p>
	</header>

	<section class="space-y-6">
		<h2 class="font-mono text-2xs uppercase tracking-label text-ink-30">The bi-weekly call</h2>

		<div class="max-w-prose space-y-4 text-ink-70">
			{#each call.description as paragraph}
				<p>{paragraph}</p>
			{/each}
		</div>

		<dl class="max-w-prose space-y-3 text-sm">
			<div class="flex items-baseline gap-3">
				<dt class="w-24 flex-shrink-0 text-ink-30">Next</dt>
				<dd class="tnum text-foreground">Saturday {formatDate(nextDate, 'long')}</dd>
			</div>
			<div class="flex items-baseline gap-3">
				<dt class="w-24 flex-shrink-0 text-ink-30">Time</dt>
				<dd class="tnum text-ink-70">{call.localTime} · {call.utcTime}</dd>
			</div>
			<div class="flex items-baseline gap-3">
				<dt class="w-24 flex-shrink-0 text-ink-30">Cadence</dt>
				<dd class="text-ink-70">{call.cadence}, since 13 June 2026</dd>
			</div>
			<div class="flex items-baseline gap-3">
				<dt class="w-24 flex-shrink-0 text-ink-30">Where</dt>
				<dd class="text-ink-70">{call.where}</dd>
			</div>
			<div class="flex items-baseline gap-3">
				<dt class="w-24 flex-shrink-0 text-ink-30">Project</dt>
				<dd>
					<a href={call.repoHref} class="link text-ink-70" target="_blank" rel="noreferrer">
						{call.repo}
					</a>
				</dd>
			</div>
			<div class="flex items-baseline gap-3">
				<dt class="w-24 flex-shrink-0 text-ink-30">Who</dt>
				<dd class="text-ink-70">{call.audience}</dd>
			</div>
			<div class="flex items-baseline gap-3">
				<dt class="w-24 flex-shrink-0 text-ink-30">Join</dt>
				<dd>
					<a href={call.joinHref} class="link text-foreground" target="_blank" rel="noreferrer">
						Standing Zoom link
					</a>
				</dd>
			</div>
		</dl>

		<p class="max-w-prose text-sm text-ink-50">
			Kubeflow
			<a href={call.announcementHref} class="link" target="_blank" rel="noreferrer">
				announced the series
			</a>
			in June 2026; that post carries the calendar invite and the agenda doc.
		</p>
	</section>

	<section class="space-y-5">
		<h2 class="font-mono text-2xs uppercase tracking-label text-ink-30">Elsewhere</h2>
		<ul class="list-none space-y-5">
			{#each updates as update (update.href)}
				<li class="max-w-prose space-y-1">
					<div class="flex items-baseline justify-between gap-4">
						<h3>
							<a href={update.href} class="link-quiet text-foreground" target="_blank" rel="noreferrer">
								{update.title}
							</a>
						</h3>
						<span class="tnum flex-shrink-0 text-sm text-ink-30">
							{formatDayMonth(update.date)}
						</span>
					</div>
					<p class="text-sm text-ink-50">{update.blurb}</p>
				</li>
			{/each}
		</ul>
	</section>
</div>
