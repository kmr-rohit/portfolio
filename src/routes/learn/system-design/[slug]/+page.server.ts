import { error } from "@sveltejs/kit";
import { getConcept, getNeighbors, getStages } from "$lib/system-design";
import type { PageServerLoad } from "./$types";

export const load: PageServerLoad = async ({ params }) => {
  const concept = getConcept(params.slug);
  if (!concept) throw error(404, "Note not found");

  const stage = getStages().find((entry) => entry.number === concept.stage);
  return {
    meta: concept,
    slug: params.slug,
    stage,
    ...getNeighbors(params.slug),
  };
};
