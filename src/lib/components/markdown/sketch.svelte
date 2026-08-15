<script lang="ts">
  /**
   * Inlined Rough.js / Excalidraw-style sketch. We inline (instead of <img>)
   * so the handwritten face loads and the figure can sit on the page like a
   * pasted notebook scrap. Sketches are loaded on demand so unused SVGs stay
   * out of the main bundle.
   */
  import { cn } from "$lib/utils";

  const loaders = import.meta.glob("$lib/sketches/*.svg", {
    as: "raw",
  }) as Record<string, () => Promise<string>>;

  export let src: string;
  export let caption: string | undefined = undefined;
  export let alt: string | undefined = undefined;

  let className: string | undefined | null = undefined;
  export { className as class };

  let markup = "";
  let missing = false;

  $: isCourseMap =
    src.includes("kubernetes-local-layers.svg") ||
    src.includes("container-network-boundaries.svg");

  async function load(path: string) {
    const file = path.split("/").pop();
    if (!file) {
      missing = true;
      markup = "";
      return;
    }
    const key = Object.keys(loaders).find((k) => k.endsWith(`/${file}`));
    if (!key) {
      missing = true;
      markup = "";
      return;
    }
    missing = false;
    markup = await loaders[key]();
  }

  $: load(src);
  $: label = caption ?? alt ?? "";
</script>

{#if missing}
  <p class="text-sm" style="color: var(--ink-soft)">Missing sketch: {src}</p>
{:else if markup}
  <figure class={cn("sketch-figure", isCourseMap && "course-map", className)}>
    <!-- A focusable overflow region lets keyboard users pan a wide diagram. -->
    <!-- svelte-ignore a11y-no-noninteractive-tabindex -->
    <div
      class:course-map-viewport={isCourseMap}
      role={isCourseMap ? "region" : undefined}
      tabindex={isCourseMap ? 0 : undefined}
      aria-label={isCourseMap ? "Scrollable teaching diagram" : undefined}
    >
      <div class="sketch-sheet">
        {@html markup}
      </div>
    </div>
    {#if isCourseMap}
      <p class="course-map-hint" aria-hidden="true">
        Swipe or scroll to explore the whole map →
      </p>
    {/if}
    {#if label}
      <figcaption>{label}</figcaption>
    {/if}
  </figure>
{/if}

<style>
  :global(.mdsvex) .sketch-figure.course-map {
    width: min(60rem, calc(100vw - 3rem));
    max-width: none;
    margin-left: 50%;
    transform: translateX(-50%);
  }

  .course-map-viewport {
    max-width: 100%;
    overflow-x: auto;
    overscroll-behavior-inline: contain;
    scrollbar-width: thin;
  }

  .course-map-hint {
    display: none;
    margin: 0.5rem 0 0;
    font-family: "Geist Mono", ui-monospace, monospace;
    font-size: 0.64rem;
    letter-spacing: 0.04em;
    color: var(--ink-soft);
    text-align: right;
  }

  @media (max-width: 44rem) {
    :global(.mdsvex) .sketch-figure.course-map {
      width: 100%;
      max-width: 100%;
      margin-left: 0;
      transform: none;
    }

    .course-map :global(.sketch-sheet) {
      min-width: 47rem;
    }

    .course-map-hint {
      display: block;
    }
  }
</style>
