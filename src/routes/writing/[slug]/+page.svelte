<script lang="ts">
	import { Seo } from '$lib/components/site';
	import { Giscus } from '$lib/components/site/gicsus_';
	import { commentsEnabled, giscus, site } from '$lib/config';
	import { theme } from '$lib/stores';
	import { formatDate } from '$lib/utils';
	import { onMount } from 'svelte';

	export let data;

	$: ({ content, meta, newer, older } = data);

	let storedTheme: string | undefined;

	onMount(() => {
		storedTheme = localStorage.getItem('mode')?.replace(/^"(.*)"$/, '$1');
	});

	$: tags = (meta.tags ?? []).filter(Boolean);
</script>

<Seo
	title={meta.title}
	description={meta.description}
	image={meta.image}
	type="article"
	publishedAt={meta.date}
/>

<article class="essay">
	<a href="/writing" class="back">← Writing</a>

	<header class="essay-head">
		{#if tags.length}
			<p class="essay-kicker">{tags.join(' · ')}</p>
		{/if}
		<h1>{meta.title}</h1>
		<p class="essay-meta">
			<time datetime={meta.date}>{formatDate(meta.date, 'long')}</time>
			{#if meta.readTime}
				<span class="essay-dot" aria-hidden="true">·</span>
				<span>{meta.readTime} min read</span>
			{/if}
			<span class="essay-dot" aria-hidden="true">·</span>
			<span>{site.name}</span>
		</p>
		{#if meta.description}
			<p class="essay-standfirst">{meta.description}</p>
		{/if}
	</header>

	<div class="essay-rule" aria-hidden="true"></div>

	<div class="mdsvex essay-body" id="mdsvex">
		<svelte:component this={content} />
	</div>

	<footer class="essay-foot">
		<p class="essay-foot-note">
			Thanks for reading. If something here is wrong or unclear, open an issue on the
			<a href="https://github.com/kmr-rohit/portfolio" class="bio-link" target="_blank" rel="noreferrer"
				>site repo</a
			>
			or write me.
		</p>
	</footer>

	<nav class="pager">
		<div class="max-w-xs space-y-1">
			{#if older}
				<p class="section-label" style="margin-bottom: 4px">Older</p>
				<a href="/writing/{older.slug}">{older.title}</a>
			{/if}
		</div>
		<div class="max-w-xs space-y-1 text-right">
			{#if newer}
				<p class="section-label" style="margin-bottom: 4px">Newer</p>
				<a href="/writing/{newer.slug}">{newer.title}</a>
			{/if}
		</div>
	</nav>

	{#if commentsEnabled}
		<div id="comments" class="pt-10">
			<Giscus
				repo={giscus.repo}
				repoId={giscus.repoId}
				category={giscus.category}
				categoryId={giscus.categoryId}
				mapping="pathname"
				strict="0"
				reactionsEnabled="1"
				emitMetadata="0"
				inputPosition="top"
				theme={$theme ? $theme : storedTheme}
				lang="en"
			/>
		</div>
	{/if}
</article>
