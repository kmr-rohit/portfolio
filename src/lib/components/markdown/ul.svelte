<script lang="ts">
	import { cn } from '$lib/utils';

	let className: string | undefined | null = undefined;
	export { className as class };
</script>

<ul class={cn('my-5 ml-5 list-disc space-y-2 marker:text-ink-30', className)} {...$$restProps}>
	<slot />
</ul>
