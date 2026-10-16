import { error } from "@sveltejs/kit";
import type { PageLoad } from "./$types";

export const load: PageLoad = async ({ data }) => {
  let note;

  try {
    note = await import(`../../../../../content/system-design/${data.slug}.md`);
  } catch (e) {
    throw error(404, "Note not found");
  }

  return { ...data, content: note.default };
};
