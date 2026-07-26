<script lang="ts">
	import { cn } from '$lib/utils';

	let className: string | undefined | null = undefined;
	export { className as class };
</script>

<ol class={cn('my-5 ml-5 list-decimal space-y-2 marker:text-ink-30', className)} {...$$restProps}>
	<slot />
</ol>
