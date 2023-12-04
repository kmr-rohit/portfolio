<script>
	import { page } from '$app/stores';
	import { MetaTags } from 'svelte-meta-tags';
</script>

{#if $page.url.pathname == '/'}
	<MetaTags
		title="Home | Rohit Kumar"
		description="Personal website and blog"
		openGraph={{
			url: $page.url.href,
			title: 'Rohit Kumar | Home',
			description: 'Personal website and blog',
			images: [
				{
					url: 'https://prabhukirankonda.vercel.app/og.png',
					width: 800,
					height: 600,
					alt: 'Rohit Kumar'
				}
			],
			siteName: 'Rohit Kumar'
		}}
		twitter={{
			handle: '@prabhukirantwt',
			cardType: 'summary_large_image',
			title: 'Rohit Kumar | Home',
			description: 'Personal website and Blog',
			image: 'https://prabhukirankonda.vercel.app/og.png',
			imageAlt: 'Rohit Kumar'
		}}
	/>
{/if}

{#if $page.url.pathname == '/blog'}
	<MetaTags
		title="Blog | Rohit Kumar"
		description="Blog"
		openGraph={{
			url: $page.url.href,
			title: 'Rohit Kumar | Blog',
			description: 'Blog',
			images: [
				{
					url: 'https://prabhukirankonda.vercel.app/og.png',
					width: 800,
					height: 600,
					alt: 'Rohit Kumar'
				}
			],
			siteName: 'Rohit Kumar'
		}}
		twitter={{
			handle: '@prabhukirantwt',
			cardType: 'summary_large_image',
			title: 'Rohit Kumar | Blog',
			description: 'Blog',
			image: 'https://prabhukirankonda.vercel.app/og.png',
			imageAlt: 'Rohit Kumar'
		}}
	/>
{/if}

{#if $page.url.pathname == '/projects'}
	<MetaTags
		title="Projects | Rohit Kumar"
		description="Projects"
		openGraph={{
			url: $page.url.href,
			title: 'Rohit Kumar | Projects',
			description: 'Projects',
			images: [
				{
					url: 'https://prabhukirankonda.vercel.app/og.png',
					width: 800,
					height: 600,
					alt: 'Rohit Kumar'
				}
			],
			siteName: 'Rohit Kumar'
		}}
		twitter={{
			handle: '@prabhukirantwt',
			cardType: 'summary_large_image',
			title: 'Rohit Kumar | Projects',
			description: 'Blog',
			image: 'https://prabhukirankonda.vercel.app/og.png',
			imageAlt: 'Rohit Kumar'
		}}
	/>
{/if}

{#if $page.url.pathname == '/about'}
	<MetaTags
		title="About | Rohit Kumar"
		description="About Me"
		openGraph={{
			url: $page.url.href,
			title: 'Rohit Kumar | About',
			description: 'About Me',
			images: [
				{
					url: 'https://prabhukirankonda.vercel.app/og.png',
					width: 800,
					height: 600,
					alt: 'Rohit Kumar'
				}
			],
			siteName: 'Rohit Kumar'
		}}
		twitter={{
			handle: '@prabhukirantwt',
			cardType: 'summary_large_image',
			title: 'Rohit Kumar | About',
			description: 'About Me',
			image: 'https://prabhukirankonda.vercel.app/og.png',
			imageAlt: 'Rohit Kumar'
		}}
	/>
{/if}
