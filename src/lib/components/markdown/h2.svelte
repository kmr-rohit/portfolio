<script lang="ts">
	import { cn } from '$lib/utils';

	let className: string | undefined | null = undefined;
	export { className as class };
</script>

<h2
	class={cn(
		'mt-[2.75rem] mb-3 scroll-mt-28 text-[1.15rem] font-normal leading-snug tracking-[0.03em] first:mt-0 sm:text-[1.25rem]',
		className
	)}
	{...$$restProps}
>
	<slot />
</h2>
