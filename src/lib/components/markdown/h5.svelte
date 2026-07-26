<script lang="ts">
	import { cn } from '$lib/utils';

	let className: string | undefined | null = undefined;
	export { className as class };
</script>

<h5
	class={cn('mt-8 font-mono text-2xs uppercase tracking-label text-ink-30', className)}
	{...$$restProps}
>
	<slot />
</h5>
