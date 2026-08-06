<script lang="ts">
	import { Seo } from '$lib/components/site';
	import { call, nextCall, updates } from '$lib/community';
	import {
		contributions,
		opensourceIntro,
		opensourceRepos
	} from '$lib/opensource';
	import { formatDate, formatDayMonth, getYear } from '$lib/utils';

	const next = nextCall();
	const nextDate = next.toISOString().slice(0, 10);
</script>

<Seo
	title="Open Source"
	description="Kubeflow open-source work — Terraform/Helm on OCI, docs-agent CI/CD, and the bi-weekly community call."
/>

<header class="proj-head">
	<h1>{opensourceIntro.title}</h1>
	<p class="lede">{opensourceIntro.lede}</p>
	<p class="os-github">
		<a href={opensourceIntro.github} class="bio-link" target="_blank" rel="noreferrer"
			>github.com/kmr-rohit</a
		>
	</p>
</header>

<section>
	<h2 class="section-label">Repos</h2>
	<ul class="os-repos">
		{#each opensourceRepos as repo (repo.href)}
			<li>
				<a href={repo.href} class="bio-link" target="_blank" rel="noreferrer">{repo.name}</a>
				<span>{repo.oneLiner}</span>
			</li>
		{/each}
	</ul>
</section>

<section>
	<h2 class="section-label">Selected contributions</h2>
	<div class="os-contribs">
		{#each contributions as item (item.href)}
			<article class="os-card">
				<p class="os-card-meta">
					<a href={item.repoHref} class="bio-link" target="_blank" rel="noreferrer">{item.repo}</a>
					· {item.status}
				</p>
				<h3>
					<a href={item.href} target="_blank" rel="noreferrer">{item.title}</a>
				</h3>
				<p class="os-card-blurb">{item.blurb}</p>
				<p class="os-tags">{item.tags.join(' · ')}</p>
			</article>
		{/each}
	</div>
</section>

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
			<dd class="tnum" style="color: var(--ink-soft)">{call.localTime} · {call.utcTime}</dd>
		</div>
		<div class="flex items-baseline gap-3">
			<dt class="w-24 flex-shrink-0 text-[12px]" style="color: var(--ink-soft); letter-spacing: var(--track-nav)">
				Where
			</dt>
			<dd style="color: var(--ink-soft)">{call.where}</dd>
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
</section>

<section>
	<h2 class="section-label">Talks & notes</h2>
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

<style>
	.os-github {
		margin-top: 0.75rem;
		font-size: 14px;
		color: var(--ink-soft);
	}

	.os-repos {
		list-style: none;
		padding: 0;
		margin: 0 0 0.5rem;
		display: flex;
		flex-direction: column;
		gap: 0.85rem;
		max-width: 40rem;
	}

	.os-repos li {
		display: flex;
		flex-direction: column;
		gap: 0.2rem;
		font-size: 14px;
		line-height: 1.55;
		color: var(--ink-soft);
	}

	.os-contribs {
		display: flex;
		flex-direction: column;
		gap: 1.35rem;
		margin-bottom: 0.5rem;
	}

	.os-card {
		max-width: 44rem;
		padding-bottom: 1.25rem;
		border-bottom: 1px dashed color-mix(in srgb, var(--ink) 12%, transparent);
	}

	.os-card:last-child {
		border-bottom: none;
		padding-bottom: 0;
	}

	.os-card-meta {
		font-family: 'Geist Mono', ui-monospace, monospace;
		font-size: 11px;
		letter-spacing: 0.06em;
		color: var(--ink-soft);
		margin-bottom: 0.35rem;
	}

	.os-card h3 {
		font-size: clamp(16px, 2vw, 18px);
		letter-spacing: 0.01em;
		margin: 0 0 0.45rem;
	}

	.os-card h3 a {
		color: var(--ink);
		text-decoration: none;
	}

	.os-card h3 a:hover {
		text-decoration: underline;
		text-underline-offset: 3px;
	}

	.os-card-blurb {
		font-size: 14px;
		line-height: 1.65;
		color: var(--ink-soft);
		margin: 0 0 0.55rem;
	}

	.os-tags {
		font-size: 12px;
		letter-spacing: 0.02em;
		color: color-mix(in srgb, var(--ink-soft) 85%, transparent);
		margin: 0;
	}
</style>
