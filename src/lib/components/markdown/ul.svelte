<script lang="ts">
	import { cn } from '$lib/utils';

	let className: string | undefined | null = undefined;
	export { className as class };
</script>

<ul
	class={cn(
		'my-6 ml-[1.15rem] list-disc space-y-2.5 marker:text-[color:var(--ink-soft)]',
		className
	)}
	{...$$restProps}
>
	<slot />
</ul>
