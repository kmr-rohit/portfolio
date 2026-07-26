import { site } from '$lib/config';
import { getPosts } from '$lib/posts';
import type { RequestHandler } from './$types';

const escape = (value: string) =>
	value
		.replace(/&/g, '&amp;')
		.replace(/</g, '&lt;')
		.replace(/>/g, '&gt;')
		.replace(/"/g, '&quot;');

export const GET: RequestHandler = async () => {
	const posts = getPosts();

	const items = posts
		.map((post) => {
			const url = `${site.url}/writing/${post.slug}`;
			return `		<item>
			<title>${escape(post.title)}</title>
			<link>${url}</link>
			<guid isPermaLink="true">${url}</guid>
			<description>${escape(post.description ?? '')}</description>
			<pubDate>${new Date(post.date.replaceAll('-', '/')).toUTCString()}</pubDate>
		</item>`;
		})
		.join('\n');

	const feed = `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0" xmlns:atom="http://www.w3.org/2005/Atom">
	<channel>
		<title>${escape(site.name)}</title>
		<link>${site.url}</link>
		<description>${escape(site.description)}</description>
		<language>en</language>
		<atom:link href="${site.url}/rss.xml" rel="self" type="application/rss+xml" />
${items}
	</channel>
</rss>`;

	return new Response(feed, {
		headers: {
			'Content-Type': 'application/rss+xml; charset=utf-8',
			'Cache-Control': 'max-age=0, s-maxage=3600'
		}
	});
};
