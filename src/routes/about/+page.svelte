<script lang="ts">
	import { Seo } from '$lib/components/site';
	import { socials } from '$lib/config';
	import { call } from '$lib/community';
	import { achievements, education, roles, skills } from '$lib/work';
</script>

<Seo
	title="About"
	description="AI engineer at Oracle and a Google Summer of Code 2026 contributor on Kubeflow Docs Agent, working on agentic systems, retrieval and LLM serving."
/>

<header class="proj-head">
	<h1>About</h1>
	<div class="lede">
		<p>
			I build AI applications — the unglamorous part, mostly. Getting a model to produce something
			impressive once is easy now. Getting a system to produce something correct on the ten
			thousandth call, when the input is malformed and the tool times out and the user changes their
			mind halfway through, is where the engineering is.
		</p>
		<p>
			At Oracle I work inside Fusion SCM Cloud on agentic and retrieval-backed workflows. Outside that
			I work on
			<a href="https://github.com/kubeflow/docs-agent" class="bio-link" target="_blank" rel="noreferrer"
				>kubeflow/docs-agent</a
			>
			through Google Summer of Code 2026, and turn up to the
			<a href="/community" class="bio-link">{call.name}</a> every other Saturday.
		</p>
		<p>
			I'm looking for senior AI engineering work: agent platforms, inference and serving, or retrieval
			at a scale where the naive approach stops working.
		</p>
	</div>
</header>

<section>
	<h2 class="section-label">Experience</h2>
	{#each roles as role (role.title + role.period)}
		<article class="proj-body mb-10" style="margin-bottom: 2.5rem; gap: 0.5rem">
			<div class="flex flex-col gap-x-4 md:flex-row md:items-baseline md:justify-between">
				<h3 style="font-size: clamp(18px, 2vw, 22px); letter-spacing: 0.03em; color: var(--ink)">
					{role.title}
				</h3>
				<span class="tnum text-[13px]" style="color: var(--ink-soft)">{role.period}</span>
			</div>
			<p style="font-size: 13px; color: var(--ink-soft)">
				{#if role.orgHref}
					<a href={role.orgHref} class="bio-link" target="_blank" rel="noreferrer">{role.org}</a>
				{:else}
					{role.org}
				{/if}
				{#if role.location}<span> · {role.location}</span>{/if}
			</p>
			<ul class="list-none" style="padding-left: 0; gap: 0.5em">
				{#each role.points as point}
					<li class="before:mr-2 before:opacity-40 before:content-['—']">{point}</li>
				{/each}
			</ul>
		</article>
	{/each}
</section>

<section>
	<h2 class="section-label">What I work with</h2>
	<dl class="proj-body" style="gap: 1rem; margin-bottom: 0">
		{#each skills as group (group.label)}
			<div>
				<dt style="color: var(--ink)">{group.label}</dt>
				<dd style="font-size: 14px; color: var(--ink-soft)">{group.items.join(' · ')}</dd>
			</div>
		{/each}
	</dl>
</section>

<section>
	<h2 class="section-label">Selected</h2>
	<ul class="proj-body list-none" style="padding-left: 0; gap: 0.5rem; font-size: 14px; margin-bottom: 0">
		{#each achievements as achievement}
			<li class="before:mr-2 before:opacity-40 before:content-['—']">{achievement}</li>
		{/each}
	</ul>
</section>

<section>
	<h2 class="section-label">Education</h2>
	<div class="proj-body" style="gap: 0.25rem; margin-bottom: 0">
		<div class="flex flex-col gap-x-4 md:flex-row md:items-baseline md:justify-between">
			<p style="color: var(--ink)">{education.degree}</p>
			<span class="tnum text-[13px]" style="color: var(--ink-soft)">{education.period}</span>
		</div>
		<p style="font-size: 14px; color: var(--ink-soft)">{education.school}</p>
	</div>
</section>

<section>
	<h2 class="section-label">Elsewhere</h2>
	<ul class="list-none space-y-3 text-[14px]">
		{#each socials as social (social.href)}
			<li class="flex items-baseline gap-3">
				<span class="w-20 flex-shrink-0 text-[12px]" style="color: var(--ink-soft); letter-spacing: var(--track-nav)"
					>{social.display}</span
				>
				<a
					href={social.href}
					class="bio-link"
					target={social.href.startsWith('http') ? '_blank' : undefined}
					rel={social.href.startsWith('http') ? 'noreferrer' : undefined}
				>
					{social.handle}
				</a>
			</li>
		{/each}
	</ul>
</section>
