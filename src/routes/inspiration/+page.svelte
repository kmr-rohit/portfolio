<script lang="ts">
	import { Seo } from '$lib/components/site';
	import Spotlight from '$lib/components/site/spotlight.svelte';
	import { inspirationImages } from '$lib/inspiration';

	/** Deterministic-ish layout salt so SSR and client agree. */
	function layout(i: number) {
		const rot = ((i * 37) % 11) - 5; // -5..5 deg
		const z = (i % 7) + 1;
		const shift = ((i * 13) % 17) - 8; // px nudge
		return { rot, z, shift };
	}
</script>

<Seo
	title="Inspiration"
	description="A mood board of food and landscapes — the quieter half of the notebook."
/>

<Spotlight />

{#if inspirationImages.length === 0}
	<div class="inspo-empty">
		<p class="section-label" style="margin-bottom: 12px">Inspiration</p>
		<p>
			Mood board coming soon — food and landscape photos from the Drive folder will land here as a
			dark collage with a cursor spotlight.
		</p>
	</div>
{:else}
	<div class="inspo" aria-label="Inspiration collage">
		{#each inspirationImages as image, i (image.src)}
			{@const { rot, z, shift } = layout(i)}
			<figure
				class="inspo-card"
				style="--rot: {rot}deg; --z: {z}; --shift: {shift}px; --delay: {(i % 12) * 40}ms"
			>
				<img src={image.src} alt={image.alt} loading={i < 6 ? 'eager' : 'lazy'} />
				{#if image.caption}
					<figcaption>{image.caption}</figcaption>
				{/if}
			</figure>
		{/each}
	</div>
{/if}
