<script lang="ts">
  import {
    formatModuleNumber,
    kubernetesCourseModules,
    type KubernetesCourseRoute,
    type KubernetesCourseModule,
  } from "$lib/kubernetes-course";

  export let current: KubernetesCourseModule;
  export let previous: KubernetesCourseModule | undefined = undefined;
  export let next: KubernetesCourseModule | undefined = undefined;
  export let variant: "header" | "pager" = "header";
  export let route: KubernetesCourseRoute = "all";

  function moduleHref(module: KubernetesCourseModule) {
    const track = route === "all" ? "" : `?track=${route}`;
    return module.slug
      ? `/writing/${module.slug}${track}`
      : `/learn/kubernetes${track}#module-${formatModuleNumber(module.number)}`;
  }

  function modulesForRoute(selectedRoute: KubernetesCourseRoute) {
    if (selectedRoute === "all") return kubernetesCourseModules;
    return kubernetesCourseModules.filter((module) =>
      module.tracks.includes(selectedRoute)
    );
  }

  $: courseHref =
    route === "all" ? "/learn/kubernetes" : `/learn/kubernetes?track=${route}`;
  $: routeModules = modulesForRoute(route);
  $: routePosition =
    routeModules.findIndex((module) => module.number === current.number) + 1;
  $: routeLabel = route === "all" ? "" : ` on the ${route} route`;
</script>

{#if variant === "header"}
  <nav class="course-context" aria-label="Kubernetes course location">
    <div class="course-context-line">
      <a href={courseHref}>Kubernetes from first principles</a>
      <span aria-hidden="true">/</span>
      <span>Season {current.season}</span>
      <span aria-hidden="true">/</span>
      <strong aria-current="step"
        >Module {formatModuleNumber(current.number)}</strong
      >
    </div>
    <div
      class="course-track"
      style={`grid-template-columns: repeat(${routeModules.length}, minmax(0, 1fr));`}
      aria-hidden="true"
    >
      {#each routeModules as step (step.number)}
        <span
          class:passed={step.number <= current.number}
          class:active={step.number === current.number}
        />
      {/each}
    </div>
    <p>
      {routePosition} of {routeModules.length}{routeLabel} · {current.duration}
    </p>
  </nav>
{:else}
  <nav class="course-pager" aria-label="Kubernetes course modules">
    <div class="course-pager-side course-pager-previous">
      {#if previous}
        <a href={moduleHref(previous)}>
          <span class="course-pager-label"
            >← Previous · {formatModuleNumber(previous.number)}</span
          >
          <strong>{previous.shortTitle}</strong>
        </a>
      {/if}
    </div>

    <a
      class="course-pager-index"
      href={courseHref}
      aria-label="Open the course map"
    >
      <span aria-hidden="true" />
      <span aria-hidden="true" />
      <span aria-hidden="true" />
      <b>Course map</b>
    </a>

    <div class="course-pager-side course-pager-next">
      {#if next}
        <a href={moduleHref(next)}>
          <span class="course-pager-label">
            {formatModuleNumber(next.number)} · {next.slug ? "Next" : "Planned"}
            →
          </span>
          <strong>{next.shortTitle}</strong>
        </a>
      {/if}
    </div>
  </nav>
{/if}

<style>
  .course-context {
    --ink-soft: color-mix(in srgb, var(--ink) 70%, transparent);
    width: 100%;
    min-width: 0;
    margin-bottom: clamp(26px, 5vh, 44px);
    font-family: var(--font);
  }

  .course-context-line {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    gap: 0.35rem 0.65rem;
    font-size: 0.68rem;
    letter-spacing: var(--track-nav);
    text-transform: uppercase;
    color: var(--ink-soft);
  }

  .course-context-line a,
  .course-context-line strong {
    color: var(--ink);
    font-weight: 500;
  }

  .course-context-line a {
    text-decoration: underline;
    text-decoration-color: transparent;
    text-underline-offset: 4px;
    transition: text-decoration-color 160ms ease;
  }

  .course-context-line a:hover {
    text-decoration-color: var(--ink-soft);
  }

  .course-track {
    display: grid;
    width: 100%;
    min-width: 0;
    gap: 3px;
    margin-top: 13px;
  }

  .course-track span {
    min-width: 0;
    height: 2px;
    background: var(--hairline);
    transition: background 180ms ease, transform 180ms ease;
  }

  .course-track span.passed {
    background: color-mix(in srgb, var(--accent) 55%, var(--ink));
  }

  .course-track span.active {
    transform: scaleY(2.5);
    background: var(--accent);
  }

  .course-context p {
    margin-top: 8px;
    font-family: "Geist Mono", ui-monospace, monospace;
    font-size: 0.65rem;
    letter-spacing: 0.06em;
    color: var(--ink-soft);
  }

  .course-pager {
    --ink-soft: color-mix(in srgb, var(--ink) 70%, transparent);
    display: grid;
    width: 100%;
    min-width: 0;
    grid-template-columns: minmax(0, 1fr) auto minmax(0, 1fr);
    align-items: stretch;
    gap: 18px;
    margin-top: clamp(48px, 8vh, 86px);
    padding-block: 18px;
    border-block: 1px solid var(--hairline);
    font-family: var(--font);
  }

  .course-pager-side {
    min-width: 0;
  }

  .course-pager-side a {
    display: grid;
    gap: 5px;
    height: 100%;
    align-content: center;
    transition: opacity 160ms ease;
  }

  .course-pager-side a:hover {
    opacity: 0.62;
  }

  .course-pager-side strong {
    font-size: 0.9rem;
    font-weight: 400;
    letter-spacing: 0.02em;
    line-height: 1.3;
    text-wrap: balance;
  }

  .course-pager-label {
    font-family: "Geist Mono", ui-monospace, monospace;
    font-size: 0.62rem;
    letter-spacing: 0.08em;
    text-transform: uppercase;
    color: var(--ink-soft);
  }

  .course-pager-next {
    text-align: right;
  }

  .course-pager-index {
    display: grid;
    grid-template-columns: repeat(3, 4px);
    grid-template-rows: repeat(2, 4px) auto;
    place-content: center;
    gap: 3px;
    min-width: 72px;
    padding-inline: 8px;
    border-inline: 1px dashed var(--hairline);
    color: var(--ink-soft);
    transition: color 160ms ease;
  }

  .course-pager-index:hover {
    color: var(--ink);
  }

  .course-pager-index span {
    width: 4px;
    height: 4px;
    border-radius: 50%;
    background: currentColor;
    box-shadow: 7px 0 currentColor;
  }

  .course-pager-index b {
    grid-column: 1 / -1;
    margin-top: 4px;
    font-size: 0.6rem;
    font-weight: 400;
    letter-spacing: 0.08em;
    text-transform: uppercase;
    white-space: nowrap;
  }

  @media (max-width: 640px) {
    .course-context-line {
      gap: 0.25rem 0.45rem;
      font-size: 0.62rem;
      letter-spacing: 0.08em;
    }

    .course-track {
      gap: 2px;
    }

    .course-pager {
      grid-template-columns: 1fr 1fr;
      gap: 14px;
    }

    .course-pager-index {
      display: none;
    }

    .course-pager-side strong {
      font-size: 0.82rem;
    }

    .course-pager-label {
      font-size: 0.58rem;
    }
  }

  @media (max-width: 420px) {
    .course-pager {
      grid-template-columns: 1fr;
      gap: 12px;
    }

    .course-pager-next {
      text-align: left;
      padding-top: 12px;
      border-top: 1px dashed var(--hairline);
    }
  }
</style>
