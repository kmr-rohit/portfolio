<script lang="ts">
	import { site, socials } from '$lib/config';

	const year = new Date().getFullYear();
</script>

<footer class="mx-auto w-full max-w-screen-md px-5 pb-10">
	<hr class="rule mb-6" />
	<div class="flex flex-wrap items-baseline justify-between gap-x-6 gap-y-2 text-sm text-ink-50">
		<p>&copy; {year} {site.name}</p>
		<div class="flex flex-wrap items-baseline gap-5">
			{#each socials as social (social.href)}
				<a
					href={social.href}
					class="link-quiet"
					target={social.href.startsWith('http') ? '_blank' : undefined}
					rel={social.href.startsWith('http') ? 'noreferrer' : undefined}
				>
					{social.display}
				</a>
			{/each}
			<a href="/rss.xml" class="link-quiet">RSS</a>
		</div>
	</div>
</footer>
