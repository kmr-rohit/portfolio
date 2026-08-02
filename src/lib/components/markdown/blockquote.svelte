<script lang="ts">
	import { cn } from '$lib/utils';

	let className: string | undefined | null = undefined;
	export { className as class };
</script>

<blockquote
	class={cn(
		'my-8 border-l border-[color:var(--hairline)] pl-5 text-[color:var(--ink)] [&>p]:mt-3 [&>p:first-child]:mt-0',
		'italic [font-family:Newsreader,Georgia,serif]',
		className
	)}
	{...$$restProps}
>
	<slot />
</blockquote>
