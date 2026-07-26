import { redirect } from '@sveltejs/kit';

/** The blog moved to /writing; keep old links alive. */
export const load = () => {
	throw redirect(308, '/writing');
};
