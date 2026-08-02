<script lang="ts">
	import type { HTMLImgAttributes } from 'svelte/elements';
	import { cn } from '$lib/utils';
	import { dev } from '$app/environment';
	import { localToGithubURL } from '$lib/config';
	import Sketch from './sketch.svelte';

	let className: string | undefined | null = undefined;
	export { className as class };
	export let src: HTMLImgAttributes['src'] = undefined;
	export let alt: HTMLImgAttributes['alt'] = undefined;

	$: isSketch = typeof src === 'string' && src.includes('/sketches/');

	$: resolved = !dev && src?.startsWith('/') && !isSketch ? localToGithubURL({ src }) : src;
</script>

{#if isSketch && src}
	<Sketch {src} caption={alt ?? undefined} class={className} />
{:else}
	<figure class="my-8">
		<img
			src={resolved}
			{alt}
			loading="lazy"
			class={cn('w-full rounded', className)}
			{...$$restProps}
		/>
		{#if alt}
			<figcaption class="mt-3 text-sm text-ink-50">{alt}</figcaption>
		{/if}
	</figure>
{/if}
