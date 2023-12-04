import type { TechStack } from './components/site';

export type ProjectType = {
	title: string;
	featured?: boolean,
	href: string;
	image: string;
	description: string;
	techstack: TechStack[];

};

export const projects: ProjectType[] = [
	{
		title: 'Personal Portfolio with Markdown Blog',
		description:
			'This website, is my personal website with a markdown blog written in SvelteKit and deployed using Vercel. Styled using Taiwind CSS and Shadcn-UI and completely written in TypeScript.',
		href: 'https://kmrrohit.vercel.app',
		image: '/sveltekit-portfolio.png',
		techstack: ['SvelteKit', 'Tailwind', 'TypeScript']
	},
	{
		title: 'CodeNitw',
		description:
			'Website built for students of NITW to help them prepare for placements. It has a user-friendly interface, and Firebase Database Management. Retrieved leaderboard data through the Codeforces-API',
		href: 'https://codenitw.vercel.app',
		image: '/codenitw.png',
		techstack: ['React', 'JavaScript', 'Firebase', 'Tailwind'],
		featured: true
	},
	{
		title: 'Drifty',
		description:
			'Drifty is an open-source interactive File Downloader system built using Java.It is both available in Command-line Interface (CLI) and Graphical User Interface (GUI) mode.Updated Main files for GUI & CLI, in order to check Updates.Download the latest available update using GitHub API.',
		href: 'https://saptarshisarkar12.github.io/Drifty/',
		image: '/Drifty.png',
		techstack: ['Java'],
		featured: true
	},
	{
		title: 'Leetcode-API',
		description:
			'LeetCode provides graphql query api. This is public api. But querying graphql little bit messy. So I have created this to easily get desired data.I have added query to fetch Recent Submission along with all you have.Add your leetcode username to last of url to get your data.',
		href: 'https://leetcode-api-sooty.vercel.app/',
		image: '/Leetcodeapi.png',
		techstack: ['JavaScript']
	},

	
];
