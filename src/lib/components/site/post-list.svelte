<script lang="ts">
	import type { Post } from '$lib/types';
	import { formatDayMonth, groupByYear } from '$lib/utils';

	export let posts: Post[] = [];
	/** When false the posts render as one flat list with no year headings. */
	export let grouped = true;

	$: groups = grouped
		? groupByYear(posts)
		: [{ year: 0, entries: posts }];
</script>

<div class="space-y-10">
	{#each groups as group (group.year)}
		<section class="space-y-4">
			{#if grouped}
				<h2 class="text-lg text-ink-30">{group.year}</h2>
			{/if}
			<ul class="flex list-none flex-col gap-4">
				{#each group.entries as post (post.slug)}
					<li class="flex flex-col md:flex-row md:items-baseline md:justify-between md:gap-4">
						<div class="flex items-baseline gap-2">
							<a href="/writing/{post.slug}" class="link-quiet text-foreground">
								{post.title}
							</a>
							{#if post.readTime}
								<span class="tnum flex-shrink-0 text-sm text-ink-30">{post.readTime} min</span>
							{/if}
						</div>
						<span class="tnum flex-shrink-0 text-sm text-ink-50 md:text-right">
							{formatDayMonth(post.date)}
						</span>
					</li>
				{/each}
			</ul>
		</section>
	{/each}

	{#if posts.length === 0}
		<p class="text-ink-50">Nothing published yet.</p>
	{/if}
</div>
