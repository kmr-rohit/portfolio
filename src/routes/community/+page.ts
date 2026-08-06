import { redirect } from '@sveltejs/kit';
import type { PageLoad } from './$types';

/** Old Community URL — keep bookmarks working. */
export const load: PageLoad = () => {
	throw redirect(301, '/opensource');
};
