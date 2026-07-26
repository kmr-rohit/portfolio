export const site = {
	name: 'Rohit Kumar',
	handle: 'rohit',
	url: 'https://kmrrohit.vercel.app',
	title: 'Rohit Kumar',
	role: 'AI engineer',
	description:
		'AI engineer working on agentic systems, retrieval and LLM serving. Oracle by day, Kubeflow maintainer via Google Summer of Code, and host of a weekly AI systems session.',
	email: 'rr7433446@gmail.com',
	location: 'Bengaluru, India'
};

export type Route = {
	name: string;
	link: string;
};

export const routes: Route[] = [
	{ name: 'Writing', link: '/writing' },
	{ name: 'Projects', link: '/projects' },
	{ name: 'Meetup', link: '/meetup' },
	{ name: 'About', link: '/about' }
];

export type Social = {
	display: string;
	href: string;
	/** Shown as the visible label in prose contexts, e.g. "kmr-rohit". */
	handle: string;
};

export const socials: Social[] = [
	{ display: 'GitHub', href: 'https://github.com/kmr-rohit', handle: 'kmr-rohit' },
	{
		display: 'LinkedIn',
		href: 'https://www.linkedin.com/in/rr7433446/',
		handle: 'in/rr7433446'
	},
	{ display: 'Email', href: 'mailto:rr7433446@gmail.com', handle: 'rr7433446@gmail.com' },
	{ display: 'Résumé', href: '/Rohit Kumar.pdf', handle: 'PDF' }
];

export const githubConfig = {
	username: 'kmr-rohit',
	repo: 'portfolio',
	branch: 'main'
};

/**
 * Comments only render once both ids are filled in from the giscus setup page,
 * so an unconfigured install shows nothing rather than a broken widget.
 */
export const giscus = {
	repo: 'kmr-rohit/portfolio',
	repoId: '',
	category: 'General',
	categoryId: ''
};

export const commentsEnabled = Boolean(giscus.repoId && giscus.categoryId);

export const localToGithubURL = ({ src }: { src: string }) => {
	return `https://raw.githubusercontent.com/${githubConfig.username}/${githubConfig.repo}/${githubConfig.branch}${src}`;
};
