<script lang="ts">
	export let href: string;

	$: internal = href.startsWith('/') || href.startsWith('#');
</script>

<a
	class="link"
	{href}
	target={internal ? undefined : '_blank'}
	rel={internal ? undefined : 'noopener noreferrer'}
>
	<slot />
</a>
