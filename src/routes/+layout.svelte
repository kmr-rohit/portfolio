<script lang="ts">
	import { ModeWatcher } from 'mode-watcher';
	import { inject } from '@vercel/analytics';
	import { injectSpeedInsights } from '@vercel/speed-insights/sveltekit';
	import { dev } from '$app/environment';
	import { page } from '$app/stores';
	import { preparePageTransition } from '$lib/scripts/page-transitions';
	import { Header, Footer } from '$lib/components/site';
	import '../app.postcss';

	inject({ mode: dev ? 'development' : 'production' });
	injectSpeedInsights();
	preparePageTransition();

	$: isHome = $page.url.pathname === '/';
	$: isLife = $page.url.pathname === '/life';
</script>

<ModeWatcher />

<div class="flex min-h-dvh flex-col" class:life-root={isLife}>
	<Header />
	<main class="page flex-1 {isHome ? 'home' : ''} {isLife ? 'dark life-page' : ''}">
		<slot />
	</main>
	{#if !isLife}
		<Footer />
	{/if}
</div>
