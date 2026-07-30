<script lang="ts">
	import { Seo } from '$lib/components/site';
	import { Giscus } from '$lib/components/site/gicsus_';
	import { commentsEnabled, giscus } from '$lib/config';
	import { theme } from '$lib/stores';
	import { formatDate } from '$lib/utils';
	import { onMount } from 'svelte';

	export let data;

	$: ({ content, meta, newer, older } = data);

	let storedTheme: string | undefined;

	onMount(() => {
		storedTheme = localStorage.getItem('mode')?.replace(/^"(.*)"$/, '$1');
	});
</script>

<Seo
	title={meta.title}
	description={meta.description}
	image={meta.image}
	type="article"
	publishedAt={meta.date}
/>

<article>
	<a href="/writing" class="back-link">← all writing</a>

	<header class="page-head">
		<h1>{meta.title}</h1>
		<p class="meta">
			{formatDate(meta.date, 'long')}
			{#if meta.readTime}
				<span aria-hidden="true"> · </span>{meta.readTime} min read
			{/if}
			{#if meta.tags?.length}
				<span aria-hidden="true"> · </span>{meta.tags.filter(Boolean).join(' · ').toLowerCase()}
			{/if}
		</p>
		{#if meta.description}
			<p class="lede">{meta.description}</p>
		{/if}
	</header>

	<hr class="rule mb-[clamp(32px,5vh,48px)]" />

	<div class="mdsvex" id="mdsvex">
		<svelte:component this={content} />
	</div>

	<nav class="pager">
		<div class="max-w-xs space-y-1">
			{#if older}
				<p class="section-label mb-1">Older</p>
				<a href="/writing/{older.slug}">{older.title}</a>
			{/if}
		</div>
		<div class="max-w-xs space-y-1 text-right">
			{#if newer}
				<p class="section-label mb-1">Newer</p>
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
