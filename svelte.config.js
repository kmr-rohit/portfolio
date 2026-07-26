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
		 * The runtime has to be stated outright: left to itself the adapter
		 * infers it from the build machine's Node version and only recognises
		 * 16, 18 and 20, so it throws on a Node 24 builder. Keep this major in
		 * step with `engines.node` in package.json.
		 */
		adapter: adapter({ runtime: 'nodejs24.x' })
	}
};

export default config;
