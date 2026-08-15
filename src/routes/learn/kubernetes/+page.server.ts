import { dev } from "$app/environment";
import {
  isKubernetesCourseRoute,
  KUBERNETES_SERIES_SLUG,
} from "$lib/kubernetes-course";
import { getSeriesPosts } from "$lib/posts";
import type { PageServerLoad } from "./$types";

export const load: PageServerLoad = async ({ url }) => {
  const posts = getSeriesPosts(KUBERNETES_SERIES_SLUG, { includeDrafts: dev });
  const route = url.searchParams.get("track");

  return {
    publishedSlugs: posts.map((post) => post.slug),
    selectedRoute: isKubernetesCourseRoute(route) ? route : "all",
  };
};
