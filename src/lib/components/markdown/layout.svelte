<script context="module">
	import '../markdown/markdown.postcss';
	import {
		pre,
		a,
		h1,
		h2,
		h3,
		h4,
		h5,
		h6,
		hr,
		img,
		p,
		li,
		ol,
		ul,
		blockquote
	} from '$lib/components/markdown';

	export { pre, a, h1, h2, h3, h4, h5, h6, hr, img, p, li, ol, ul, blockquote };
</script>

<script>
	/*
	 * mdsvex spreads frontmatter onto this layout, so every key used in a post's
	 * frontmatter has to be declared here. The page itself renders the header,
	 * so these are accepted and ignored. TypeScript cannot be used in this file.
	 */
	// svelte-ignore unused-export-let
	export let title = '';
	// svelte-ignore unused-export-let
	export let date = '';
	// svelte-ignore unused-export-let
	export let description = '';
	// svelte-ignore unused-export-let
	/** @type {string[]} */
	export let tags = [];
	// svelte-ignore unused-export-let
	export let image = '';
	// svelte-ignore unused-export-let
	export let draft = false;
</script>

<svelte:head>
	<link
		rel="stylesheet"
		href="https://cdn.jsdelivr.net/npm/katex@0.16.9/dist/katex.min.css"
		integrity="sha384-n8MVd4RsNIU0tAv4ct0nTaAbDJwPJzDEaqSD1odI+WdtXRGWt2kTvGFasHpSy3SV"
		crossorigin="anonymous"
	/>
</svelte:head>

<slot />
