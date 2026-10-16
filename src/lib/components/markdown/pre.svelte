<script lang="ts">
  export let title = "";

  let codeElement: HTMLElement;
  let copied = false;
  let timer: ReturnType<typeof setTimeout>;

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
  class="group relative my-8 max-w-full min-w-0 overflow-hidden rounded-[2px] border border-white/[0.08] bg-[#14151a]"
>
  {#if title}
    <div
      class="flex min-h-[2.4rem] items-center justify-between gap-3 border-b border-white/[0.08] px-3 py-1.5 font-mono text-2xs uppercase tracking-label text-white/40 sm:px-4"
    >
      <span class="min-w-0 truncate">{title}</span>
      <button type="button" on:click={handleCopy} class="header-copy">
        {copied ? "Copied" : "Copy"}
      </button>
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
  .header-copy {
    flex-shrink: 0;
    border-radius: 2px;
    padding: 0.28rem 0.42rem;
    font-family: "Geist Mono", ui-monospace, monospace;
    font-size: 0.625rem;
    line-height: 1;
    letter-spacing: 0.08em;
    text-transform: uppercase;
    color: rgb(255 255 255 / 0.38);
    transition: color 150ms ease, background-color 150ms ease;
  }

  .header-copy:hover,
  .header-copy:focus-visible {
    background: rgb(255 255 255 / 0.07);
    color: rgb(255 255 255 / 0.78);
  }
</style>
