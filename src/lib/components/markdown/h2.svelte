<script lang="ts">
	import { cn } from '$lib/utils';

	let className: string | undefined | null = undefined;
	export { className as class };
</script>

<h2 class={cn('mt-14 text-lg leading-snug first:mt-0', className)} {...$$restProps}>
	<slot />
</h2>
