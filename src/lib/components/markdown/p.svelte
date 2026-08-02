<script lang="ts">
	import { cn } from '$lib/utils';

	let className: string | undefined | null = undefined;
	export { className as class };
</script>

<p
	class={cn('text-[length:inherit] leading-[inherit] [&:not(:first-child)]:mt-[1.15em]', className)}
	{...$$restProps}
>
	<slot />
</p>
