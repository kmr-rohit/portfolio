<script lang="ts">
  import { Seo } from "$lib/components/site";
  import {
    formatModuleNumber,
    type KubernetesCourseRoute,
    kubernetesCourse,
    kubernetesCourseModules,
    kubernetesCourseSeasons,
    type KubernetesCourseModule,
  } from "$lib/kubernetes-course";

  export let data;

  const routes: Array<{
    id: KubernetesCourseRoute;
    label: string;
    path: string;
  }> = [
    { id: "all", label: "Full map", path: "00–26 · every module" },
    { id: "software", label: "Software", path: "00–16 · software project" },
    { id: "ai", label: "AI", path: "00–25 · AI project" },
    { id: "platform", label: "Platform", path: "00–26 · both projects" },
  ];

  let selectedRoute: KubernetesCourseRoute = data.selectedRoute;

  $: published = new Set<string>(data.publishedSlugs);
  $: visibleModules = kubernetesCourseModules.filter(
    (module) => selectedRoute === "all" || module.tracks.includes(selectedRoute)
  );

  function isPublished(module: KubernetesCourseModule) {
    return Boolean(module.slug && published.has(module.slug));
  }

  function moduleHref(module: KubernetesCourseModule) {
    if (!module.slug) return "/learn/kubernetes";
    const track = selectedRoute === "all" ? "" : `?track=${selectedRoute}`;
    return `/writing/${module.slug}${track}`;
  }
</script>

<Seo
  title="Learn Kubernetes from first principles"
  description={kubernetesCourse.description}
/>

