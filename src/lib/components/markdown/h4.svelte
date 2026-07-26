<script lang="ts">
	import { cn } from '$lib/utils';

	let className: string | undefined | null = undefined;
	export { className as class };
</script>

<h4 class={cn('mt-8 text-base font-medium', className)} {...$$restProps}>
	<slot />
</h4>
