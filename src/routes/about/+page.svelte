<script lang="ts">
	import { Seo } from '$lib/components/site';
	import { socials } from '$lib/config';
	import { meetup } from '$lib/meetup';
	import { achievements, education, roles, skills } from '$lib/work';
</script>

<Seo
	title="About"
	description="AI engineer at Oracle, Kubeflow maintainer through Google Summer of Code 2026, working on agentic systems, retrieval and LLM serving."
/>

<div class="space-y-14">
	<header class="max-w-prose space-y-4">
		<h1 class="text-2xl text-foreground">About</h1>
		<div class="space-y-4 text-ink-70">
			<p>
				I build AI applications — the unglamorous part, mostly. Getting a model to produce something
				impressive once is easy now. Getting a system to produce something correct on the ten
				thousandth call, when the input is malformed and the tool times out and the user changes
				their mind halfway through, is where the engineering is.
			</p>
			<p>
				At Oracle I work inside Fusion SCM Cloud on agentic and retrieval-backed workflows: a
				part-matching pipeline that blends fuzzy matching with semantic retrieval and a web-search
				fallback, an order-classification agent with rule guardrails and a human-review handoff, and
				RAG flows over planner exceptions and tabular data. These run against real customer data,
				which is a good teacher.
			</p>
			<p>
				Outside that I maintain <a
					href="https://github.com/kubeflow/docs-agent"
					class="link"
					target="_blank"
					rel="noreferrer">kubeflow/docs-agent</a
				>
				through Google Summer of Code 2026, and host
				<a href="/meetup" class="link">{meetup.name}</a> — an hour every Saturday spent reading one
				system down to the mechanism.
			</p>
			<p>
				I'm looking for senior AI engineering work: agent platforms, inference and serving, or
				retrieval at a scale where the naive approach stops working.
			</p>
		</div>
	</header>

	<section class="space-y-8">
		<h2 class="font-mono text-2xs uppercase tracking-label text-ink-30">Experience</h2>
		{#each roles as role (role.title + role.period)}
			<article class="max-w-prose space-y-2">
				<div class="flex flex-col gap-x-4 md:flex-row md:items-baseline md:justify-between">
					<h3 class="text-foreground">{role.title}</h3>
					<span class="tnum flex-shrink-0 text-sm text-ink-30">{role.period}</span>
				</div>
				<p class="text-sm text-ink-50">
					{#if role.orgHref}
						<a href={role.orgHref} class="link" target="_blank" rel="noreferrer">{role.org}</a>
					{:else}
						{role.org}
					{/if}
					{#if role.location}<span class="text-ink-30"> · {role.location}</span>{/if}
				</p>
				<ul class="list-none space-y-2 text-sm text-ink-70">
					{#each role.points as point}
						<li class="before:mr-2 before:text-ink-30 before:content-['—']">{point}</li>
					{/each}
				</ul>
			</article>
		{/each}
	</section>

	<section class="space-y-5">
		<h2 class="font-mono text-2xs uppercase tracking-label text-ink-30">What I work with</h2>
		<dl class="max-w-prose space-y-4">
			{#each skills as group (group.label)}
				<div class="space-y-1">
					<dt class="text-sm text-foreground">{group.label}</dt>
					<dd class="text-sm text-ink-50">{group.items.join(' · ')}</dd>
				</div>
			{/each}
		</dl>
	</section>

	<section class="space-y-5">
		<h2 class="font-mono text-2xs uppercase tracking-label text-ink-30">Selected</h2>
		<ul class="max-w-prose list-none space-y-2 text-sm text-ink-70">
			{#each achievements as achievement}
				<li class="before:mr-2 before:text-ink-30 before:content-['—']">{achievement}</li>
			{/each}
		</ul>
	</section>

	<section class="space-y-5">
		<h2 class="font-mono text-2xs uppercase tracking-label text-ink-30">Education</h2>
		<div class="max-w-prose">
			<div class="flex flex-col gap-x-4 md:flex-row md:items-baseline md:justify-between">
				<p class="text-foreground">{education.degree}</p>
				<span class="tnum flex-shrink-0 text-sm text-ink-30">{education.period}</span>
			</div>
			<p class="text-sm text-ink-50">{education.school}</p>
		</div>
	</section>

	<section class="space-y-5">
		<h2 class="font-mono text-2xs uppercase tracking-label text-ink-30">Elsewhere</h2>
		<ul class="max-w-prose list-none space-y-2 text-sm">
			{#each socials as social (social.href)}
				<li class="flex items-baseline gap-3">
					<span class="w-20 flex-shrink-0 text-ink-30">{social.display}</span>
					<a
						href={social.href}
						class="link text-ink-70"
						target={social.href.startsWith('http') ? '_blank' : undefined}
						rel={social.href.startsWith('http') ? 'noreferrer' : undefined}
					>
						{social.handle}
					</a>
				</li>
			{/each}
		</ul>
	</section>
</div>
