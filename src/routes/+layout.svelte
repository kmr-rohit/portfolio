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
</script>

<ModeWatcher />

<div class="flex min-h-dvh flex-col">
	<Header />
	<main class="page flex-1 {isHome ? 'home' : ''}">
		<slot />
	</main>
	<Footer />
</div>
