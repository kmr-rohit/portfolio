<script>
	import '../app.postcss';
	import { ModeWatcher } from 'mode-watcher';
	import { onNavigate } from '$app/navigation';
	import { browser } from '$app/environment';
	import { openMobileMenu } from '$lib/stores';
	import { preparePageTransition } from '$lib/scripts/page-transitions';
	import { Navbar, Footer, MetaTags } from '$lib/components/site';
	import { Toaster } from 'svelte-french-toast';
	import MobileNavbar from '$lib/components/site/mobile-navbar.svelte';
	import { injectSpeedInsights } from '@vercel/speed-insights/sveltekit';
	import { dev } from '$app/environment';
	import { inject } from '@vercel/analytics';
 


	onNavigate(() => {
		if ($openMobileMenu) {
			$openMobileMenu = false;
		}
	});
	inject({ mode: dev ? 'development' : 'production' });
	preparePageTransition();
	injectSpeedInsights();
	$: {
		if (browser) {
			if ($openMobileMenu) {
				document.body.classList.add('overflow-hidden');
			} else if (!$openMobileMenu) {
				document.body.classList.remove('overflow-hidden');
			}
		}
	}
</script>

<ModeWatcher />
<MetaTags />
<Toaster />
<Navbar />
<!-- no-highlight (touch highlights in mobile) -->
<div class="no-highlight">
	<MobileNavbar />
</div>
<div class="min-h-screen md:pt-10 flex flex-col">
	<div class="flex-1 mb-16 md:mb-0">
		<slot />
	</div>
	<footer class="border-t hidden md:block">
		<Footer />
	</footer>
</div>
