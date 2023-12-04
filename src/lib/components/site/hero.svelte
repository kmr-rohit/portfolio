<script>
	import ProfilePicture from '$lib/assets/profile_picture.jpg';
	import { SocialButtons } from '$lib/components/site';
</script>

<div class="md:container">
	<div class="md:flex md:flex-row items-center justify-between mt-5">
		<!-- Image for mobile devices -->
		<img
			src={ProfilePicture}
			alt="Rohit Kumar"
			class="block md:hidden mx-auto rounded-full h-40 w-40"
		/>

		<div class="space-y-4 md:w-1/2 md:mr-4">
			<h1 class="md:text-xl font-bold">Hi  👋, I'm</h1>
			<h1 class="text-blue-300 text-6xl md:text-5xl font-bold">Rohit Kumar</h1>
			<p class="text-2xl">
				A software developer from India. I specialize in <b class="text-red-400">Javascript</b>, <b class="text-green-400">Java</b>, and <b class="text-blue-400">Full stack
				development</b>. I’m upcoming Application Developer <b class="text-red-600">@ORACLE</b>. In my free
				time, I enjoy playing badminton 🏸 , writing technical blogs 🧑‍💻 and sharing my journey with others. If you'd like to
				get in touch, feel free to reach out to me.
			</p>
			<SocialButtons />
		</div>

		<img
			src={ProfilePicture}
			alt="Rohit Kumar"
			class="hidden md:block rounded-full h-28 w-28 md:h-64 md:w-64 md:self-center"
		/>
	</div>
</div>
