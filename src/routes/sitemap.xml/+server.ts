import { routes, site } from '$lib/config';
import { getPosts } from '$lib/posts';
import type { RequestHandler } from './$types';

export const GET: RequestHandler = async () => {
	const posts = getPosts();

	const pages = [
		{ loc: site.url, lastmod: undefined as string | undefined },
		...routes.map((route) => ({ loc: `${site.url}${route.link}`, lastmod: undefined })),
		...posts.map((post) => ({ loc: `${site.url}/writing/${post.slug}`, lastmod: post.date }))
	];

	const urls = pages
		.map(
			({ loc, lastmod }) =>
				`	<url>\n		<loc>${loc}</loc>${lastmod ? `\n		<lastmod>${lastmod}</lastmod>` : ''}\n	</url>`
		)
		.join('\n');

	return new Response(
		`<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${urls}
</urlset>`,
		{
			headers: {
				'Content-Type': 'application/xml; charset=utf-8',
				'Cache-Control': 'max-age=0, s-maxage=3600'
			}
		}
	);
};
