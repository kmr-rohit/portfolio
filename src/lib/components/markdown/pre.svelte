<script lang="ts">
  import { getContext, onMount } from "svelte";
  import {
    markdownLabContextKey,
    type MarkdownLabContext,
  } from "$lib/components/markdown/lab-context";

  export let title = "";

  const labContext = getContext<MarkdownLabContext | undefined>(
    markdownLabContextKey
  );

  let codeElement: HTMLElement;
  let copied = false;
  let timer: ReturnType<typeof setTimeout>;
  let tooltipHovered = false;
  let tooltipFocused = false;
  let tooltipDismissed = false;

  $: isLabCommand = Boolean(
    $$restProps["data-lab-command"] && labContext?.path
  );
  $: tooltipId = `lab-tooltip-${
    $$restProps["data-lab-command-id"] ?? "source"
  }`;
  $: tooltipOpen = !tooltipDismissed && (tooltipHovered || tooltipFocused);

  const handleTooltipEnter = () => {
    tooltipHovered = true;
    tooltipDismissed = false;
  };

  const handleTooltipLeave = () => {
    tooltipHovered = false;
    if (!tooltipFocused) tooltipDismissed = false;
  };

  const handleTooltipFocus = () => {
    tooltipFocused = true;
    tooltipDismissed = false;
  };

  const handleTooltipBlur = () => {
    tooltipFocused = false;
    if (!tooltipHovered) tooltipDismissed = false;
  };

  const handleTooltipKeydown = (event: KeyboardEvent) => {
    if (event.key !== "Escape" || !tooltipOpen) return;
    tooltipDismissed = true;
    event.stopPropagation();
  };

  onMount(() => {
    if (!isLabCommand) return;

    window.addEventListener("keydown", handleTooltipKeydown);
    return () => window.removeEventListener("keydown", handleTooltipKeydown);
  });

  const handleCopy = async () => {
    if (!codeElement) return;

    try {
      await navigator.clipboard.writeText(codeElement.innerText ?? "");
      copied = true;
      clearTimeout(timer);
      timer = setTimeout(() => (copied = false), 2000);
    } catch {
      // Clipboard is unavailable over http or without permission; nothing to do.
    }
  };
</script>

<div
  class="group relative my-8 rounded-[2px] border border-white/[0.08] bg-[#14151a]"
>
  {#if title || isLabCommand}
    <div
      class="flex min-h-[2.4rem] items-center justify-between gap-3 border-b border-white/[0.08] px-3 py-1.5 font-mono text-2xs uppercase tracking-label text-white/40 sm:px-4"
    >
      <span
        >{title || "Lab command · run from the portfolio project folder"}</span
      >
      <div class="flex shrink-0 items-center gap-1.5">
        {#if isLabCommand && labContext}
          <span
            class="lab-source-wrap"
            role="group"
            aria-label="Lab source"
            on:mouseenter={handleTooltipEnter}
            on:mouseleave={handleTooltipLeave}
          >
            <a
              class="lab-source"
              href={labContext.url}
              target="_blank"
              rel="noreferrer"
              aria-label={`Open ${labContext.path} on GitHub in a new tab`}
              aria-describedby={tooltipId}
              on:focus={handleTooltipFocus}
              on:blur={handleTooltipBlur}
            >
              <svg viewBox="0 0 16 16" aria-hidden="true">
                <path
                  d="M1.75 4.5h4l1.2 1.5h7.3v6.75a1.5 1.5 0 0 1-1.5 1.5h-9.5a1.5 1.5 0 0 1-1.5-1.5V4.5Z"
                />
                <path
                  d="M1.75 4.5V3.25a1.5 1.5 0 0 1 1.5-1.5H6l1.25 1.5h5.5a1.5 1.5 0 0 1 1.5 1.5V6"
                />
              </svg>
              Files ↗
            </a>
            <span
              class:lab-tooltip-open={tooltipOpen}
              class="lab-tooltip"
              id={tooltipId}
              role="tooltip"
              aria-hidden={!tooltipOpen}
            >
              Open the exact lab folder on GitHub {labContext.pinned
                ? `at ${labContext.ref}`
                : `from ${labContext.ref}`}:
              <br />
              <code>{labContext.path}</code>
            </span>
          </span>
        {/if}
        <button type="button" on:click={handleCopy} class="header-copy">
          {copied ? "Copied" : "Copy"}
        </button>
      </div>
    </div>
  {:else}
    <button
      type="button"
      on:click={handleCopy}
      class="no-highlight absolute right-2 top-2 z-10 rounded px-2 py-1 font-mono text-2xs uppercase tracking-label text-white/30 opacity-0 transition hover:text-white/70 focus-visible:opacity-100 group-hover:opacity-100"
    >
      {copied ? "Copied" : "Copy"}
    </button>
  {/if}

  <!-- svelte-ignore a11y-no-noninteractive-tabindex -->
  <pre bind:this={codeElement} tabindex="0" {...$$restProps}><slot /></pre>
</div>

<style>
  .header-copy,
  .lab-source {
    border-radius: 2px;
    padding: 0.28rem 0.42rem;
    font-family: "Geist Mono", ui-monospace, monospace;
    font-size: 0.625rem;
    line-height: 1;
    letter-spacing: 0.08em;
    text-transform: uppercase;
    transition: color 150ms ease, background-color 150ms ease;
  }

  .header-copy {
    color: rgb(255 255 255 / 0.38);
  }

  .header-copy:hover,
  .header-copy:focus-visible {
    background: rgb(255 255 255 / 0.07);
    color: rgb(255 255 255 / 0.78);
  }

  .lab-source-wrap {
    position: relative;
    display: inline-flex;
  }

  .lab-source {
    display: inline-flex;
    align-items: center;
    gap: 0.3rem;
    border: 1px solid rgb(255 255 255 / 0.1);
    background: rgb(255 255 255 / 0.045);
    color: rgb(255 255 255 / 0.55);
    text-decoration: none !important;
  }

  .lab-source:hover,
  .lab-source:focus-visible {
    border-color: rgb(255 255 255 / 0.2);
    background: rgb(255 255 255 / 0.09);
    color: rgb(255 255 255 / 0.88);
  }

  .lab-source svg {
    width: 0.85rem;
    height: 0.85rem;
    fill: none;
    stroke: currentColor;
    stroke-linecap: round;
    stroke-linejoin: round;
    stroke-width: 1.25;
  }

  .lab-tooltip {
    position: absolute;
    top: calc(100% + 0.55rem);
    right: 0;
    z-index: 30;
    width: min(19rem, calc(100vw - 3rem));
    border: 1px solid rgb(255 255 255 / 0.12);
    border-radius: 3px;
    background: #202126;
    padding: 0.65rem 0.75rem;
    box-shadow: 0 12px 32px rgb(0 0 0 / 0.35);
    color: rgb(255 255 255 / 0.68);
    font-family: "Geist Mono", ui-monospace, monospace;
    font-size: 0.66rem;
    font-weight: 400;
    line-height: 1.5;
    letter-spacing: 0;
    text-align: left;
    text-transform: none;
    opacity: 0;
    visibility: hidden;
    transform: translateY(-3px);
    transition: opacity 120ms ease, transform 120ms ease, visibility 120ms ease;
    pointer-events: none;
  }

  .lab-tooltip code {
    color: rgb(255 255 255 / 0.9);
    font: inherit;
    overflow-wrap: anywhere;
  }

  .lab-tooltip-open {
    opacity: 1;
    visibility: visible;
    transform: translateY(0);
    pointer-events: auto;
  }
</style>
