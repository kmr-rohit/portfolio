/**
 * Generate LinkedIn / X share cards for writing posts.
 *
 *   npm run social-cards
 *
 * Writes SVG + PNG into social/<slug>/card.{svg,png}. Copy lives beside them.
 */
import { writeFileSync, mkdirSync, readFileSync, existsSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import sharp from 'sharp';

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = join(__dirname, '..');
const siteUrl = 'https://kmrrohit.vercel.app';

const paper = '#e6e9ed';
const ink = '#1d1f22';
const soft = '#5c616a';
const accent = '#3d6ced';
const cream = '#f4f1ea';

/** @type {{ slug: string, title: string, hook: string, series: string }[]} */
const cards = [
	{
		slug: 'the-two-clocks',
		title: 'The two clocks',
		hook: 'Almost everything hard about serving an LLM comes from one fact — generation runs on two clocks.',
		series: 'LLM serving'
	},
	{
		slug: 'vllm-architecture',
		title: 'vLLM from the inside',
		hook: 'Beyond PagedAttention: the scheduler, the block pool, and the host-side tax V1 killed.',
		series: 'LLM serving'
	},
	{
		slug: 'sglang-architecture',
		title: 'SGLang, or a runtime that remembers',
		hook: 'LLM calls are not independent. A runtime that models the tree can skip work others recompute.',
		series: 'LLM serving'
	},
	{
		slug: 'the-agentic-harness',
		title: 'The harness is the product',
		hook: 'Everyone ships the same models. The loop around the model is what is actually yours.',
		series: 'Agents'
	},
	{
		slug: 'context-engineering-for-agents',
		title: 'Context engineering',
		hook: 'Million-token windows did not end context management — they changed what it is.',
		series: 'Agents'
	},
	{
		slug: 'agentic-rag-for-kubeflow',
		title: 'Teaching a docs agent to read the repo',
		hook: 'Docs-only RAG fails on infrastructure questions. Issues, code and manifests have to be tools.',
		series: 'RAG · Kubeflow'
	},
	{
		slug: 'colour-detection',
		title: 'Colour Detection',
		hook: 'A small OpenCV project that names colours from an image and returns RGB values.',
		series: 'Projects'
	},
	{
		slug: 'learning-resources',
		title: 'Learning Resources',
		hook: 'A working list of links that helped me learn DSA, systems and adjacent topics.',
		series: 'Notes'
	}
];

function escapeXml(s) {
	return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

function wrap(text, maxChars) {
	const words = text.split(/\s+/);
	const lines = [];
	let cur = '';
	for (const w of words) {
		const next = cur ? `${cur} ${w}` : w;
		if (next.length > maxChars && cur) {
			lines.push(cur);
			cur = w;
		} else {
			cur = next;
		}
	}
	if (cur) lines.push(cur);
	return lines;
}

function cardSvg({ title, hook, series, slug }) {
	const titleLines = wrap(title, 28);
	const hookLines = wrap(hook, 48);
	const url = `${siteUrl}/writing/${slug}`;

	const titleStart = 168;
	const titleGap = 58;
	const titleSvg = titleLines
		.map(
			(line, i) =>
				`<text x="72" y="${titleStart + i * titleGap}" fill="${ink}" font-family="Georgia, 'Times New Roman', serif" font-size="52" font-weight="600">${escapeXml(line)}</text>`
		)
		.join('\n  ');

	const hookStart = titleStart + titleLines.length * titleGap + 36;
	const hookSvg = hookLines
		.map(
			(line, i) =>
				`<text x="72" y="${hookStart + i * 34}" fill="${soft}" font-family="ui-sans-serif, system-ui, sans-serif" font-size="24">${escapeXml(line)}</text>`
		)
		.join('\n  ');

	return `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" width="1200" height="630" viewBox="0 0 1200 630" role="img" aria-label="${escapeXml(title)}">
  <defs>
    <pattern id="grain" width="8" height="8" patternUnits="userSpaceOnUse">
      <circle cx="1" cy="2" r="0.6" fill="${ink}" opacity="0.04"/>
      <circle cx="5" cy="6" r="0.5" fill="${ink}" opacity="0.03"/>
    </pattern>
  </defs>
  <rect width="1200" height="630" fill="${paper}"/>
  <rect width="1200" height="630" fill="url(#grain)"/>
  <rect x="28" y="28" width="1144" height="574" fill="none" stroke="${ink}" stroke-width="1.5" stroke-dasharray="7 9" opacity="0.35"/>
  <rect x="72" y="88" width="64" height="6" fill="${accent}"/>
  <text x="72" y="130" fill="${soft}" font-family="ui-sans-serif, system-ui, sans-serif" font-size="18" letter-spacing="0.14em" text-transform="uppercase">${escapeXml(series.toUpperCase())}</text>
  ${titleSvg}
  ${hookSvg}
  <line x1="72" y1="520" x2="1128" y2="520" stroke="${ink}" stroke-width="1" opacity="0.18"/>
  <text x="72" y="562" fill="${ink}" font-family="ui-sans-serif, system-ui, sans-serif" font-size="22" font-weight="600">Rohit Kumar</text>
  <text x="1128" y="562" fill="${soft}" font-family="ui-sans-serif, system-ui, sans-serif" font-size="18" text-anchor="end">${escapeXml(url.replace('https://', ''))}</text>
</svg>`;
}

async function main() {
	for (const card of cards) {
		const dir = join(root, 'social', card.slug);
		mkdirSync(dir, { recursive: true });
		const svg = cardSvg(card);
		const svgPath = join(dir, 'card.svg');
		const pngPath = join(dir, 'card.png');
		writeFileSync(svgPath, svg);
		await sharp(Buffer.from(svg)).png().toFile(pngPath);
		console.log('wrote', card.slug);
	}
	console.log('done —', cards.length, 'cards');
}

main().catch((err) => {
	console.error(err);
	process.exit(1);
});
