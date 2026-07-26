<script lang="ts">
	import { cn } from '$lib/utils';

	let className: string | undefined | null = undefined;
	export { className as class };
</script>

<blockquote
	class={cn(
		'my-8 border-l pl-5 text-ink-50 [&>p]:mt-3 [&>p:first-child]:mt-0',
		className
	)}
	{...$$restProps}
>
	<slot />
</blockquote>
