<script lang="ts">
	import { cn } from '$lib/utils';

	let className: string | undefined | null = undefined;
	export { className as class };
</script>

<h3 class={cn('mt-10 text-base font-medium', className)} {...$$restProps}>
	<slot />
</h3>
