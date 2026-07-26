<script lang="ts">
	/** Small uppercase label that heads each block on the long single-column pages. */
	export let title: string;
	/** Optional link rendered on the right of the label, e.g. "All posts". */
	export let href: string | undefined = undefined;
	export let linkLabel = 'All';
</script>

<section class="space-y-5">
	<div class="flex items-baseline justify-between gap-4">
		<h2 class="font-mono text-2xs uppercase tracking-label text-ink-30">{title}</h2>
		{#if href}
			<a {href} class="link-quiet text-sm text-ink-50">{linkLabel}</a>
		{/if}
	</div>
	<slot />
</section>
