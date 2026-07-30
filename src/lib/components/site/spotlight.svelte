<script lang="ts">
	import { onMount } from 'svelte';

	let el: HTMLDivElement;
	let frame = 0;

	onMount(() => {
		const show = () => {
			el.style.opacity = '1';
		};
		const move = (e: PointerEvent) => {
			cancelAnimationFrame(frame);
			frame = requestAnimationFrame(() => {
				el.style.setProperty('--x', `${e.clientX}px`);
				el.style.setProperty('--y', `${e.clientY}px`);
				el.style.opacity = '1';
			});
		};

		const boot = requestAnimationFrame(show);
		window.addEventListener('pointermove', move);
		window.addEventListener('pointerdown', move);

		return () => {
			cancelAnimationFrame(boot);
			cancelAnimationFrame(frame);
			window.removeEventListener('pointermove', move);
			window.removeEventListener('pointerdown', move);
		};
	});
</script>

<div bind:this={el} class="spotlight" aria-hidden="true"></div>
