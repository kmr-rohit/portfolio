<script lang="ts">
	import { PostList, Section, Seo } from '$lib/components/site';
	import { site, socials } from '$lib/config';
	import { call, nextCall } from '$lib/community';
	import { featuredProjects } from '$lib/projects';
	import { formatDayMonth } from '$lib/utils';
	import portrait from '$lib/assets/profile_picture.jpg';
	import cover from '$lib/assets/kubecon-india-2026.jpg';

	export let data;

	const github = socials.find((s) => s.display === 'GitHub');
	const linkedin = socials.find((s) => s.display === 'LinkedIn');

	$: recent = data.posts.slice(0, 6);
	$: next = nextCall();

	function scrollPastHero() {
		document.getElementById('about')?.scrollIntoView({ behavior: 'smooth' });
	}
</script>

<Seo description={site.description} />

<section class="hero" aria-label="Introduction">
	<p class="hero-kicker">AI engineer / Oracle / GSoC @ Kubeflow</p>
	<div class="hero-name" aria-hidden="true">{site.name}</div>
	<div class="hero-stage">
		<figure class="hero-portrait">
			<img
				src={cover}
				alt={`${site.name} at KubeCon + CloudNativeCon India 2026`}
				width="1152"
				height="1536"
			/>
			<figcaption class="hero-caption">KubeCon · India 2026</figcaption>
		</figure>
	</div>
	<button
		type="button"
		class="hero-down no-highlight"
		on:click={scrollPastHero}
		aria-label="Scroll to about"
	>
		<svg
			width="18"
			height="18"
			viewBox="0 0 24 24"
			fill="none"
			stroke="currentColor"
			stroke-width="1.4"
			aria-hidden="true"
		>
			<path d="M6 9l6 6 6-6" />
			<path d="M6 14l6 6 6-6" opacity="0.55" />
		</svg>
	</button>
</section>

<section id="about" class="about">
	<div class="about-text">
		<div class="bio space-y-4">
			<p>
				I'm Rohit — an AI engineer at <strong>Oracle</strong>, where I build agentic and retrieval
				systems inside Fusion SCM Cloud. Most of my time goes to the layer between a model and a
				product someone will actually trust: tool-calling loops, multi-index retrieval, and the
				evaluation harness that tells you whether last week's prompt change made anything better.
			</p>
			<p>
				Through Google Summer of Code 2026 I work on
				<a
					href="https://github.com/kubeflow/docs-agent"
					class="bio-link"
					target="_blank"
					rel="noreferrer">kubeflow/docs-agent</a
				>, and run a <a href="/community" class="bio-link">community call every other Saturday</a>. I
				write here mostly to force myself to understand things properly.
			</p>
			<p>
				Find me on
				<a href={github?.href} class="bio-link" target="_blank" rel="noreferrer">GitHub</a>
				and
				<a href={linkedin?.href} class="bio-link" target="_blank" rel="noreferrer">LinkedIn</a>.
			</p>
		</div>
	</div>
	<div class="headshot">
		<img src={portrait} alt="" aria-hidden="true" width="264" height="330" loading="lazy" />
	</div>
</section>

<Section title="Writing" href="/writing" linkLabel="all posts">
	<PostList posts={recent} />
</Section>

<Section title="Selected work" href="/projects" linkLabel="all projects">
	<div class="rows">
		{#each featuredProjects as project (project.title)}
			{#if project.links?.[0]}
				<a href={project.links[0].href} class="row" target="_blank" rel="noreferrer">
					<span class="year tnum">{project.year}</span>
					<span class="title">{project.title}</span>
					<span class="blurb">{project.stack[0]?.toLowerCase() ?? 'project'}</span>
					<span class="row-thumb is-text" aria-hidden="true">
						<p class="preview-title">{project.title}</p>
						<p class="preview-body">{project.summary}</p>
					</span>
				</a>
			{:else}
				<div class="row">
					<span class="year tnum">{project.year}</span>
					<span class="title">{project.title}</span>
					<span class="blurb">{project.stack[0]?.toLowerCase() ?? 'project'}</span>
				</div>
			{/if}
		{/each}
	</div>
</Section>

<section>
	<h2 class="section-label">Community</h2>
	<div class="proj-body" style="margin-bottom: 0">
		<p>
			<span style="color: var(--ink)">{call.name}</span>. {call.cadence}, {call.localTime}
			({call.utcTime}). Next one
			<span class="tnum">{formatDayMonth(next)}</span>.
			<a href="/community" class="bio-link">Details</a>.
		</p>
	</div>
</section>
