import { error } from "@sveltejs/kit";
import type { PageLoad } from "./$types";

export const load: PageLoad = async ({ params, data }) => {
  let post;

  try {
    post = await import(`../../../../posts/${params.slug}/page.md`);
  } catch (e) {
    throw error(404, "Post not found");
  }

  return {
    ...data,
    content: post.default,
    // The server has already authorized the slug and supplied serializable metadata.
    slug: data.slug,
  };
};
