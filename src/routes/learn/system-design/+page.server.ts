import { getConcepts, getStages } from "$lib/system-design";
import type { PageServerLoad } from "./$types";

export const load: PageServerLoad = async () => {
  const concepts = getConcepts();
  return {
    stages: getStages(),
    totals: {
      concepts: concepts.length,
      diagrams: concepts.reduce((sum, concept) => sum + concept.diagrams, 0),
      hours: Math.round(concepts.reduce((sum, concept) => sum + concept.readTime, 0) / 60),
    },
  };
};
