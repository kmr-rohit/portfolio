import { dev } from "$app/environment";
import { error } from "@sveltejs/kit";
import {
  KUBERNETES_SERIES_SLUG,
  getKubernetesModule,
  getKubernetesModuleNeighbors,
  isKubernetesCourseRoute,
  type KubernetesCourseModule,
} from "$lib/kubernetes-course";
import { getPost, getPosts, getSeriesPosts } from "$lib/posts";
import type { PageServerLoad } from "./$types";

export const load: PageServerLoad = async ({ params, url }) => {
  const post = getPost(params.slug, { includeDrafts: dev });
  if (!post) throw error(404, "Post not found");

  const posts = getPosts();
  const index = posts.findIndex((entry) => entry.slug === params.slug);
  let seriesNavigation = null;

  if (post.series === KUBERNETES_SERIES_SLUG && post.module !== undefined) {
    const current = getKubernetesModule(post.module);
    if (!current)
      throw error(500, `Unknown Kubernetes course module: ${post.module}`);
    if (current.slug !== params.slug || current.season !== post.season) {
      throw error(
        500,
        `Kubernetes course metadata does not match the catalog: ${params.slug}`
      );
    }

    const requestedRoute = url.searchParams.get("track");
    const route =
      isKubernetesCourseRoute(requestedRoute) &&
      (requestedRoute === "all" || current.tracks.includes(requestedRoute))
        ? requestedRoute
        : "all";
    const publishedSlugs = new Set(
      getSeriesPosts(KUBERNETES_SERIES_SLUG, { includeDrafts: dev }).map(
        (entry) => entry.slug
      )
    );
    const neighbors = getKubernetesModuleNeighbors(post.module, route);
    const publishable = (module: KubernetesCourseModule | undefined) =>
      module
        ? {
            ...module,
            slug:
              module.slug && publishedSlugs.has(module.slug)
                ? module.slug
                : undefined,
          }
        : undefined;

    seriesNavigation = {
      current,
      previous: publishable(neighbors.previous),
      next: publishable(neighbors.next),
      route,
    };
  }

  return {
    meta: post,
    slug: params.slug,
    seriesNavigation,
    // The feed is newest-first, so the previous index is the newer post.
    newer: index > 0 ? posts[index - 1] : null,
    older: index >= 0 && index < posts.length - 1 ? posts[index + 1] : null,
  };
};
