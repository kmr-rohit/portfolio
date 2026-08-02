<script lang="ts">
	/**
	 * Inlined Rough.js / Excalidraw-style sketch. We inline (instead of <img>)
	 * so the handwritten face loads and the figure can sit on the page like a
	 * pasted notebook scrap. Sketches are loaded on demand so unused SVGs stay
	 * out of the main bundle.
	 */
	import { cn } from '$lib/utils';

	const loaders = import.meta.glob('$lib/sketches/*.svg', {
		as: 'raw'
	}) as Record<string, () => Promise<string>>;

	export let src: string;
	export let caption: string | undefined = undefined;
	export let alt: string | undefined = undefined;

	let className: string | undefined | null = undefined;
	export { className as class };

	let markup = '';
	let missing = false;

	async function load(path: string) {
		const file = path.split('/').pop();
		if (!file) {
			missing = true;
			markup = '';
			return;
		}
		const key = Object.keys(loaders).find((k) => k.endsWith(`/${file}`));
		if (!key) {
			missing = true;
			markup = '';
			return;
		}
		missing = false;
		markup = await loaders[key]();
	}

	$: load(src);
	$: label = caption ?? alt ?? '';
</script>

{#if missing}
	<p class="text-sm" style="color: var(--ink-soft)">Missing sketch: {src}</p>
{:else if markup}
	<figure class={cn('sketch-figure', className)}>
		<div class="sketch-sheet">
			{@html markup}
		</div>
		{#if label}
			<figcaption>{label}</figcaption>
		{/if}
	</figure>
{/if}
