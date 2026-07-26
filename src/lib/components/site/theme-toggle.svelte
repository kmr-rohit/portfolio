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
	class="no-highlight -my-1 translate-y-[1px] text-ink-30 transition-colors hover:text-foreground"
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
		class="h-4 w-4"
		aria-hidden="true"
	>
		<!-- A single circle that fills in on dark, rather than swapping icons. -->
		<circle cx="12" cy="12" r="7" />
		<path d="M12 5a7 7 0 0 0 0 14z" class="fill-current dark:hidden" />
		<path d="M12 5a7 7 0 0 1 0 14z" class="hidden fill-current dark:block" />
	</svg>
</button>
