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
	$: isInspiration = $page.url.pathname === '/inspiration';
</script>

<ModeWatcher />

<div class="flex min-h-dvh flex-col" class:inspo-root={isInspiration}>
	<Header />
	<main class="page flex-1 {isHome ? 'home' : ''} {isInspiration ? 'dark inspo-page' : ''}">
		<slot />
	</main>
	{#if !isInspiration}
		<Footer />
	{/if}
</div>
