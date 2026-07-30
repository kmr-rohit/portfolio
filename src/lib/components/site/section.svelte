<script lang="ts">
	/** Small uppercase label that heads each block. */
	export let title: string;
	export let href: string | undefined = undefined;
	export let linkLabel = 'All';
</script>

<section>
	<div class="mb-5 flex items-baseline justify-between gap-4">
		<h2 class="section-label" style="margin-bottom: 0">{title}</h2>
		{#if href}
			<a {href} class="link-quiet text-[13px]" style="letter-spacing: var(--track-nav)">{linkLabel}</a>
		{/if}
	</div>
	<slot />
</section>
