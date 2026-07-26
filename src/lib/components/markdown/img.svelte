<script lang="ts">
	import type { HTMLImgAttributes } from 'svelte/elements';
	import { cn } from '$lib/utils';
	import { dev } from '$app/environment';
	import { localToGithubURL } from '$lib/config';

	let className: string | undefined | null = undefined;
	export { className as class };
	export let src: HTMLImgAttributes['src'] = undefined;
	export let alt: HTMLImgAttributes['alt'] = undefined;

	if (!dev && src?.startsWith('/')) {
		src = localToGithubURL({ src });
	}
</script>

<figure class="my-8">
	<img {src} {alt} loading="lazy" class={cn('w-full rounded', className)} {...$$restProps} />
	{#if alt}
		<figcaption class="mt-3 text-sm text-ink-50">{alt}</figcaption>
	{/if}
</figure>
