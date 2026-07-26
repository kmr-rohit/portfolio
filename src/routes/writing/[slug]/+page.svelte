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

<article class="space-y-10">
	<header class="max-w-prose space-y-4">
		<div class="tnum flex flex-wrap items-baseline gap-x-3 text-sm text-ink-50">
			<time datetime={meta.date}>{formatDate(meta.date, 'long')}</time>
			{#if meta.readTime}
				<span class="text-ink-30">{meta.readTime} min read</span>
			{/if}
		</div>
		<h1 class="text-2xl leading-snug text-foreground md:text-3xl">{meta.title}</h1>
		{#if meta.description}
			<p class="text-ink-50">{meta.description}</p>
		{/if}
		{#if meta.tags?.length}
			<ul class="flex list-none flex-wrap gap-x-3 gap-y-1 font-mono text-2xs uppercase tracking-label text-ink-30">
				{#each meta.tags as tag (tag)}
					<li>{tag}</li>
				{/each}
			</ul>
		{/if}
	</header>

	<hr class="rule" />

	<div class="mdsvex" id="mdsvex">
		<svelte:component this={content} />
	</div>

	<hr class="rule" />

	<nav class="flex flex-col gap-4 text-sm md:flex-row md:justify-between">
		<div class="max-w-xs space-y-1">
			{#if older}
				<p class="font-mono text-2xs uppercase tracking-label text-ink-30">Older</p>
				<a href="/writing/{older.slug}" class="link-quiet text-ink-70">{older.title}</a>
			{/if}
		</div>
		<div class="max-w-xs space-y-1 md:text-right">
			{#if newer}
				<p class="font-mono text-2xs uppercase tracking-label text-ink-30">Newer</p>
				<a href="/writing/{newer.slug}" class="link-quiet text-ink-70">{newer.title}</a>
			{/if}
		</div>
	</nav>

	{#if commentsEnabled}
		<div id="comments" class="pt-4">
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
