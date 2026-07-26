import adapter from '@sveltejs/adapter-vercel';
import { vitePreprocess } from '@sveltejs/kit/vite';
import { mdsvex } from '@huntabyte/mdsvex';
import { mdsvexOptions } from './mdsvex.config.js';

/** @type {import('@sveltejs/kit').Config} */
const config = {
	extensions: ['.svelte', '.md'],
	preprocess: [mdsvex(mdsvexOptions), vitePreprocess({})],

	kit: {
		/*
		 * Pinned rather than resolved through adapter-auto: the version
		 * adapter-auto installs derives the runtime from the build machine's
		 * Node version and only knows about the retired 16.x and 18.x, so it
		 * fails outright on current Vercel builders.
		 */
		adapter: adapter({ runtime: 'nodejs22.x' })
	}
};

export default config;
