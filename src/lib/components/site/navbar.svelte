<script>
	import { page } from '$app/stores';
	import { routes } from '$lib/config';
	import { cn } from '$lib/utils';
	import { ThemeToggle } from '$lib/components/site';
</script>

<nav
	class="z-50 top-0 left-0 right-0 h-14 md:h-[4.1rem] border-b fixed supports-[backdrop-filter]:bg-background/60 w-full bg-background/95 backdrop-blur hidden md:block"
>
	<div class="flex h-full items-center justify-between p-4">
		<div>
			<a
				href="/"
				class="text-3xl md:text-4xl font-semibold tracking-wider"
				style="font-family: 'Fuggles', cursive;"
			>
				<span
					class="bg-gradient-to-r from-primary to-gray-400 bg-clip-text text-transparent text-5xl md:text-6xl"
					>K</span
				>mrrohit
			</a>
		</div>
		<div class="hidden md:block">
			<div class="flex space-x-4">
				<ul class="flex items-center">
					{#each routes as route}
						<li>
							<a
								href={route.link}
								class="group inline-block relative text-lg tracking-wider hover:bg-accent hover:text-accent-foreground py-1 px-3 rounded-lg"
							>
								<span
									class={cn(
										'absolute rounded-full -bottom-1 left-1/2 transform -translate-x-1/2 w-4 h-[3px] bg-black dark:bg-white opacity-0 group-hover:opacity-100 transition-opacity',
										$page.url.pathname.startsWith(route.link) ? 'opacity-100' : ''
									)}
								/>
								{route.name}
							</a>
						</li>
					{/each}
				</ul>
				<ThemeToggle />
			</div>
		</div>
	</div>
</nav>
