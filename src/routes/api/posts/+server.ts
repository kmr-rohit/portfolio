import { json, type RequestHandler } from '@sveltejs/kit';
import { getPosts } from '$lib/posts';

export const GET: RequestHandler = async ({ url }) => {
	const posts = getPosts();

	if (url.searchParams.get('latest') === 'true') {
		return json(posts.slice(0, 1));
	}

	return json(posts);
};
