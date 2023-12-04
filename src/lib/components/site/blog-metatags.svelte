<script lang="ts">
	import { page } from '$app/stores';
	import type { Post } from '$lib/types';
	import { MetaTags } from 'svelte-meta-tags';

	export let meta: Post;
</script>

<MetaTags
	title={meta.title}
	description={meta.description}
	openGraph={{
		url: $page.url.href,
		title: meta.title,
		description: meta.description,
		images: [
			{
				url: meta.image,
				width: 800,
				height: 600,
				alt: meta.title
			}
		],
		siteName: 'Rohit Kumar'
	}}
	twitter={{
		handle: '@kmrrohit2001',
		cardType: 'summary_large_image',
		title: meta.title,
		description: meta.description,
		image: meta.image,
		imageAlt: meta.title
	}}
/>
