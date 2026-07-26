<script lang="ts">
	import { cn } from '$lib/utils';

	let className: string | undefined | null = undefined;
	export { className as class };
</script>

<li class={cn('pl-1 leading-relaxed text-ink-70', className)} {...$$restProps}>
	<slot />
</li>
