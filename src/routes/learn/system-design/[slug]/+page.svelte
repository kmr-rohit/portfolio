<script lang="ts">
  import { Seo } from "$lib/components/site";
  import { site } from "$lib/config";
  import { formatStage } from "$lib/system-design";

  export let data;

  $: ({ content, meta, stage, previous, next } = data);

  const tierLabel: Record<string, string> = {
    core: "Core",
    useful: "Useful",
    breadth: "Breadth",
  };
</script>

<Seo title="{meta.title} · System design" description={meta.summary} type="article" />

<article class="essay sd-note">
  <a href="/learn/system-design" class="back">← System design</a>

  <header class="essay-head">
    <p class="essay-kicker">
      Stage {formatStage(meta.stage)} · {meta.stageName}
    </p>
    <h1>{meta.title}</h1>
    <p class="essay-meta">
      <span>{meta.readTime} min read</span>
      <span class="essay-dot" aria-hidden="true">·</span>
      <span>{tierLabel[meta.tier]}</span>
      {#if meta.diagrams}
        <span class="essay-dot" aria-hidden="true">·</span>
        <span>{meta.diagrams} diagram{meta.diagrams > 1 ? "s" : ""}</span>
      {/if}
      <span class="essay-dot" aria-hidden="true">·</span>
      <span>{site.name}</span>
    </p>

    {#if stage}
      <nav class="sd-stage-strip" aria-label="Notes in this stage">
        {#each stage.concepts as concept (concept.slug)}
          <a
            href="/learn/system-design/{concept.slug}"
            class="tier-{concept.tier}"
            aria-current={concept.slug === meta.slug ? "page" : undefined}
            title={concept.title}
          >
            <span class="sr-only">{concept.title}</span>
          </a>
        {/each}
        <span class="sd-stage-count">
          {stage.concepts.findIndex((concept) => concept.slug === meta.slug) + 1} of {stage.concepts.length} in this stage
        </span>
      </nav>
    {/if}
  </header>

  <div class="essay-rule" aria-hidden="true" />

  <div class="mdsvex essay-body" id="mdsvex">
    <svelte:component this={content} />
  </div>

  <nav class="pager">
    <div class="max-w-xs space-y-1">
      {#if previous}
        <p class="section-label" style="margin-bottom: 4px">Previous</p>
        <a href="/learn/system-design/{previous.slug}">{previous.title}</a>
      {/if}
    </div>
    <div class="max-w-xs space-y-1 text-right">
      {#if next}
        <p class="section-label" style="margin-bottom: 4px">Next</p>
        <a href="/learn/system-design/{next.slug}">{next.title}</a>
      {/if}
    </div>
  </nav>
</article>

<style>
  .sd-stage-strip {
    display: flex;
    align-items: flex-end;
    flex-wrap: wrap;
    gap: 4px;
    margin-top: 22px;
  }

  .sd-stage-strip a {
    width: 12px;
    height: 26px;
    border: 1px solid color-mix(in srgb, var(--ink) 50%, transparent);
    border-radius: 1px 1px 0 0;
    background: var(--surface);
    transition: transform 150ms ease, background 150ms ease;
  }

  .sd-stage-strip a.tier-core {
    background: color-mix(in srgb, var(--accent) 22%, var(--paper));
    border-color: color-mix(in srgb, var(--accent) 70%, var(--ink));
  }

  .sd-stage-strip a.tier-breadth {
    background: transparent;
    border-style: dashed;
  }

  .sd-stage-strip a:hover {
    transform: translateY(-4px);
  }

  .sd-stage-strip a[aria-current="page"] {
    height: 34px;
    background: var(--accent);
    border-color: var(--accent);
  }

  .sd-stage-count {
    margin-left: 10px;
    font-family: "Geist Mono", ui-monospace, monospace;
    font-size: 0.6rem;
    letter-spacing: 0.08em;
    text-transform: uppercase;
    color: var(--ink-soft);
  }

  /* Vault constructs the importer turns into HTML. */

  .sd-note :global(.sd-figure) {
    margin: 2.2rem 0;
    padding: 14px;
    border: 1px solid var(--hairline);
    background: #fff;
    border-radius: 2px;
  }

  .sd-note :global(.sd-figure img) {
    display: block;
    width: 100%;
    height: auto;
    margin: 0;
  }

  /* The drawings are black-on-white; invert them like Excalidraw's dark mode. */
  :global(.dark) .sd-note :global(.sd-figure) {
    background: #121316;
  }

  :global(.dark) .sd-note :global(.sd-figure img) {
    filter: invert(0.93) hue-rotate(180deg);
  }

  .sd-note :global(.sd-callout) {
    margin: 1.8rem 0;
    padding: 14px 18px;
    border-left: 3px solid var(--accent);
    background: color-mix(in srgb, var(--accent) 7%, transparent);
  }

  .sd-note :global(.sd-callout--warning) {
    border-left-color: #d9822b;
    background: color-mix(in srgb, #d9822b 9%, transparent);
  }

  .sd-note :global(.sd-callout--tip) {
    border-left-color: #2f9e6e;
    background: color-mix(in srgb, #2f9e6e 9%, transparent);
  }

  .sd-note :global(.sd-callout > :first-child) {
    margin-top: 0;
  }

  .sd-note :global(.sd-callout > :last-child) {
    margin-bottom: 0;
  }

  .sd-note :global(.sd-callout-title) {
    font-family: var(--font);
    font-weight: 500;
  }

  .sd-note :global(mark) {
    padding: 0 0.15em;
    background: color-mix(in srgb, var(--accent) 22%, transparent);
    color: inherit;
  }

  .sd-note :global(.mdsvex table) {
    display: block;
    max-width: 100%;
    overflow-x: auto;
  }
</style>
