<script lang="ts">
	import { Seo } from '$lib/components/site';
	import { site } from '$lib/config';
	import { meetup, nextSession, pastSessions, upcomingSessions } from '$lib/meetup';
	import { formatDate, formatDayMonth } from '$lib/utils';

	const next = nextSession();
	const mailto = `mailto:${site.email}?subject=${encodeURIComponent(`${meetup.name} — invite`)}`;
</script>

<Seo
	title={meetup.name}
	description={`${meetup.tagline} A weekly hour on one piece of the AI stack — serving engines, agent harnesses, retrieval — read down to the mechanism.`}
/>

<div class="space-y-14">
	<header class="max-w-prose space-y-4">
		<h1 class="text-2xl text-foreground">{meetup.name}</h1>
		<p class="text-ink-50">{meetup.tagline}</p>
		<div class="space-y-4 text-ink-70">
			{#each meetup.description as paragraph}
				<p>{paragraph}</p>
			{/each}
		</div>
	</header>

	<section class="space-y-5">
		<h2 class="font-mono text-2xs uppercase tracking-label text-ink-30">Details</h2>
		<dl class="max-w-prose space-y-3 text-sm">
			<div class="flex items-baseline gap-3">
				<dt class="w-24 flex-shrink-0 text-ink-30">Next</dt>
				<dd class="tnum text-foreground">
					Saturday {formatDate(next.toISOString().slice(0, 10), 'long')}
				</dd>
			</div>
			<div class="flex items-baseline gap-3">
				<dt class="w-24 flex-shrink-0 text-ink-30">Time</dt>
				<dd class="tnum text-ink-70">
					{meetup.localTime} · {meetup.utcTime} · {meetup.durationMinutes} minutes
				</dd>
			</div>
			<div class="flex items-baseline gap-3">
				<dt class="w-24 flex-shrink-0 text-ink-30">Cadence</dt>
				<dd class="text-ink-70">Every Saturday</dd>
			</div>
			<div class="flex items-baseline gap-3">
				<dt class="w-24 flex-shrink-0 text-ink-30">Where</dt>
				<dd class="text-ink-70">{meetup.where}</dd>
			</div>
			<div class="flex items-baseline gap-3">
				<dt class="w-24 flex-shrink-0 text-ink-30">Who</dt>
				<dd class="text-ink-70">{meetup.audience}</dd>
			</div>
			<div class="flex items-baseline gap-3">
				<dt class="w-24 flex-shrink-0 text-ink-30">Join</dt>
				<dd>
					{#if meetup.joinHref}
						<a href={meetup.joinHref} class="link text-foreground" target="_blank" rel="noreferrer">
							Add to calendar
						</a>
					{:else}
						<a href={mailto} class="link text-foreground">Email me for the invite</a>
					{/if}
				</dd>
			</div>
		</dl>
	</section>

	<section class="space-y-5">
		<h2 class="font-mono text-2xs uppercase tracking-label text-ink-30">Coming up</h2>
		<ul class="list-none space-y-5">
			{#each upcomingSessions as session (session.date)}
				<li class="max-w-prose space-y-1">
					<div class="flex items-baseline justify-between gap-4">
						<h3 class="text-foreground">
							{#if session.post}
								<a href="/writing/{session.post}" class="link-quiet">{session.topic}</a>
							{:else}
								{session.topic}
							{/if}
						</h3>
						<span class="tnum flex-shrink-0 text-sm text-ink-30">
							{formatDayMonth(session.date)}
						</span>
					</div>
					<p class="text-sm text-ink-50">{session.blurb}</p>
				</li>
			{/each}
		</ul>
	</section>

	<section class="space-y-5">
		<h2 class="font-mono text-2xs uppercase tracking-label text-ink-30">Past sessions</h2>
		<ul class="list-none space-y-5">
			{#each pastSessions as session (session.date)}
				<li class="max-w-prose space-y-1">
					<div class="flex items-baseline justify-between gap-4">
						<h3 class="text-ink-70">
							{#if session.post}
								<a href="/writing/{session.post}" class="link-quiet">{session.topic}</a>
							{:else}
								{session.topic}
							{/if}
						</h3>
						<span class="tnum flex-shrink-0 text-sm text-ink-30">
							{formatDayMonth(session.date)}
						</span>
					</div>
					<p class="text-sm text-ink-50">{session.blurb}</p>
				</li>
			{/each}
		</ul>
	</section>

	<section class="max-w-prose space-y-3">
		<h2 class="font-mono text-2xs uppercase tracking-label text-ink-30">Propose a topic</h2>
		<p class="text-ink-70">
			If there is a system you want to pull apart — a paper, an engine, a piece of infrastructure
			you keep having to trust without understanding —
			<a href={mailto} class="link">send it to me</a> and I will slot it in.
		</p>
	</section>
</div>
