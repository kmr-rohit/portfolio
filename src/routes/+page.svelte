<script lang="ts">
	import { PostList, Section, Seo } from '$lib/components/site';
	import { site, socials } from '$lib/config';
	import { call, nextCall } from '$lib/community';
	import { featuredProjects } from '$lib/projects';
	import { formatDayMonth } from '$lib/utils';
	import { reveal } from '$lib/actions/reveal';

	export let data;

	const github = socials.find((s) => s.display === 'GitHub');
	const linkedin = socials.find((s) => s.display === 'LinkedIn');

	$: recent = data.posts.slice(0, 6);
	$: next = nextCall();
</script>

<Seo description={site.description} />

<div class="space-y-14 md:space-y-16">
	<section use:reveal={{ delay: 0 }} class="max-w-prose space-y-4 text-ink-70">
		<p>
			I'm Rohit — an AI engineer at
			<span class="text-foreground">Oracle</span>, where I build agentic and retrieval systems
			inside Fusion SCM Cloud.
		</p>
		<p>
			Most of my time goes to the layer between a model and a product someone will actually trust:
			tool-calling loops that recover from their own mistakes, retrieval that knows which index to
			ask, and the evaluation harness that tells you whether last week's prompt change made anything
			better. The model is rarely the hard part.
		</p>
		<p>
			Through Google Summer of Code 2026 I work on
			<a href="https://github.com/kubeflow/docs-agent" class="link" target="_blank" rel="noreferrer">
				kubeflow/docs-agent</a
			>, turning a documentation chatbot into an agentic RAG reference architecture for Kubeflow —
			multi-index retrieval over docs, issues, manifests and source, served through MCP.
		</p>
		<p>
			The project runs a <a href="/community" class="link">community call every other Saturday</a>,
			which is where most of the design argument happens. I write here mostly to force myself to
			understand things properly.
		</p>
		<p>
			You can find me on
			<a href={github?.href} class="link" target="_blank" rel="noreferrer">GitHub</a>
			and
			<a href={linkedin?.href} class="link" target="_blank" rel="noreferrer">LinkedIn</a>.
		</p>
	</section>

	<div use:reveal={{ delay: 60 }}>
		<Section title="Writing" href="/writing" linkLabel="All posts">
			<PostList posts={recent} />
		</Section>
	</div>

	<div use:reveal={{ delay: 100 }}>
		<Section title="Selected work" href="/projects" linkLabel="All projects">
			<ul class="flex list-none flex-col gap-5">
				{#each featuredProjects as project (project.title)}
					<li class="row-hover max-w-prose space-y-1">
						<div class="flex items-baseline justify-between gap-4">
							{#if project.links?.[0]}
								<a
									href={project.links[0].href}
									class="link-quiet text-foreground"
									target="_blank"
									rel="noreferrer">{project.title}</a
								>
							{:else}
								<span class="text-foreground">{project.title}</span>
							{/if}
							<span class="row-meta tnum flex-shrink-0 text-sm text-ink-30">{project.year}</span>
						</div>
						<p class="text-sm text-ink-50">{project.summary}</p>
					</li>
				{/each}
			</ul>
		</Section>
	</div>

	<div use:reveal={{ delay: 140 }}>
		<Section title="Community" href="/community" linkLabel="Details">
			<div class="max-w-prose space-y-2">
				<p class="text-ink-70">
					<span class="text-foreground">{call.name}</span>. {call.cadence}, {call.localTime} ({call.utcTime}).
					Next one <span class="tnum">{formatDayMonth(next)}</span>.
				</p>
				<p class="text-sm text-ink-50">{call.audience}</p>
			</div>
		</Section>
	</div>
</div>
