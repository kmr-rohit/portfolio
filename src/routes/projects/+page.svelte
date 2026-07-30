<script lang="ts">
	import { Seo } from '$lib/components/site';
	import { projects } from '$lib/projects';

	const work = projects.filter((project) => project.group === 'work');
	const lab = projects.filter((project) => project.group === 'lab');

	function category(project: (typeof projects)[number]) {
		return (project.stack[0] ?? project.group).toLowerCase();
	}
</script>

<Seo
	title="Projects"
	description="Agentic RAG for Kubeflow, an agentic mock-interview platform, voice agents and a node-based LLM workflow runtime."
/>

<header class="page-head">
	<h1>Projects</h1>
	<p class="lede">
		The through-line is agents that have to survive contact with a real system — a Kubernetes cluster, a
		live interview, someone's supply chain. Everything below was built end to end rather than as a
		notebook demo.
	</p>
</header>

<section class="mb-[clamp(64px,11vh,140px)]">
	<h2 class="section-label">Work</h2>
	<div class="rows">
		{#each work as project (project.title)}
			<a
				href={project.links?.[0]?.href ?? '#'}
				class="row"
				target={project.links?.[0] ? '_blank' : undefined}
				rel={project.links?.[0] ? 'noreferrer' : undefined}
			>
				<span class="year tnum">{project.year}</span>
				<span class="title">{project.title}</span>
				<span class="blurb">{category(project)}</span>
				<span class="row-thumb" aria-hidden="true">
					<p class="preview-title">{project.title}</p>
					<p class="preview-body">{project.summary}</p>
				</span>
			</a>
		{/each}
	</div>
</section>

<section>
	<h2 class="section-label">Smaller things</h2>
	<div class="play-grid">
		{#each lab as project (project.title)}
			<a
				href={project.links?.[0]?.href ?? '/projects'}
				class="play-card"
				target={project.links?.[0] ? '_blank' : undefined}
				rel={project.links?.[0] ? 'noreferrer' : undefined}
			>
				<div class="thumb">
					<div class="thumb-fallback">{project.title.slice(0, 1)}</div>
				</div>
				<div class="cap">
					<span class="t">{project.title}</span>
					<span class="n">{project.year} · {category(project)}</span>
				</div>
			</a>
		{/each}
	</div>
</section>

<!-- Expanded detail for primary work — same page, quieter reading measure -->
<section class="mt-[clamp(64px,11vh,140px)] space-y-[clamp(48px,8vh,96px)]">
	<h2 class="section-label">Notes</h2>
	{#each work as project (project.title)}
		<article>
			<header class="mb-5">
				<h3 class="text-[clamp(22px,3vw,32px)] font-light tracking-display">{project.title}</h3>
				<p class="meta mt-2 text-[13px] track-nav" style="color: var(--ink-soft)">
					{project.year} · {project.stack.join(' · ')}
				</p>
			</header>
			<div class="prose-block">
				<p>{project.summary}</p>
				{#if project.detail}
					{#each project.detail as paragraph}
						<p>{paragraph}</p>
					{/each}
				{/if}
				{#if project.links?.length}
					<p class="flex flex-wrap gap-x-5 gap-y-1">
						{#each project.links as link (link.href)}
							<a href={link.href} class="link" target="_blank" rel="noreferrer">{link.label}</a>
						{/each}
					</p>
				{/if}
			</div>
		</article>
	{/each}
</section>