<div class="course-hub">
  <header class="course-hero">
    <div class="course-hero-copy">
      <p class="course-eyebrow">Field course · Modules 00—26</p>
      <h1>Kubernetes,<br /><em>without the magic.</em></h1>
      <p class="course-lede">
        No Kubernetes experience is needed. Start with one running program,
        place it in a container, and learn why teams use Kubernetes when many
        containers must keep working together. You will see each idea before you
        have to remember its name.
      </p>

      <div class="course-actions">
        <a class="course-start" href={moduleHref(kubernetesCourseModules[0])}>
          Start at Module 00 <span aria-hidden="true">→</span>
        </a>
        <a class="course-secondary" href="#course-map">Inspect the course map</a
        >
      </div>
    </div>

    <div
      class="layer-stamp"
      aria-label="The local lab layers: Mac, Linux virtual machine, Kubernetes node, application container"
    >
      <div class="layer layer-mac">
        <span>macOS</span>
        <div class="layer layer-vm">
          <span>Linux VM</span>
          <div class="layer layer-node">
            <span>Kubernetes node</span>
            <div class="layer layer-pod">
              <span>app container</span><b aria-hidden="true" />
            </div>
          </div>
        </div>
      </div>
      <p>four boundaries · one laptop</p>
    </div>
  </header>

  <div class="course-ledger" aria-label="Course facts">
    <div>
      <strong>{kubernetesCourse.moduleCount}</strong><span>modules</span>
    </div>
    <div>
      <strong>{kubernetesCourse.checkpointCount}</strong><span
        >larger projects</span
      >
    </div>
    <div><strong>4</strong><span>seasons</span></div>
    <div><strong>1</strong><span>rebuildable lab</span></div>
  </div>

  <section class="method-strip" aria-labelledby="method-title">
    <div>
      <p class="course-eyebrow">The recurring method</p>
      <h2 id="method-title">Try it, see it, then name it.</h2>
    </div>
    <ol aria-label="Course learning loop">
      <li>Predict</li>
      <li>Deploy</li>
      <li>Observe</li>
      <li>Break</li>
      <li>Explain</li>
      <li>Repair</li>
      <li>Prove</li>
      <li>Clean up</li>
    </ol>
  </section>

  <section class="route-board" aria-labelledby="route-title">
    <div class="route-intro">
      <p class="course-eyebrow">Choose what you want to build</p>
      <h2 id="route-title">Start together. Specialise later.</h2>
      <p>
        Everyone learns the same basics first. The route filter only changes the
        later modules you need to finish, and you can switch routes at any time.
      </p>
    </div>

    <div
      class="route-tabs"
      role="group"
      aria-label="Filter modules by learning route"
    >
      {#each routes as route (route.id)}
        <button
          type="button"
          class:active={selectedRoute === route.id}
          aria-pressed={selectedRoute === route.id}
          on:click={() => (selectedRoute = route.id)}
        >
          <span>{route.label}</span>
          <small>{route.path}</small>
        </button>
      {/each}
    </div>
  </section>

  <div class="course-map" id="course-map">
    <div class="map-head">
      <p class="course-eyebrow">Course map</p>
      <p aria-live="polite">
        Showing {visibleModules.length} modules · later terms are previews, not prerequisites
      </p>
    </div>

    {#each kubernetesCourseSeasons as season (season.number)}
      {@const seasonModules = visibleModules.filter(
        (module) => module.season === season.number
      )}
      {#if seasonModules.length}
        <section class="course-season" aria-labelledby="season-{season.number}">
          <header class="season-head">
            <div class="season-number" aria-hidden="true">0{season.number}</div>
            <div>
              <p>Season {season.number} · {season.range}</p>
              <h2 id="season-{season.number}">{season.title}</h2>
              <span>{season.thesis}</span>
            </div>
          </header>

          <ol class="module-list">
            {#each seasonModules as module (module.number)}
              <li
                id="module-{formatModuleNumber(module.number)}"
                class:available={isPublished(module)}
              >
                {#if isPublished(module) && module.slug}
                  <a href={moduleHref(module)} class="module-row">
                    <span class="module-number"
                      >{formatModuleNumber(module.number)}</span
                    >
                    <span class="module-copy">
                      <strong>{module.shortTitle}</strong>
                      <small>{module.summary}</small>
                    </span>
                    <span class="module-meta">
                      <b>{module.number === 0 ? "start here" : "available"} ↗</b
                      >
                      <small>{module.duration}</small>
                    </span>
                  </a>
                {:else}
                  <div class="module-row">
                    <span class="module-number"
                      >{formatModuleNumber(module.number)}</span
                    >
                    <span class="module-copy">
                      <strong>{module.shortTitle}</strong>
                      <small>{module.summary}</small>
                    </span>
                    <span class="module-meta">
                      <b>planned</b>
                      <small>{module.duration}</small>
                    </span>
                  </div>
                {/if}
              </li>
            {/each}
          </ol>
        </section>
      {/if}
    {/each}
  </div>

  <section class="before-starting" aria-labelledby="before-title">
    <div>
      <p class="course-eyebrow">Before Module 00</p>
      <h2 id="before-title">You do not need Kubernetes experience.</h2>
    </div>
    <div class="before-grid">
      <div>
        <strong>Required locally</strong>
        <p>
          A Mac with 16 GB of memory and Docker Desktop. Module 00 gives the
          install links, checks each small command-line tool, and explains what
          it does.
        </p>
      </div>
      <div>
        <strong>Proven on the laptop</strong>
        <p>
          You can create a local cluster, run applications, follow requests,
          cause safe failures, and understand how Kubernetes repairs them.
        </p>
      </div>
      <div>
        <strong>Kept remote</strong>
        <p>
          Real GPU clusters, specialised data-centre networking, and production
          performance tests. Those are explained later without pretending one
          laptop can reproduce them.
        </p>
      </div>
    </div>
    <p class="version-note">
      Course research checked {kubernetesCourse.researchDate}. Each lab fixes
      its tool versions, tells you what success looks like, and explains what
      would be different in production. Module 00 also shows how to clone the
      lab repository or download it as a ZIP; every lab command links directly
      to the files it uses.
    </p>
  </section>
</div>

<style>
  .course-hub {
    --course-blue: var(--accent);
    --course-blue-text: color-mix(in srgb, var(--accent) 72%, var(--ink));
    --course-wash: color-mix(in srgb, var(--accent) 8%, transparent);
    --ink-soft: color-mix(in srgb, var(--ink) 70%, transparent);
    max-width: 58rem;
    margin-inline: auto;
  }

  .course-hero {
    display: grid;
    grid-template-columns: minmax(0, 1.25fr) minmax(250px, 0.75fr);
    gap: clamp(42px, 8vw, 92px);
    align-items: center;
    min-height: min(720px, 76vh);
    padding-block: clamp(34px, 7vh, 78px);
  }

  .course-eyebrow {
    font-family: "Geist Mono", ui-monospace, monospace;
    font-size: 0.65rem;
    letter-spacing: 0.14em;
    text-transform: uppercase;
    color: var(--ink-soft);
  }

  .course-hero h1 {
    margin-top: 16px;
    font-size: clamp(3.2rem, 8.5vw, 6.8rem);
    font-weight: 300;
    letter-spacing: -0.035em;
    line-height: 0.88;
  }

  .course-hero h1 em {
    font-family: "Newsreader", Georgia, serif;
    font-weight: 400;
    color: var(--course-blue);
  }

  .course-lede {
    max-width: 39rem;
    margin-top: 28px;
    font-family: "Newsreader", Georgia, serif;
    font-size: clamp(1.08rem, 0.45vw + 1rem, 1.3rem);
    line-height: 1.65;
    color: color-mix(in srgb, var(--ink) 76%, transparent);
  }

  .course-actions {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    gap: 16px 24px;
    margin-top: 32px;
    font-size: 0.78rem;
    letter-spacing: var(--track-nav);
  }

  .course-start {
    display: inline-flex;
    align-items: center;
    gap: 18px;
    padding: 12px 15px;
    border: 1px solid var(--ink);
    background: var(--ink);
    color: var(--paper);
    transition: transform 160ms ease, background 160ms ease, color 160ms ease;
  }

  .course-start:hover {
    transform: translate(3px, -3px);
    background: var(--course-blue-text);
    border-color: var(--course-blue-text);
  }

  .course-secondary {
    padding-block: 8px;
    border-bottom: 1px solid var(--hairline);
    color: var(--ink-soft);
    transition: color 160ms ease, border-color 160ms ease;
  }

  .course-secondary:hover {
    color: var(--ink);
    border-color: var(--ink);
  }

  .layer-stamp {
    position: relative;
    justify-self: end;
    width: min(100%, 300px);
    padding: 12px 12px 10px;
    border: 1px dashed var(--hairline);
    transform: rotate(1.4deg);
  }

  .layer {
    position: relative;
    padding: 28px 13px 13px;
    border: 1px solid color-mix(in srgb, var(--ink) 36%, transparent);
    background: color-mix(in srgb, var(--paper) 92%, transparent);
  }

  .layer > .layer {
    margin-top: 10px;
  }

  .layer > span {
    position: absolute;
    top: 7px;
    left: 9px;
    font-family: "Geist Mono", ui-monospace, monospace;
    font-size: 0.58rem;
    letter-spacing: 0.11em;
    text-transform: uppercase;
    color: var(--ink-soft);
  }

  .layer-vm {
    border-style: dashed;
  }

  .layer-node {
    background: var(--course-wash);
    border-color: color-mix(in srgb, var(--course-blue) 55%, var(--hairline));
  }

  .layer-pod {
    height: 62px;
    background: color-mix(in srgb, var(--course-blue) 13%, var(--paper));
  }

  .layer-pod b {
    position: absolute;
    right: 18px;
    bottom: 16px;
    width: 25px;
    height: 13px;
    border: 1px solid var(--course-blue);
    border-radius: 50%;
    box-shadow: -15px -8px 0 -4px var(--course-blue);
  }

  .layer-stamp > p {
    margin-top: 10px;
    text-align: center;
    font-family: "Geist Mono", ui-monospace, monospace;
    font-size: 0.58rem;
    letter-spacing: 0.09em;
    text-transform: uppercase;
    color: var(--ink-soft);
  }

  .course-ledger {
    display: grid;
    grid-template-columns: repeat(4, 1fr);
    border-block: 1px solid var(--hairline);
  }

  .course-ledger > div {
    display: flex;
    align-items: baseline;
    gap: 10px;
    padding: 18px clamp(10px, 2vw, 22px);
    border-right: 1px solid var(--hairline);
  }

  .course-ledger > div:first-child {
    padding-left: 0;
  }

  .course-ledger > div:last-child {
    border-right: 0;
  }

  .course-ledger strong {
    font-family: "Newsreader", Georgia, serif;
    font-size: 1.8rem;
    font-weight: 400;
    color: var(--course-blue);
  }

  .course-ledger span {
    font-size: 0.66rem;
    letter-spacing: var(--track-nav);
    text-transform: uppercase;
    color: var(--ink-soft);
  }

  .method-strip,
  .route-board,
  .before-starting {
    margin-bottom: clamp(70px, 12vh, 128px);
  }

  .method-strip {
    display: grid;
    grid-template-columns: minmax(220px, 0.75fr) minmax(0, 1.25fr);
    gap: 36px 64px;
    align-items: end;
    padding-top: clamp(74px, 12vh, 128px);
  }

  .method-strip h2,
  .route-board h2,
  .before-starting h2 {
    margin-top: 8px;
    font-size: clamp(1.7rem, 3.5vw, 2.7rem);
    font-weight: 300;
    letter-spacing: var(--track-display);
    line-height: 1.05;
  }

  .method-strip ol {
    display: flex;
    flex-wrap: wrap;
    gap: 8px;
    padding: 0;
    list-style: none;
    counter-reset: method;
  }

  .method-strip li {
    counter-increment: method;
    display: flex;
    align-items: center;
    gap: 8px;
    padding: 8px 10px;
    border: 1px solid var(--hairline);
    font-family: "Geist Mono", ui-monospace, monospace;
    font-size: 0.68rem;
    letter-spacing: 0.035em;
  }

  .method-strip li::before {
    content: counter(method, decimal-leading-zero);
    color: var(--course-blue-text);
  }

  .route-board {
    display: grid;
    grid-template-columns: minmax(230px, 0.8fr) minmax(0, 1.2fr);
    gap: 42px 72px;
    padding-block: 32px;
    border-block: 1px dashed var(--hairline);
  }

  .route-intro > p:last-child {
    margin-top: 16px;
    font-family: "Newsreader", Georgia, serif;
    line-height: 1.55;
    color: var(--ink-soft);
  }

  .route-tabs {
    display: grid;
    grid-template-columns: 1fr 1fr;
    border-left: 1px solid var(--hairline);
    border-top: 1px solid var(--hairline);
  }

  .route-tabs button {
    display: grid;
    gap: 5px;
    padding: 15px;
    text-align: left;
    font: inherit;
    color: var(--ink-soft);
    background: transparent;
    border: 0;
    border-right: 1px solid var(--hairline);
    border-bottom: 1px solid var(--hairline);
    cursor: pointer;
    transition: background 160ms ease, color 160ms ease;
  }

  .route-tabs button:hover,
  .route-tabs button.active {
    color: var(--ink);
    background: var(--course-wash);
  }

  .route-tabs button.active {
    box-shadow: inset 3px 0 var(--course-blue);
  }

  .route-tabs span {
    font-size: 0.82rem;
    letter-spacing: var(--track-nav);
  }

  .route-tabs small {
    font-family: "Geist Mono", ui-monospace, monospace;
    font-size: 0.6rem;
    letter-spacing: 0.035em;
    color: var(--ink-soft);
  }

  .course-map {
    scroll-margin-top: 110px;
  }

  .map-head {
    display: flex;
    justify-content: space-between;
    gap: 20px;
    padding-bottom: 12px;
    border-bottom: 1px solid var(--ink);
  }

  .map-head > p:last-child {
    font-family: "Geist Mono", ui-monospace, monospace;
    font-size: 0.63rem;
    color: var(--ink-soft);
  }

  .course-season {
    margin: 0;
    padding-block: clamp(38px, 7vh, 70px);
    border-bottom: 1px solid var(--ink);
  }

  .season-head {
    display: grid;
    grid-template-columns: 80px minmax(0, 1fr);
    gap: 20px;
    margin-bottom: 24px;
  }

  .season-number {
    font-family: "Newsreader", Georgia, serif;
    font-size: 3.6rem;
    font-style: italic;
    line-height: 0.8;
    color: color-mix(in srgb, var(--course-blue) 75%, var(--ink));
  }

  .season-head p {
    font-family: "Geist Mono", ui-monospace, monospace;
    font-size: 0.62rem;
    letter-spacing: 0.08em;
    text-transform: uppercase;
    color: var(--ink-soft);
  }

  .season-head h2 {
    margin-top: 6px;
    font-size: clamp(1.45rem, 3vw, 2.1rem);
    font-weight: 300;
    letter-spacing: var(--track-display);
  }

  .season-head span {
    display: block;
    max-width: 43rem;
    margin-top: 8px;
    font-family: "Newsreader", Georgia, serif;
    line-height: 1.5;
    color: var(--ink-soft);
  }

  .module-list {
    margin: 0;
    padding: 0;
    list-style: none;
    border-top: 1px solid var(--hairline);
  }

  .module-list li {
    scroll-margin-top: 112px;
    border-bottom: 1px solid var(--hairline);
  }

  .module-row {
    display: grid;
    grid-template-columns: 52px minmax(0, 1fr) 100px;
    gap: 14px 22px;
    align-items: start;
    padding-block: 18px;
    transition: padding 180ms ease, opacity 180ms ease, background 180ms ease;
  }

  a.module-row:hover {
    padding-inline: 10px;
    background: var(--course-wash);
  }

  .module-number {
    font-family: "Geist Mono", ui-monospace, monospace;
    font-size: 0.75rem;
    letter-spacing: 0.08em;
    color: var(--ink-soft);
  }

  .available .module-number {
    color: var(--course-blue-text);
  }

  .module-copy {
    display: grid;
    gap: 5px;
  }

  .module-copy strong {
    font-size: 1rem;
    font-weight: 400;
    letter-spacing: 0.02em;
  }

  .module-copy small {
    font-family: "Newsreader", Georgia, serif;
    font-size: 0.91rem;
    line-height: 1.45;
    color: var(--ink-soft);
  }

  .module-meta {
    display: grid;
    gap: 5px;
    text-align: right;
  }

  .module-meta b,
  .module-meta small {
    font-family: "Geist Mono", ui-monospace, monospace;
    font-size: 0.58rem;
    font-weight: 400;
    letter-spacing: 0.06em;
    text-transform: uppercase;
    color: var(--ink-soft);
  }

  .available .module-meta b {
    color: var(--course-blue-text);
  }

  .before-starting {
    padding-top: clamp(78px, 13vh, 140px);
  }

  .before-grid {
    display: grid;
    grid-template-columns: repeat(3, 1fr);
    margin-top: 30px;
    border-block: 1px solid var(--hairline);
  }

  .before-grid > div {
    padding: 20px;
    border-right: 1px solid var(--hairline);
  }

  .before-grid > div:first-child {
    padding-left: 0;
  }

  .before-grid > div:last-child {
    border-right: 0;
  }

  .before-grid strong {
    font-size: 0.72rem;
    letter-spacing: var(--track-nav);
    text-transform: uppercase;
  }

  .before-grid p,
  .version-note {
    margin-top: 9px;
    font-family: "Newsreader", Georgia, serif;
    line-height: 1.55;
    color: var(--ink-soft);
  }

  .version-note {
    max-width: 42rem;
    margin-top: 20px;
    font-size: 0.9rem;
  }

  @media (max-width: 760px) {
    .course-hero {
      grid-template-columns: 1fr;
      min-height: auto;
      padding-top: 40px;
      gap: 36px;
    }

    .layer-stamp {
      justify-self: start;
      width: min(100%, 310px);
      transform: none;
    }

    .course-ledger {
      grid-template-columns: 1fr 1fr;
    }

    .course-ledger > div:nth-child(2) {
      border-right: 0;
    }

    .course-ledger > div:nth-child(-n + 2) {
      border-bottom: 1px solid var(--hairline);
    }

    .course-ledger > div:nth-child(3) {
      padding-left: 0;
    }

    .method-strip,
    .route-board {
      grid-template-columns: 1fr;
      gap: 24px;
    }

    .map-head {
      flex-direction: column;
      align-items: flex-start;
      gap: 8px;
    }

    .before-grid {
      grid-template-columns: 1fr;
    }

    .before-grid > div,
    .before-grid > div:first-child {
      padding: 18px 0;
      border-right: 0;
      border-bottom: 1px solid var(--hairline);
    }

    .before-grid > div:last-child {
      border-bottom: 0;
    }
  }

  @media (max-width: 540px) {
    .course-hub {
      max-width: 100%;
    }

    .course-hero h1 {
      font-size: clamp(2.4rem, 12vw, 4.25rem);
    }

    .course-lede {
      font-size: 1.05rem;
    }

    .course-actions {
      flex-direction: column;
      align-items: stretch;
      gap: 12px;
    }

    .course-start {
      justify-content: space-between;
    }

    .course-ledger > div {
      display: grid;
      gap: 2px;
      padding: 14px 12px;
    }

    .course-ledger > div:nth-child(odd) {
      padding-left: 0;
    }

    .course-ledger > div:nth-child(even) {
      padding-right: 0;
    }

    .course-ledger strong {
      font-size: 1.45rem;
    }

    .route-tabs {
      grid-template-columns: 1fr;
    }

    .season-head {
      grid-template-columns: 48px minmax(0, 1fr);
      gap: 12px;
    }

    .season-number {
      font-size: 2.55rem;
    }

    .module-row {
      grid-template-columns: 38px minmax(0, 1fr);
      gap: 10px 12px;
    }

    .module-meta {
      grid-column: 2;
      grid-template-columns: auto 1fr;
      text-align: left;
    }

    .method-strip li {
      flex: 1 1 calc(50% - 8px);
      min-width: 0;
    }
  }

  @media (max-width: 360px) {
    .course-ledger {
      grid-template-columns: 1fr;
    }

    .course-ledger > div,
    .course-ledger > div:nth-child(odd),
    .course-ledger > div:nth-child(even) {
      padding-inline: 0;
      border-right: 0;
      border-bottom: 1px solid var(--hairline);
    }

    .course-ledger > div:last-child {
      border-bottom: 0;
    }

    .method-strip li {
      flex-basis: 100%;
    }
  }

  @media (prefers-reduced-motion: reduce) {
    .course-start,
    .module-row {
      transition: none;
    }

    .course-start:hover {
      transform: none;
    }
  }
</style>
