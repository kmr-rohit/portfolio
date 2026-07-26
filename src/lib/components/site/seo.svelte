<script lang="ts">
	import { page } from '$app/stores';
	import { site } from '$lib/config';

	export let title: string | undefined = undefined;
	export let description: string = site.description;
	/** Absolute or root-relative image path for the social card. */
	export let image: string | undefined = undefined;
	export let type: 'website' | 'article' = 'website';
	export let publishedAt: string | undefined = undefined;

	$: fullTitle = title ? `${title} — ${site.name}` : site.name;
	$: canonical = new URL($page.url.pathname, site.url).href;
	$: imageUrl = image
		? new URL(image, site.url).href
		: new URL('/p-favicon.png', site.url).href;
</script>

<svelte:head>
	<title>{fullTitle}</title>
	<meta name="description" content={description} />
	<link rel="canonical" href={canonical} />

	<meta property="og:type" content={type} />
	<meta property="og:site_name" content={site.name} />
	<meta property="og:title" content={fullTitle} />
	<meta property="og:description" content={description} />
	<meta property="og:url" content={canonical} />
	<meta property="og:image" content={imageUrl} />
	{#if publishedAt}
		<meta property="article:published_time" content={publishedAt} />
		<meta property="article:author" content={site.name} />
	{/if}

	<meta name="twitter:card" content="summary_large_image" />
	<meta name="twitter:title" content={fullTitle} />
	<meta name="twitter:description" content={description} />
	<meta name="twitter:image" content={imageUrl} />
</svelte:head>
