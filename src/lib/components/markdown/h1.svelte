<script lang="ts">
	import { cn } from '$lib/utils';

	let className: string | undefined | null = undefined;
	export { className as class };
</script>

<h1 class={cn('mt-12 text-2xl leading-snug first:mt-0', className)} {...$$restProps}>
	<slot />
</h1>
