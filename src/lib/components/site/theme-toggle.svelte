<script lang="ts">
	import { mode, setMode } from 'mode-watcher';
	import { theme } from '$lib/stores';

	function toggle() {
		const next = $mode === 'dark' ? 'light' : 'dark';
		$theme = next;
		setMode(next);
	}
</script>

<button
	type="button"
	on:click={toggle}
	class="icon-btn no-highlight"
	aria-label="Toggle colour theme"
	title="Toggle colour theme"
>
	<svg
		xmlns="http://www.w3.org/2000/svg"
		viewBox="0 0 24 24"
		fill="none"
		stroke="currentColor"
		stroke-width="1.5"
		stroke-linecap="round"
		stroke-linejoin="round"
		class="h-[17px] w-[17px]"
		aria-hidden="true"
	>
		<circle cx="12" cy="12" r="7" />
		<path d="M12 5a7 7 0 0 0 0 14z" class="fill-current dark:hidden" />
		<path d="M12 5a7 7 0 0 1 0 14z" class="hidden fill-current dark:block" />
	</svg>
</button>

<style>
	.icon-btn {
		display: inline-flex;
		align-items: center;
		justify-content: center;
		padding: 4px;
		color: var(--ink-soft);
		transition: color 0.2s ease;
		background: transparent;
		border: 0;
		cursor: pointer;
	}

	.icon-btn:hover {
		color: var(--ink);
	}
</style>
