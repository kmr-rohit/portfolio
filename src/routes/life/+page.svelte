<script lang="ts">
	import { Seo } from '$lib/components/site';
	import Spotlight from '$lib/components/site/spotlight.svelte';
	import { lifeImages } from '$lib/life';

	/** Deterministic layout salt so SSR and client agree. */
	function layout(i: number) {
		const rot = ((i * 37) % 11) - 5; // -5..5 deg
		const z = (i % 7) + 1;
		const shift = ((i * 13) % 17) - 8; // px nudge
		return { rot, z, shift };
	}
</script>

<Seo
	title="Life"
	description="Food and landscapes — the quieter half of the notebook."
/>

<Spotlight />

{#if lifeImages.length === 0}
	<div class="life-empty">
		<p class="section-label" style="margin-bottom: 12px">Life</p>
		<p>Photos coming soon.</p>
	</div>
{:else}
	<div class="life" aria-label="Photo collage">
		{#each lifeImages as image, i (image.src)}
			{@const { rot, z, shift } = layout(i)}
			<figure
				class="life-card"
				style="--rot: {rot}deg; --z: {z}; --shift: {shift}px; --delay: {(i % 12) * 40}ms"
			>
				<img src={image.src} alt={image.alt} loading={i < 8 ? 'eager' : 'lazy'} />
				{#if image.caption}
					<figcaption>{image.caption}</figcaption>
				{/if}
			</figure>
		{/each}
	</div>
{/if}
