<script lang="ts">
	import { site } from '$lib/config';

	const year = new Date().getFullYear();
</script>

<footer class="foot">
	<p>&copy; {site.name} {year}</p>
</footer>
