export type Post = {
	title: string;
	slug: string;
	description: string;
	date: string;
	tags: string[];
	/** Minutes, taken from frontmatter and shown next to the title in listings. */
	readTime?: number;
	image?: string;
	draft: boolean;
};
