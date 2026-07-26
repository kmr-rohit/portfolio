<script lang="ts">
	import { PostList, Seo } from '$lib/components/site';

	export let data;
</script>

<Seo
	title="Writing"
	description="Notes on LLM serving, agent design and the systems underneath — vLLM, SGLang, agentic harnesses, retrieval and evaluation."
/>

<div class="space-y-12">
	<header class="max-w-prose space-y-4">
		<h1 class="text-2xl text-foreground">Writing</h1>
		<p class="text-ink-70">
			Mostly long-form notes on how LLM systems actually work underneath the API — serving engines,
			agent harnesses, retrieval and the parts of evaluation nobody enjoys. I write these to check my
			own understanding, so they tend to go one level deeper than they need to.
		</p>
	</header>

	<PostList posts={data.posts} />
</div>
