<script lang="ts">
	import { page } from '$app/stores';
	import { routes, site } from '$lib/config';
	import ThemeToggle from './theme-toggle.svelte';

	/** `/writing/foo` should still light up the `/writing` nav item. */
	$: isActive = (link: string) =>
		$page.url.pathname === link || $page.url.pathname.startsWith(`${link}/`);
</script>

<header class="mx-auto w-full max-w-screen-md px-5 pt-6 md:pt-10">
	<nav class="flex flex-wrap items-baseline justify-between gap-x-6 gap-y-2">
		<a
			href="/"
			class="link-quiet text-foreground"
			aria-current={$page.url.pathname === '/' ? 'page' : undefined}
		>
			{site.name}
		</a>

		<div class="flex items-baseline gap-5 text-sm">
			{#each routes as route (route.link)}
				<a
					href={route.link}
					class="nav-link {isActive(route.link) ? 'text-foreground' : 'text-ink-50'}"
					aria-current={isActive(route.link) ? 'page' : undefined}
				>
					{route.name}
				</a>
			{/each}
			<ThemeToggle />
		</div>
	</nav>
</header>
