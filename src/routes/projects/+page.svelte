<script lang="ts">
	import { Seo } from '$lib/components/site';
	import { projects } from '$lib/projects';
	import { reveal } from '$lib/actions/reveal';

	const work = projects.filter((project) => project.group === 'work');
	const lab = projects.filter((project) => project.group === 'lab');
</script>

<Seo
	title="Projects"
	description="Agentic RAG for Kubeflow, an agentic mock-interview platform, voice agents and a node-based LLM workflow runtime."
/>

<div class="space-y-14">
	<header use:reveal class="max-w-prose space-y-4">
		<h1 class="text-2xl text-foreground">Projects</h1>
		<p class="text-ink-70">
			The through-line is agents that have to survive contact with a real system — a Kubernetes
			cluster, a live interview, someone's supply chain. Everything below was built end to end
			rather than as a notebook demo.
		</p>
	</header>

	<section class="space-y-10">
		{#each work as project, i (project.title)}
			<article use:reveal={{ delay: Math.min(i * 40, 160) }} class="max-w-prose space-y-3">
				<div class="flex items-baseline justify-between gap-4">
					<h2 class="text-lg text-foreground">{project.title}</h2>
					<span class="tnum flex-shrink-0 text-sm text-ink-30">{project.year}</span>
				</div>

				<p class="text-ink-70">{project.summary}</p>

				{#if project.detail}
					<div class="space-y-3 text-sm text-ink-50">
						{#each project.detail as paragraph}
							<p>{paragraph}</p>
						{/each}
					</div>
				{/if}

				<p class="font-mono text-2xs uppercase tracking-label text-ink-30">
					{project.stack.join(' · ')}
				</p>

				{#if project.links?.length}
					<div class="flex flex-wrap gap-x-5 gap-y-1 text-sm">
						{#each project.links as link (link.href)}
							<a href={link.href} class="link text-ink-70" target="_blank" rel="noreferrer">
								{link.label}
							</a>
						{/each}
					</div>
				{/if}
			</article>
		{/each}
	</section>

	<section use:reveal class="space-y-6">
		<h2 class="font-mono text-2xs uppercase tracking-label text-ink-30">Smaller things</h2>
		<div class="space-y-6">
			{#each lab as project (project.title)}
				<article class="row-hover max-w-prose space-y-2">
					<div class="flex items-baseline justify-between gap-4">
						<h3 class="text-foreground">{project.title}</h3>
						<span class="row-meta tnum flex-shrink-0 text-sm text-ink-30">{project.year}</span>
					</div>
					<p class="text-sm text-ink-50">{project.summary}</p>
					{#if project.links?.length}
						<div class="flex flex-wrap gap-x-5 gap-y-1 text-sm">
							{#each project.links as link (link.href)}
								<a href={link.href} class="link text-ink-70" target="_blank" rel="noreferrer">
									{link.label}
								</a>
							{/each}
						</div>
					{/if}
				</article>
			{/each}
		</div>
	</section>
</div>
