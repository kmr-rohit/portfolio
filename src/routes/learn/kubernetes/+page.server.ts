import { redirect } from "@sveltejs/kit";

// The Kubernetes course was retired; keep old links landing somewhere useful.
export const load = () => {
  throw redirect(308, "/learn/system-design");
};
