import { dev } from "$app/environment";
import { error, redirect } from "@sveltejs/kit";
import { getPost, getPosts } from "$lib/posts";
import type { PageServerLoad } from "./$types";

/** Posts from the retired Kubernetes course. */
const RETIRED = new Set([
  "kubernetes-00-disposable-lab",
  "kubernetes-01-process-to-container",
]);

export const load: PageServerLoad = async ({ params }) => {
  if (RETIRED.has(params.slug)) throw redirect(308, "/learn/system-design");

  const post = getPost(params.slug, { includeDrafts: dev });
  if (!post) throw error(404, "Post not found");

  const posts = getPosts();
  const index = posts.findIndex((entry) => entry.slug === params.slug);

  return {
    meta: post,
    slug: params.slug,
    // The feed is newest-first, so the previous index is the newer post.
    newer: index > 0 ? posts[index - 1] : null,
    older: index >= 0 && index < posts.length - 1 ? posts[index + 1] : null,
  };
};
