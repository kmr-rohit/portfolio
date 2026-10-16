<script lang="ts">
  import { Seo } from "$lib/components/site";
  import { formatStage, type Concept } from "$lib/system-design";

  export let data;

  $: ({ stages, totals } = data);
  $: first = stages[0]?.concepts[0];

  let active: Concept | undefined;
  $: shown = active ?? first;

  const tierLabel: Record<string, string> = {
    core: "Core",
    useful: "Useful",
    breadth: "Breadth",
  };

  /** Spine height tracks reading time, so long notes stand taller. */
  const spineHeight = (concept: Concept) =>
    Math.round(Math.min(250, 128 + concept.readTime * 5));
</script>

<Seo
  title="System design"
  description="System design notes, one idea at a time: {totals.concepts} concepts built up from a concrete example, with hand-drawn diagrams."
/>

<div class="sd-hub">
  <header class="sd-hero">
    <p class="sd-eyebrow">Learn · System design</p>
    <h1>System design, <em>one idea at a time.</em></h1>
    <p class="sd-lede">
      My notes for system design interviews and for the systems I run. Each one
      starts from a concrete example, tries the obvious design, watches it break,
      and only then names the real mechanism. Read them in shelf order — every
      note leans on the ones to its left.
    </p>
  </header>

  <div class="sd-ledger" aria-label="Shelf facts">
    <div><strong>{totals.concepts}</strong><span>concepts</span></div>
    <div><strong>{stages.length}</strong><span>stages</span></div>
    <div><strong>{totals.diagrams}</strong><span>diagrams</span></div>
    <div><strong>~{totals.hours}h</strong><span>of reading</span></div>
  </div>

  <section class="sd-shelf-wrap" aria-label="The shelf">
    <div class="sd-shelf">
      {#each stages as stage (stage.number)}
        <div class="sd-shelf-stage">
          <div class="sd-books">
            {#each stage.concepts as concept (concept.slug)}
              <a
                href="/learn/system-design/{concept.slug}"
                class="sd-book tier-{concept.tier}"
                class:is-active={shown?.slug === concept.slug}
                style="--h: {spineHeight(concept)}px"
                aria-label="{concept.title}, stage {formatStage(stage.number)}, {concept.readTime} min"
                on:mouseenter={() => (active = concept)}
                on:focus={() => (active = concept)}
              >
                <span class="sd-book-title">{concept.title}</span>
              </a>
            {/each}
          </div>
          <span class="sd-shelf-label">{formatStage(stage.number)}</span>
        </div>
      {/each}
    </div>
  </section>
  <p class="sd-shelf-hint" aria-hidden="true">Scroll the shelf · hover a spine to preview →</p>

  {#if shown}
    <a class="sd-preview" href="/learn/system-design/{shown.slug}" aria-live="polite">
      <p class="sd-eyebrow">
        Stage {formatStage(shown.stage)} · {shown.stageName} · {tierLabel[shown.tier]}
      </p>
      <h2>{shown.title}</h2>
      <p class="sd-preview-summary">{shown.summary}</p>
      <p class="sd-preview-meta">
        {shown.readTime} min read{shown.diagrams ? ` · ${shown.diagrams} diagram${shown.diagrams > 1 ? "s" : ""}` : ""}
        <b>Read →</b>
      </p>
    </a>
  {/if}

  <ul class="sd-legend" aria-label="Legend">
    <li><i class="tier-core" />Core — know it cold</li>
    <li><i class="tier-useful" />Useful — reach for it often</li>
    <li><i class="tier-breadth" />Breadth — know it exists</li>
  </ul>

  <div class="sd-map" id="map">
    {#each stages as stage (stage.number)}
      <section class="sd-stage" aria-labelledby="stage-{stage.number}">
        <header class="sd-stage-head">
          <div class="sd-stage-number" aria-hidden="true">{formatStage(stage.number)}</div>
          <h2 id="stage-{stage.number}">{stage.name}</h2>
          <p>{stage.concepts.length} notes</p>
        </header>
        <ol class="sd-rows">
          {#each stage.concepts as concept (concept.slug)}
            <li>
              <a href="/learn/system-design/{concept.slug}" class="sd-row">
                <span class="sd-row-copy">
                  <strong>{concept.title}</strong>
                  <small>{concept.summary}</small>
                </span>
                <span class="sd-row-meta">
                  <span class="sd-tier tier-{concept.tier}">{tierLabel[concept.tier]}</span>
                  <span>{concept.readTime} min</span>
                </span>
              </a>
            </li>
          {/each}
        </ol>
      </section>
    {/each}
  </div>

  <p class="sd-note">
    Written in my Obsidian vault and published from there. They follow the
    teaching style of Hello Interview and Alex Xu's books, cross-checked against
    company engineering blogs; mistakes are mine.
  </p>
</div>

<style>
  .sd-hub {
    --sd-accent-text: color-mix(in srgb, var(--accent) 72%, var(--ink));
    max-width: 58rem;
    margin-inline: auto;
  }

  .sd-eyebrow {
    font-family: "Geist Mono", ui-monospace, monospace;
    font-size: 0.65rem;
    letter-spacing: 0.14em;
    text-transform: uppercase;
    color: var(--ink-soft);
  }

  .sd-hero {
    padding-block: clamp(34px, 7vh, 72px) clamp(28px, 5vh, 48px);
  }

  .sd-hero h1 {
    margin-top: 16px;
    max-width: 14ch;
    font-size: clamp(3rem, 8vw, 6.2rem);
    font-weight: 300;
    letter-spacing: -0.035em;
    line-height: 0.9;
  }

  .sd-hero h1 em {
    font-family: "Newsreader", Georgia, serif;
    font-weight: 400;
    color: var(--accent);
  }

  .sd-lede {
    max-width: 39rem;
    margin-top: 28px;
    font-family: "Newsreader", Georgia, serif;
    font-size: clamp(1.08rem, 0.45vw + 1rem, 1.3rem);
    line-height: 1.65;
    color: color-mix(in srgb, var(--ink) 76%, transparent);
  }

  .sd-ledger {
    display: grid;
    grid-template-columns: repeat(4, 1fr);
    border-block: 1px solid var(--hairline);
  }

  .sd-ledger > div {
    display: flex;
    align-items: baseline;
    gap: 10px;
    padding: 18px clamp(10px, 2vw, 22px);
    border-right: 1px solid var(--hairline);
  }

  .sd-ledger > div:first-child {
    padding-left: 0;
  }

  .sd-ledger > div:last-child {
    border-right: 0;
  }

  .sd-ledger strong {
    font-family: "Newsreader", Georgia, serif;
    font-size: 1.8rem;
    font-weight: 400;
    color: var(--accent);
  }

  .sd-ledger span {
    font-size: 0.66rem;
    letter-spacing: var(--track-nav);
    text-transform: uppercase;
    color: var(--ink-soft);
  }

  /* The shelf */

  /* Both are <section>s; opt out of the site-wide section spacing. */
  .sd-shelf-wrap,
  .sd-stage {
    margin-bottom: 0;
  }

  .sd-shelf-wrap {
    margin-top: clamp(36px, 6vh, 64px);
    overflow-x: auto;
    overscroll-behavior-inline: contain;
    scrollbar-width: thin;
    padding-top: 14px;
    -webkit-mask-image: linear-gradient(to right, #000 88%, transparent);
    mask-image: linear-gradient(to right, #000 88%, transparent);
  }

  .sd-shelf-hint {
    margin-top: 10px;
    text-align: right;
    font-family: "Geist Mono", ui-monospace, monospace;
    font-size: 0.6rem;
    letter-spacing: 0.08em;
    text-transform: uppercase;
    color: var(--ink-soft);
  }

  .sd-shelf {
    --plank: color-mix(in srgb, var(--ink) 22%, var(--paper));
    display: flex;
    align-items: flex-start;
    width: max-content;
    min-width: 100%;
    padding-inline: 2px 12%;
  }

  .sd-shelf-stage {
    display: grid;
    justify-items: start;
    gap: 0;
  }

  .sd-books {
    display: flex;
    align-items: flex-end;
    gap: 3px;
    height: 262px;
    padding-inline: 8px;
    border-bottom: 9px solid var(--plank);
  }

  .sd-shelf-stage:first-child .sd-books,
  .sd-shelf-stage:first-child .sd-shelf-label {
    padding-left: 0;
  }

  .sd-shelf-label {
    margin-top: 10px;
    padding-left: 8px;
    font-family: "Geist Mono", ui-monospace, monospace;
    font-size: 0.58rem;
    letter-spacing: 0.1em;
    color: var(--ink-soft);
  }

  .sd-book {
    position: relative;
    display: flex;
    align-items: flex-end;
    justify-content: center;
    width: 30px;
    height: var(--h);
    padding-block: 12px;
    border: 1px solid color-mix(in srgb, var(--ink) 55%, transparent);
    border-radius: 2px 2px 0 0;
    background: var(--surface);
    transform-origin: bottom center;
    transition: transform 180ms ease, background 180ms ease, border-color 180ms ease;
  }

  .sd-book::before {
    content: "";
    position: absolute;
    top: 10px;
    left: 6px;
    right: 6px;
    height: 4px;
    border-block: 1px solid currentColor;
    opacity: 0.45;
  }

  .sd-book-title {
    writing-mode: vertical-rl;
    transform: rotate(180deg);
    max-height: calc(var(--h) - 40px);
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
    font-family: "Geist Mono", ui-monospace, monospace;
    font-size: 0.62rem;
    font-weight: 500;
    letter-spacing: 0.06em;
    text-transform: uppercase;
  }

  .sd-book.tier-core {
    background: color-mix(in srgb, var(--accent) 22%, var(--paper));
    border-color: color-mix(in srgb, var(--accent) 70%, var(--ink));
    color: var(--ink);
  }

  .sd-book.tier-useful {
    color: color-mix(in srgb, var(--ink) 85%, transparent);
  }

  .sd-book.tier-breadth {
    background: transparent;
    border-style: dashed;
    color: var(--ink-soft);
  }

  .sd-book:hover,
  .sd-book:focus-visible,
  .sd-book.is-active {
    transform: translateY(-12px);
    border-color: var(--accent);
  }

  .sd-book.is-active {
    background: color-mix(in srgb, var(--accent) 45%, var(--paper));
  }

  .sd-preview {
    display: grid;
    gap: 10px;
    margin-top: 28px;
    padding: 22px 24px;
    border: 1px solid var(--hairline);
    background: color-mix(in srgb, var(--accent) 5%, transparent);
    transition: border-color 160ms ease;
  }

  .sd-preview:hover {
    border-color: var(--accent);
  }

  .sd-preview h2 {
    font-size: clamp(1.6rem, 3.4vw, 2.4rem);
    font-weight: 300;
    letter-spacing: -0.01em;
    line-height: 1.05;
  }

  .sd-preview-summary {
    max-width: 44rem;
    font-family: "Newsreader", Georgia, serif;
    font-size: 1.05rem;
    line-height: 1.55;
    color: color-mix(in srgb, var(--ink) 78%, transparent);
  }

  .sd-preview-meta {
    display: flex;
    justify-content: space-between;
    gap: 16px;
    font-family: "Geist Mono", ui-monospace, monospace;
    font-size: 0.66rem;
    letter-spacing: 0.06em;
    text-transform: uppercase;
    color: var(--ink-soft);
  }

  .sd-preview-meta b {
    font-weight: 400;
    color: var(--sd-accent-text);
  }

  .sd-legend {
    display: flex;
    flex-wrap: wrap;
    gap: 10px 22px;
    margin-top: 18px;
    padding: 0;
    list-style: none;
    font-family: "Geist Mono", ui-monospace, monospace;
    font-size: 0.62rem;
    letter-spacing: 0.06em;
    text-transform: uppercase;
    color: var(--ink-soft);
  }

  .sd-legend li {
    display: flex;
    align-items: center;
    gap: 8px;
  }

  .sd-legend i {
    width: 10px;
    height: 14px;
    border: 1px solid color-mix(in srgb, var(--ink) 55%, transparent);
    background: var(--surface);
  }

  .sd-legend i.tier-core {
    background: color-mix(in srgb, var(--accent) 22%, var(--paper));
    border-color: color-mix(in srgb, var(--accent) 70%, var(--ink));
  }

  .sd-legend i.tier-breadth {
    background: transparent;
    border-style: dashed;
  }

  /* The map */

  .sd-map {
    margin-top: clamp(72px, 12vh, 128px);
  }

  .sd-stage {
    display: grid;
    grid-template-columns: minmax(180px, 0.42fr) minmax(0, 1fr);
    gap: 18px 40px;
    padding-block: 34px;
    border-top: 1px solid var(--hairline);
  }

  .sd-stage-head {
    align-self: start;
    position: sticky;
    top: 96px;
  }

  .sd-stage-number {
    font-family: "Newsreader", Georgia, serif;
    font-style: italic;
    font-size: clamp(2.6rem, 5vw, 3.6rem);
    line-height: 1;
    color: var(--accent);
  }

  .sd-stage-head h2 {
    margin-top: 10px;
    font-size: clamp(1.3rem, 2.4vw, 1.7rem);
    font-weight: 300;
    line-height: 1.15;
  }

  .sd-stage-head p {
    margin-top: 8px;
    font-family: "Geist Mono", ui-monospace, monospace;
    font-size: 0.62rem;
    letter-spacing: 0.08em;
    text-transform: uppercase;
    color: var(--ink-soft);
  }

  .sd-rows {
    padding: 0;
    list-style: none;
  }

  .sd-rows li + li {
    border-top: 1px solid var(--hairline);
  }

  .sd-row {
    display: grid;
    grid-template-columns: minmax(0, 1fr) auto;
    gap: 6px 24px;
    padding-block: 14px;
    transition: padding 160ms ease, background 160ms ease;
  }

  .sd-row:hover {
    padding-inline: 10px;
    background: color-mix(in srgb, var(--accent) 7%, transparent);
  }

  .sd-row-copy {
    display: grid;
    gap: 4px;
    min-width: 0;
  }

  .sd-row-copy strong {
    font-weight: 400;
    font-size: 1.02rem;
  }

  .sd-row-copy small {
    display: -webkit-box;
    -webkit-line-clamp: 2;
    -webkit-box-orient: vertical;
    overflow: hidden;
    font-family: "Newsreader", Georgia, serif;
    font-size: 0.92rem;
    line-height: 1.45;
    color: var(--ink-soft);
  }

  .sd-row-meta {
    display: grid;
    justify-items: end;
    align-content: start;
    gap: 6px;
    font-family: "Geist Mono", ui-monospace, monospace;
    font-size: 0.6rem;
    letter-spacing: 0.08em;
    text-transform: uppercase;
    color: var(--ink-soft);
    white-space: nowrap;
  }

  .sd-tier {
    padding: 2px 6px;
    border: 1px solid var(--hairline);
  }

  .sd-tier.tier-core {
    border-color: color-mix(in srgb, var(--accent) 60%, transparent);
    color: var(--sd-accent-text);
  }

  .sd-tier.tier-breadth {
    border-style: dashed;
  }

  .sd-note {
    max-width: 40rem;
    margin-block: 48px 24px;
    padding-top: 22px;
    border-top: 1px dashed var(--hairline);
    font-family: "Newsreader", Georgia, serif;
    font-size: 0.95rem;
    line-height: 1.55;
    color: var(--ink-soft);
  }

  @media (max-width: 720px) {
    .sd-ledger {
      grid-template-columns: 1fr 1fr;
    }

    .sd-ledger > div:nth-child(2) {
      border-right: 0;
    }

    .sd-ledger > div:nth-child(3) {
      padding-left: 0;
    }

    .sd-ledger > div:nth-child(-n + 2) {
      border-bottom: 1px solid var(--hairline);
    }

    .sd-stage {
      grid-template-columns: 1fr;
    }

    .sd-stage-head {
      position: static;
      display: flex;
      align-items: baseline;
      gap: 14px;
    }

    .sd-stage-head h2 {
      margin-top: 0;
    }

    .sd-stage-head p {
      margin-left: auto;
    }

    .sd-row {
      grid-template-columns: 1fr;
    }

    .sd-row-meta {
      grid-auto-flow: column;
      justify-content: start;
    }
  }

  @media (prefers-reduced-motion: reduce) {
    .sd-book,
    .sd-row {
      transition: none;
    }
  }
</style>
