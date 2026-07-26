<script lang="ts">
	import { cn } from '$lib/utils';

	let className: string | undefined | null = undefined;
	export { className as class };
</script>

<p class={cn('leading-relaxed text-ink-70 [&:not(:first-child)]:mt-5', className)} {...$$restProps}>
	<slot />
</p>
