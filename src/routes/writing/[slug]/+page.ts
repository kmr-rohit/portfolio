import { error } from '@sveltejs/kit';
import type { Post } from '$lib/types';
import type { PageLoad } from './$types';

export const load: PageLoad = async ({ params, fetch }) => {
	let post;

	try {
		post = await import(`../../../../posts/${params.slug}/page.md`);
	} catch (e) {
		throw error(404, 'Post not found');
	}

	const posts: Post[] = await (await fetch('/api/posts')).json();
	const index = posts.findIndex((entry) => entry.slug === params.slug);

	return {
		content: post.default,
		meta: post.metadata as Omit<Post, 'slug'>,
		slug: params.slug,
		// The feed is newest-first, so the previous index is the newer post.
		newer: index > 0 ? posts[index - 1] : null,
		older: index >= 0 && index < posts.length - 1 ? posts[index + 1] : null
	};
};
