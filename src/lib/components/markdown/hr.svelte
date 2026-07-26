<script lang="ts">
	import { cn } from '$lib/utils';

	let className: string | undefined | null = undefined;
	export { className as class };
</script>

<hr class={cn('rule my-12', className)} {...$$restProps} />
