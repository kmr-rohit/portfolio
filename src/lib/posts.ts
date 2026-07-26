import { dev } from '$app/environment';
import { localToGithubURL } from '$lib/config';
import type { Post } from '$lib/types';

const WORDS_PER_MINUTE = 200;

const modules = import.meta.glob('/posts/*/*.md', { eager: true });
const sources = import.meta.glob('/posts/*/*.md', { eager: true, as: 'raw' });

/**
 * Prose words only. Fenced blocks are dropped rather than counted, since a
 * diagram is scanned rather than read and would otherwise inflate every
 * estimate on the serving posts.
 */
function estimateReadTime(source: string) {
	const body = source
		.replace(/^---[\s\S]*?---/, '')
		.replace(/```[\s\S]*?```/g, '')
		.trim();

	const words = body.split(/\s+/).filter(Boolean).length;
	return Math.max(1, Math.round(words / WORDS_PER_MINUTE));
}

export function getPosts(): Post[] {
	const posts: Post[] = [];

	for (const path in modules) {
		const file = modules[path];
		const slug = path.split('/').slice(2)[0];

		if (!file || typeof file !== 'object' || !('metadata' in file) || !slug) continue;

		const metadata = file.metadata as Omit<Post, 'slug'>;
		if (metadata.draft) continue;

		const source = sources[path];
		const post: Post = {
			...metadata,
			slug,
			readTime: metadata.readTime ?? (source ? estimateReadTime(source) : undefined)
		};

		if (post.image && !dev && post.image.startsWith('/')) {
			post.image = localToGithubURL({ src: post.image });
		}

		posts.push(post);
	}

	return posts.sort(
		(first, second) => new Date(second.date).getTime() - new Date(first.date).getTime()
	);
}
