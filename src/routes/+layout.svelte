<script lang="ts">
	import '../app.postcss';
	import { dev } from '$app/environment';
	import { ModeWatcher } from 'mode-watcher';
	import { inject } from '@vercel/analytics';
	import { injectSpeedInsights } from '@vercel/speed-insights/sveltekit';
	import { preparePageTransition } from '$lib/scripts/page-transitions';
	import { Header, Footer } from '$lib/components/site';

	inject({ mode: dev ? 'development' : 'production' });
	injectSpeedInsights();
	preparePageTransition();
</script>

<ModeWatcher />

<div class="flex min-h-dvh flex-col">
	<Header />
	<main class="mx-auto w-full max-w-screen-md flex-1 px-5 pb-24 pt-14 md:pt-20">
		<slot />
	</main>
	<Footer />
</div>
