<script lang="ts">
	import { cn } from '$lib/utils';

	let className: string | undefined | null = undefined;
	export { className as class };
</script>

<h3
	class={cn(
		'mt-9 mb-2 scroll-mt-28 text-[1.02rem] font-medium leading-snug tracking-[0.02em]',
		className
	)}
	{...$$restProps}
>
	<slot />
</h3>
