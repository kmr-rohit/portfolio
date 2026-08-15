/**
 * Generate GitHub profile README assets (SVG + ASCII).
 *
 *   npm run github-profile
 *
 * Writes into github-profile/assets/ and static/github-profile/.
 * Copy github-profile/README.md + assets/ into kmr-rohit/kmr-rohit.
 */
import { writeFileSync, mkdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import sharp from 'sharp';

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = join(__dirname, '..');

const C = {
	bg: '#0d1117',
	panel: '#161b22',
	raised: '#1c2330',
	ink: '#e6edf3',
	muted: '#8b949e',
	faint: '#484f58',
	accent: '#6b8ef5',
	green: '#3fb950',
	yellow: '#d29922',
	red: '#f85149',
	cyan: '#56d4dd',
	orange: '#e3b341',
	hair: 'rgba(230,237,243,0.12)'
};

const FONT =
	"ui-monospace, SFMono-Regular, 'Cascadia Code', 'JetBrains Mono', Menlo, Consolas, monospace";
const SANS = "ui-sans-serif, system-ui, -apple-system, 'Segoe UI', sans-serif";

function escapeXml(s) {
	return s
		.replace(/&/g, '&amp;')
		.replace(/</g, '&lt;')
		.replace(/>/g, '&gt;')
		.replace(/"/g, '&quot;');
}

function grain(id = 'grain') {
	return `<pattern id="${id}" width="8" height="8" patternUnits="userSpaceOnUse">
      <circle cx="1" cy="2" r="0.5" fill="${C.ink}" opacity="0.035"/>
      <circle cx="5" cy="6" r="0.4" fill="${C.ink}" opacity="0.025"/>
    </pattern>`;
}

function chrome({ title, width, height, children, aria }) {
	const innerW = width - 2;
	const innerH = height - 2;
	return `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}" role="img" aria-label="${escapeXml(aria)}">
  <defs>
    ${grain()}
    <clipPath id="win"><rect x="1" y="1" width="${innerW}" height="${innerH}" rx="12"/></clipPath>
    <style>
      .fade { animation: fade 0.7s ease both; }
      .d1 { animation-delay: 0.15s; } .d2 { animation-delay: 0.35s; }
      .d3 { animation-delay: 0.55s; } .d4 { animation-delay: 0.75s; }
      .d5 { animation-delay: 0.95s; } .d6 { animation-delay: 1.15s; }
      .d7 { animation-delay: 1.35s; } .d8 { animation-delay: 1.55s; }
      .cursor { animation: blink 1.1s step-end infinite; }
      .scan { animation: scan 7s linear infinite; }
      @keyframes fade { from { opacity: 0; transform: translateY(4px); } to { opacity: 1; transform: none; } }
      @keyframes blink { 50% { opacity: 0; } }
      @keyframes scan { from { transform: translateY(-20px); } to { transform: translateY(${height}px); } }
    </style>
  </defs>
  <rect width="${width}" height="${height}" rx="12" fill="${C.bg}"/>
  <rect x="1" y="1" width="${innerW}" height="${innerH}" rx="12" fill="none" stroke="${C.hair}" stroke-width="1"/>
  <g clip-path="url(#win)">
    <rect width="${width}" height="36" fill="${C.panel}"/>
    <circle cx="22" cy="18" r="5" fill="${C.red}" opacity="0.9"/>
    <circle cx="40" cy="18" r="5" fill="${C.yellow}" opacity="0.9"/>
    <circle cx="58" cy="18" r="5" fill="${C.green}" opacity="0.9"/>
    <text x="${width / 2}" y="22" text-anchor="middle" fill="${C.muted}" font-family="${FONT}" font-size="12">${escapeXml(title)}</text>
    <line x1="1" y1="36" x2="${width - 1}" y2="36" stroke="${C.hair}"/>
    ${children}
    <rect class="scan" x="1" y="36" width="${innerW}" height="18" fill="${C.accent}" opacity="0.04"/>
    <rect width="${width}" height="${height}" fill="url(#grain)"/>
  </g>
</svg>`;
}

const ROHIT_FIGLET = [
	'  ____            _     _ _',
	' |  _ \\ ___   ___| |__ (_) |_',
	" | |_) / _ \\ / _ \\ '_ \\| | __|",
	' |  _ < (_) |  __/ | | | | |_',
	' |_| \\_\\___/ \\___|_| |_|_|\\__|'
];

function bannerSvg() {
	const figlet = ROHIT_FIGLET.map(
		(line, i) =>
			`<text xml:space="preserve" class="fade d${i + 1}" x="28" y="${72 + i * 18}" fill="${C.accent}" font-family="${FONT}" font-size="15">${escapeXml(line)}</text>`
	).join('\n    ');

	const lines = [
		{ y: 178, html: `<tspan fill="${C.green}">kmr-rohit</tspan><tspan fill="${C.muted}">@</tspan><tspan fill="${C.cyan}">oracle</tspan> <tspan fill="${C.muted}">~</tspan> <tspan fill="${C.ink}">$</tspan> <tspan fill="${C.ink}">whoami</tspan>` },
		{ y: 200, html: `<tspan fill="${C.ink}">Rohit Kumar  ·  AI engineer  ·  Bengaluru</tspan>` },
		{ y: 230, html: `<tspan fill="${C.green}">kmr-rohit</tspan><tspan fill="${C.muted}">@</tspan><tspan fill="${C.cyan}">oracle</tspan> <tspan fill="${C.muted}">~</tspan> <tspan fill="${C.ink}">$</tspan> <tspan fill="${C.ink}">head -n 4 ~/.now</tspan>` },
		{ y: 252, html: `<tspan fill="${C.yellow}">GSoC 2026</tspan><tspan fill="${C.muted}">  —  Kubeflow Docs Agent (agentic RAG + MCP)</tspan>` },
		{ y: 274, html: `<tspan fill="${C.yellow}">Oracle</tspan><tspan fill="${C.muted}">     —  Fusion SCM agents, retrieval, Kafka alerts</tspan>` },
		{ y: 296, html: `<tspan fill="${C.yellow}">Writing</tspan><tspan fill="${C.muted}">    —  vLLM, SGLang, harnesses  ·  kmrrohit.space</tspan>` },
		{ y: 318, html: `<tspan fill="${C.green}">kmr-rohit</tspan><tspan fill="${C.muted}">@</tspan><tspan fill="${C.cyan}">oracle</tspan> <tspan fill="${C.muted}">~</tspan> <tspan fill="${C.ink}">$</tspan> <tspan class="cursor" fill="${C.accent}">█</tspan>` }
	];

	const body = lines
		.map(
			(l, i) =>
				`<text class="fade d${Math.min(i + 1, 8)}" x="28" y="${l.y}" font-family="${FONT}" font-size="13">${l.html}</text>`
		)
		.join('\n    ');

	return chrome({
		title: 'kmr-rohit — whoami',
		width: 880,
		height: 348,
		aria: 'Rohit Kumar, AI engineer at Oracle, GSoC 2026 on Kubeflow',
		children: `${figlet}
    ${body}`
	});
}

async function asciiPortrait() {
	const cols = 34;
	const rows = 17;
	const charset = ' .:-=+*#%@';
	const url = 'https://github.com/kmr-rohit.png?size=400';
	const res = await fetch(url);
	if (!res.ok) throw new Error(`avatar fetch failed: ${res.status}`);
	const buf = Buffer.from(await res.arrayBuffer());
	const { data, info } = await sharp(buf)
		.resize(cols, rows, { fit: 'cover' })
		.greyscale()
		.modulate({ brightness: 1.05 })
		.raw()
		.toBuffer({ resolveWithObject: true });

	const lines = [];
	for (let y = 0; y < info.height; y++) {
		let line = '';
		for (let x = 0; x < info.width; x++) {
			const v = data[y * info.width + x];
			if (v > 230) {
				line += ' ';
				continue;
			}
			const inv = 255 - v;
			const idx = Math.min(charset.length - 1, Math.floor((inv / 255) * charset.length));
			line += charset[idx];
		}
		lines.push(line.trimEnd());
	}
	return lines;
}

function neofetchSvg(portrait) {
	const left = portrait
		.map(
			(line, i) =>
				`<text xml:space="preserve" x="24" y="${58 + i * 13}" fill="${C.accent}" font-family="${FONT}" font-size="11">${escapeXml(line)}</text>`
		)
		.join('\n    ');

	const rows = [
		['user', 'kmr-rohit'],
		['name', 'Rohit Kumar'],
		['role', 'AI engineer'],
		['host', 'Oracle · Fusion SCM'],
		['kernel', 'GSoC 2026 · Kubeflow'],
		['uptime', '2y shipping agents in prod'],
		['shell', 'Python · TypeScript'],
		['wm', 'MCP · RAG · KServe · Kafka'],
		['locale', 'Bengaluru, India'],
		['blog', 'kmrrohit.space'],
		['mail', 'rr7433446@gmail.com']
	];

	const info = rows
		.map(([k, v], i) => {
			const y = 70 + i * 20;
			return `<text class="fade d${Math.min(i + 1, 8)}" x="430" y="${y}" font-family="${FONT}" font-size="13">
      <tspan fill="${C.accent}" font-weight="700">${k}</tspan><tspan fill="${C.faint}">${'.'.repeat(Math.max(1, 12 - k.length))}</tspan><tspan fill="${C.ink}"> ${escapeXml(v)}</tspan>
    </text>`;
		})
		.join('\n    ');

	return chrome({
		title: 'neofetch — kmr-rohit',
		width: 880,
		height: 320,
		aria: 'neofetch-style GitHub profile card for Rohit Kumar',
		children: `${left}
    <text x="430" y="52" fill="${C.green}" font-family="${FONT}" font-size="13" font-weight="700">kmr-rohit</text>
    <text x="518" y="52" fill="${C.muted}" font-family="${FONT}" font-size="13">@github</text>
    <line x1="430" y1="58" x2="720" y2="58" stroke="${C.hair}"/>
    ${info}`
	});
}

function nowSvg() {
	const cards = [
		{
			x: 20,
			y: 52,
			tag: 'GSoC 2026',
			title: 'Kubeflow Docs Agent',
			body: ['Agentic RAG over docs, issues,', 'code and manifests. MCP tools,', 'Helm edge, Terraform on OKE.']
		},
		{
			x: 450,
			y: 52,
			tag: 'Oracle',
			title: 'Fusion SCM agents',
			body: ['Part matching +30% coverage.', 'Order agent: 10k+ lines/run.', 'Kafka notifier · planner RAG.']
		},
		{
			x: 20,
			y: 198,
			tag: 'Open source',
			title: 'MacBatch',
			body: ['Batch inference on idle Macs.', '252,686 embeds/hour, 2.8× from', 'shard batching. Lease scheduler.']
		},
		{
			x: 450,
			y: 198,
			tag: 'Writing',
			title: 'kmrrohit.space',
			body: ['vLLM and SGLang from the inside.', 'Context, harnesses, two clocks.', 'First-principles serving notes.']
		}
	];

	const cardSvg = cards
		.map((card, i) => {
			const lines = card.body
				.map(
					(line, li) =>
						`<text x="${card.x + 18}" y="${card.y + 78 + li * 16}" fill="${C.muted}" font-family="${FONT}" font-size="12">${escapeXml(line)}</text>`
				)
				.join('\n      ');
			return `<g class="fade d${i + 1}">
      <rect x="${card.x}" y="${card.y}" width="410" height="134" rx="10" fill="${C.raised}" stroke="${C.hair}"/>
      <rect x="${card.x}" y="${card.y}" width="4" height="134" rx="2" fill="${C.accent}"/>
      <text x="${card.x + 18}" y="${card.y + 28}" fill="${C.cyan}" font-family="${FONT}" font-size="11" letter-spacing="0.12em">${escapeXml(card.tag.toUpperCase())}</text>
      <text x="${card.x + 18}" y="${card.y + 54}" fill="${C.ink}" font-family="${SANS}" font-size="18" font-weight="600">${escapeXml(card.title)}</text>
      ${lines}
    </g>`;
		})
		.join('\n    ');

	return chrome({
		title: 'now — latest work',
		width: 880,
		height: 352,
		aria: 'Latest work: Kubeflow Docs Agent, Oracle Fusion SCM, MacBatch, writing',
		children: cardSvg
	});
}

function writingSvg() {
	const posts = [
		['Jul 2026', 'Teaching a docs agent to read the repo', 'Kubeflow · RAG'],
		['Jul 2026', 'SGLang, or a runtime that remembers', 'Serving'],
		['Jun 2026', 'Context engineering, after the window', 'Agents'],
		['May 2026', 'vLLM from the inside', 'Serving'],
		['Apr 2026', 'The harness is the product', 'Agents'],
		['Mar 2026', 'The two clocks', 'Prefill / decode']
	];

	const rows = posts
		.map(([date, title, tag], i) => {
			const y = 64 + i * 36;
			return `<g class="fade d${Math.min(i + 1, 8)}">
      <text x="28" y="${y}" fill="${C.faint}" font-family="${FONT}" font-size="12">${date}</text>
      <text x="128" y="${y}" fill="${C.ink}" font-family="${SANS}" font-size="15">${escapeXml(title)}</text>
      <text x="852" y="${y}" text-anchor="end" fill="${C.cyan}" font-family="${FONT}" font-size="11">${escapeXml(tag)}</text>
      ${i < posts.length - 1 ? `<line x1="28" y1="${y + 14}" x2="852" y2="${y + 14}" stroke="${C.hair}"/>` : ''}
    </g>`;
		})
		.join('\n    ');

	return chrome({
		title: 'cat ~/writing',
		width: 880,
		height: 292,
		aria: 'Recent writing on vLLM, SGLang, agents and RAG',
		children: rows
	});
}

function contribSvg() {
	const items = [
		['Aug 2026', 'kubeflow/internal-acls', 'Added as Kubeflow org member'],
		['Aug 2026', 'kubeflow/docs-agent #232', 'CI: GITHUB_TOKEN for GHCR, optional pull secrets'],
		['Aug 2026', 'kubeflow/docs-agent #219', 'Anonymous session-JWT auth on the public chatbot'],
		['Aug 2026', 'kubeflow/docs-agent #218', 'Istio edge → Helm gateway-guardrails (rate limit, CORS)'],
		['Jun 2026', 'kubeflow/docs-agent #210', '3-tool MCP, TEI, issues/code pipelines, OKE CI/CD'],
		['Mar 2026', 'jaiakash/deploy-kubeflow #5', 'Terraform: OKE cluster + full Kubeflow on OCI']
	];

	const rows = items
		.map(([date, repo, title], i) => {
			const y = 64 + i * 36;
			return `<g class="fade d${Math.min(i + 1, 8)}">
      <text x="28" y="${y}" fill="${C.faint}" font-family="${FONT}" font-size="12">${date}</text>
      <text x="128" y="${y}" fill="${C.accent}" font-family="${FONT}" font-size="12">${escapeXml(repo)}</text>
      <text x="390" y="${y}" fill="${C.ink}" font-family="${SANS}" font-size="14">${escapeXml(title)}</text>
      ${i < items.length - 1 ? `<line x1="28" y1="${y + 14}" x2="852" y2="${y + 14}" stroke="${C.hair}"/>` : ''}
    </g>`;
		})
		.join('\n    ');

	return chrome({
		title: 'git log --author=kmr-rohit --oneline',
		width: 880,
		height: 292,
		aria: 'Recent open-source contributions to Kubeflow and OCI Terraform',
		children: rows
	});
}

function writeBoth(name, contents) {
	const targets = [
		join(root, 'github-profile', 'assets', name),
		join(root, 'static', 'github-profile', name)
	];
	for (const path of targets) {
		mkdirSync(dirname(path), { recursive: true });
		writeFileSync(path, contents);
	}
}

async function main() {
	const portrait = await asciiPortrait();
	writeBoth('banner.svg', bannerSvg());
	writeBoth('neofetch.svg', neofetchSvg(portrait));
	writeBoth('now.svg', nowSvg());
	writeBoth('writing.svg', writingSvg());
	writeBoth('contrib.svg', contribSvg());
	writeFileSync(join(root, 'github-profile', 'assets', 'portrait.txt'), portrait.join('\n') + '\n');

	// Keep a copy of the generator outputs list for the site README table.
	console.log('github-profile assets:');
	for (const name of ['banner.svg', 'neofetch.svg', 'now.svg', 'writing.svg', 'contrib.svg']) {
		console.log('  ', name);
	}
}

main().catch((err) => {
	console.error(err);
	process.exit(1);
});
