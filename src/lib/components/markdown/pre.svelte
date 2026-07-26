<script lang="ts">
	export let title = '';

	let codeElement: HTMLElement;
	let copied = false;
	let timer: ReturnType<typeof setTimeout>;

	const handleCopy = async () => {
		if (!codeElement) return;

		try {
			await navigator.clipboard.writeText(codeElement.innerText ?? '');
			copied = true;
			clearTimeout(timer);
			timer = setTimeout(() => (copied = false), 2000);
		} catch {
			// Clipboard is unavailable over http or without permission; nothing to do.
		}
	};
</script>

<div class="group relative my-8 overflow-hidden rounded border border-white/[0.08] bg-[#1b1a17]">
	{#if title}
		<div
			class="flex items-center justify-between border-b border-white/[0.08] px-4 py-2 font-mono text-2xs uppercase tracking-label text-white/40"
		>
			<span>{title}</span>
		</div>
	{/if}

	<button
		type="button"
		on:click={handleCopy}
		class="no-highlight absolute right-2 z-10 rounded px-2 py-1 font-mono text-2xs uppercase tracking-label text-white/30 opacity-0 transition hover:text-white/70 focus-visible:opacity-100 group-hover:opacity-100 {title
			? 'top-10'
			: 'top-2'}"
	>
		{copied ? 'Copied' : 'Copy'}
	</button>

	<!-- svelte-ignore a11y-no-noninteractive-tabindex -->
	<pre bind:this={codeElement} tabindex="0" {...$$restProps}><slot /></pre>
</div>
