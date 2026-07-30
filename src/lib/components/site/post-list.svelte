<script lang="ts">
	import type { Post } from '$lib/types';
	import { getYear } from '$lib/utils';

	export let posts: Post[] = [];

	function category(post: Post) {
		const tag = post.tags?.find((t) => t && t.trim());
		if (tag) return tag.toLowerCase();
		if (post.readTime) return `${post.readTime} min`;
		return 'note';
	}
</script>

<div class="rows">
	{#each posts as post (post.slug)}
		<a href="/writing/{post.slug}" class="row">
			<span class="year tnum">{getYear(post.date)}</span>
			<span class="title">{post.title}</span>
			<span class="blurb">{category(post)}</span>

			{#if post.image}
				<span class="row-thumb" aria-hidden="true">
					<img src={post.image} alt="" loading="lazy" />
				</span>
			{:else if post.description}
				<span class="row-thumb is-text" aria-hidden="true">
					<p class="preview-title">{post.title}</p>
					<p class="preview-body">{post.description}</p>
				</span>
			{/if}
		</a>
	{/each}

	{#if posts.length === 0}
		<p class="py-6 text-[13px]" style="color: var(--ink-soft)">Nothing published yet.</p>
	{/if}
</div>
