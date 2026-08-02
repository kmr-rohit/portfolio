/**
 * Generate Excalidraw-style sketch SVGs with Rough.js.
 *
 *   npm run sketches
 *
 * Labels default to large + bold for readability on the essay page.
 */
import { writeFileSync, mkdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { JSDOM } from 'jsdom';
import rough from 'roughjs';

const __dirname = dirname(fileURLToPath(import.meta.url));
const outDirs = [
	join(__dirname, '../static/sketches'),
	join(__dirname, '../src/lib/sketches')
];
for (const dir of outDirs) mkdirSync(dir, { recursive: true });

const FONT = "Architects Daughter, 'Segoe Print', 'Comic Sans MS', cursive";
const SIZE = 20;
const TITLE = 24;
const SMALL = 17;
const GAP = 24;

const ink = '#1d1f22';
const muted = '#3f444c';
const purple = '#b7a0e0';
const yellow = '#e8d48b';
const blue = '#9bb7e8';
const red = '#e0a0a8';
const grey = '#c5c8ce';
const green = '#a8d4b8';
const pink = '#e8b4bc';
const paper = '#f7f5f0';
const accent = '#3d6ced';

function createSvg(width, height, aria) {
	const dom = new JSDOM('<!DOCTYPE html><html><body></body></html>');
	const { document } = dom.window;
	const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
	svg.setAttribute('xmlns', 'http://www.w3.org/2000/svg');
	svg.setAttribute('width', String(width));
	svg.setAttribute('height', String(height));
	svg.setAttribute('viewBox', `0 0 ${width} ${height}`);
	svg.setAttribute('role', 'img');
	if (aria) svg.setAttribute('aria-label', aria);

	const bg = document.createElementNS('http://www.w3.org/2000/svg', 'rect');
	bg.setAttribute('width', '100%');
	bg.setAttribute('height', '100%');
	bg.setAttribute('fill', paper);
	svg.appendChild(bg);

	const style = document.createElementNS('http://www.w3.org/2000/svg', 'style');
	style.textContent = `@import url('https://fonts.googleapis.com/css2?family=Architects+Daughter&display=swap'); text{font-family:${FONT}; font-weight:700;}`;
	svg.appendChild(style);

	const rc = rough.svg(svg, {
		options: { roughness: 1.25, bowing: 1.05, stroke: ink, strokeWidth: 1.7 }
	});
	return { document, svg, rc };
}

function label(document, svg, text, x, y, opts = {}) {
	const el = document.createElementNS('http://www.w3.org/2000/svg', 'text');
	el.setAttribute('x', String(x));
	el.setAttribute('y', String(y));
	el.setAttribute('fill', opts.fill ?? ink);
	el.setAttribute('font-family', FONT);
	el.setAttribute('font-size', String(opts.size ?? SIZE));
	el.setAttribute('font-weight', opts.weight ?? '700');
	if (opts.anchor) el.setAttribute('text-anchor', opts.anchor);
	el.textContent = text;
	svg.appendChild(el);
}

function multiline(document, svg, lines, x, y, opts = {}) {
	const g = document.createElementNS('http://www.w3.org/2000/svg', 'text');
	g.setAttribute('x', String(x));
	g.setAttribute('y', String(y));
	g.setAttribute('fill', opts.fill ?? ink);
	g.setAttribute('font-family', FONT);
	g.setAttribute('font-size', String(opts.size ?? SIZE));
	g.setAttribute('font-weight', opts.weight ?? '700');
	if (opts.anchor) g.setAttribute('text-anchor', opts.anchor);
	lines.forEach((line, i) => {
		const t = document.createElementNS('http://www.w3.org/2000/svg', 'tspan');
		t.setAttribute('x', String(x));
		t.setAttribute('dy', i === 0 ? '0' : String(opts.gap ?? GAP));
		t.textContent = line;
		g.appendChild(t);
	});
	svg.appendChild(g);
}

function box(rc, svg, x, y, w, h, opts = {}) {
	svg.appendChild(
		rc.rectangle(x, y, w, h, {
			roughness: 1.3,
			bowing: 1.1,
			stroke: opts.stroke ?? ink,
			strokeWidth: opts.strokeWidth ?? 1.7,
			fill: opts.fill,
			fillStyle: opts.fillStyle ?? 'cross-hatch',
			hachureGap: opts.hachureGap ?? 6,
			hachureAngle: opts.hachureAngle ?? 50,
			fillWeight: opts.fillWeight ?? 1.15
		})
	);
}

function arrow(rc, svg, x1, y1, x2, y2, opts = {}) {
	svg.appendChild(
		rc.line(x1, y1, x2, y2, {
			stroke: opts.stroke ?? muted,
			strokeWidth: opts.strokeWidth ?? 1.6,
			roughness: 1.15,
			strokeLineDash: opts.dashed ? [7, 6] : undefined
		})
	);
	const angle = Math.atan2(y2 - y1, x2 - x1);
	const len = 9;
	svg.appendChild(
		rc.linearPath(
			[
				[x2 + Math.cos(angle + Math.PI * 0.82) * len, y2 + Math.sin(angle + Math.PI * 0.82) * len],
				[x2, y2],
				[x2 + Math.cos(angle - Math.PI * 0.82) * len, y2 + Math.sin(angle - Math.PI * 0.82) * len]
			],
			{ stroke: opts.stroke ?? muted, strokeWidth: opts.strokeWidth ?? 1.6, roughness: 1 }
		)
	);
}

function save(name, svg) {
	const html = svg.outerHTML;
	for (const dir of outDirs) {
		const path = join(dir, name);
		writeFileSync(path, html);
		console.log('wrote', path.replace(/.*portfolio\//, ''));
	}
}

/* ── existing core diagrams (refreshed type) ─────────────────────── */

function sketchPrefillDecodeKv() {
	const { document, svg, rc } = createSvg(
		760,
		540,
		'Prefill caches Keys and Values; decode restores them from the KV-cache'
	);
	label(document, svg, 'Step 1 — Prefill', 40, 40, { size: TITLE });

	box(rc, svg, 40, 60, 120, 78, { fill: purple });
	label(document, svg, 'Queries', 100, 96, { anchor: 'middle' });
	label(document, svg, 'Q', 100, 120, { anchor: 'middle', size: SMALL, fill: muted });

	label(document, svg, '×', 172, 108, { size: 24, anchor: 'middle' });

	box(rc, svg, 192, 60, 120, 78, { fill: yellow });
	label(document, svg, 'Keysᵀ', 252, 96, { anchor: 'middle' });
	label(document, svg, 'K', 252, 120, { anchor: 'middle', size: SMALL, fill: muted });

	label(document, svg, '×', 324, 108, { size: 24, anchor: 'middle' });

	box(rc, svg, 344, 60, 120, 78, { fill: blue });
	label(document, svg, 'Values', 404, 96, { anchor: 'middle' });
	label(document, svg, 'V', 404, 120, { anchor: 'middle', size: SMALL, fill: muted });

	label(document, svg, '=', 476, 108, { size: 24, anchor: 'middle' });

	box(rc, svg, 496, 60, 120, 78, { fill: red });
	label(document, svg, 'Results', 556, 96, { anchor: 'middle' });
	label(document, svg, 'O', 556, 120, { anchor: 'middle', size: SMALL, fill: muted });

	box(rc, svg, 630, 58, 110, 82, { fill: blue, fillStyle: 'hachure', hachureGap: 5 });
	multiline(document, svg, ['Causal', 'attention', 'scores'], 685, 88, {
		anchor: 'middle',
		size: SMALL,
		gap: 18
	});

	arrow(rc, svg, 252, 142, 320, 198);
	arrow(rc, svg, 404, 142, 390, 198);
	label(document, svg, 'Caching K', 268, 178, { size: SMALL, fill: muted });
	label(document, svg, 'Caching V', 410, 178, { size: SMALL, fill: muted });

	box(rc, svg, 230, 208, 300, 54, { fill: grey, hachureGap: 5 });
	label(document, svg, 'KV-cache', 380, 242, { anchor: 'middle', size: TITLE });

	label(document, svg, 'Step N — Decode', 40, 310, { size: TITLE });

	box(rc, svg, 40, 330, 58, 78, { fill: purple });
	label(document, svg, 'Q', 69, 376, { anchor: 'middle' });

	label(document, svg, '×', 116, 376, { size: 24, anchor: 'middle' });

	box(rc, svg, 136, 330, 168, 78, { fill: yellow });
	box(rc, svg, 136, 330, 104, 78, { fill: grey, hachureGap: 5 });
	label(document, svg, 'K_prev', 188, 366, { anchor: 'middle', size: SMALL });
	label(document, svg, 'K_new', 274, 376, { anchor: 'middle', size: SMALL });

	label(document, svg, '×', 322, 376, { size: 24, anchor: 'middle' });

	box(rc, svg, 342, 330, 168, 78, { fill: blue });
	box(rc, svg, 342, 330, 104, 78, { fill: grey, hachureGap: 5 });
	label(document, svg, 'V_prev', 394, 366, { anchor: 'middle', size: SMALL });
	label(document, svg, 'V_new', 480, 376, { anchor: 'middle', size: SMALL });

	label(document, svg, '=', 530, 376, { size: 24, anchor: 'middle' });

	box(rc, svg, 550, 330, 58, 78, { fill: red });
	label(document, svg, 'O', 579, 376, { anchor: 'middle' });

	arrow(rc, svg, 320, 266, 210, 326, { dashed: true });
	arrow(rc, svg, 390, 266, 420, 326, { dashed: true });
	label(document, svg, 'restore K', 176, 300, { size: SMALL, fill: muted });
	label(document, svg, 'restore V', 430, 300, { size: SMALL, fill: muted });

	label(
		document,
		svg,
		'Prefill writes the cache once. Decode reads it back and only appends the new token.',
		40,
		460,
		{ size: SMALL, fill: muted }
	);
	save('prefill-decode-kv.svg', svg);
}

function sketchFragmentation() {
	const { document, svg, rc } = createSvg(760, 440, 'External fragmentation in contiguous allocation');
	label(document, svg, 'Memory allocation & external fragmentation', 40, 40, { size: TITLE });

	box(rc, svg, 40, 60, 78, 26, { fill: pink, hachureGap: 4.5 });
	label(document, svg, 'Allocated', 130, 80);
	box(rc, svg, 250, 60, 78, 26, { fill: green, hachureGap: 4.5 });
	label(document, svg, 'Free', 340, 80);

	const rows = [
		{ y: 120, label: 'Initial: 128 B free', segs: [[0, 128, 'free']] },
		{
			y: 170,
			label: 'Request 1 (32 B)',
			segs: [
				[0, 32, 'used'],
				[32, 96, 'free']
			]
		},
		{
			y: 220,
			label: 'Request 2 (16 B)',
			segs: [
				[0, 32, 'used'],
				[32, 31, 'free'],
				[63, 16, 'used'],
				[79, 49, 'free']
			]
		},
		{
			y: 270,
			label: 'Request 3 (8 B)',
			segs: [
				[0, 32, 'used'],
				[32, 8, 'used'],
				[40, 23, 'free'],
				[63, 16, 'used'],
				[79, 49, 'free']
			]
		},
		{
			y: 320,
			label: 'Request 4 — stuck',
			segs: [
				[0, 32, 'used'],
				[32, 8, 'used'],
				[40, 23, 'free'],
				[63, 16, 'used'],
				[79, 49, 'free']
			],
			frag: true
		}
	];
	const ox = 210;
	const scale = 3.8;
	for (const row of rows) {
		label(document, svg, row.label, 40, row.y + 22, { size: SMALL, fill: muted });
		for (const [start, len, kind] of row.segs) {
			box(rc, svg, ox + start * scale, row.y, len * scale, 32, {
				fill: kind === 'used' ? pink : green,
				hachureGap: 4.5
			});
		}
		if (row.frag) {
			svg.appendChild(
				rc.line(ox + 40 * scale, row.y + 40, ox + 63 * scale, row.y + 40, {
					stroke: accent,
					strokeWidth: 1.8,
					roughness: 1
				})
			);
			label(document, svg, 'holes too small', ox + 42 * scale, row.y + 60, {
				size: SMALL,
				fill: accent
			});
		}
	}
	label(document, svg, '0', ox, 390, { size: SMALL, fill: muted });
	label(document, svg, '127', ox + 128 * scale, 390, { size: SMALL, fill: muted, anchor: 'end' });
	label(document, svg, 'Plenty of free bytes — just not in one contiguous run.', 40, 420, {
		size: SMALL,
		fill: muted
	});
	save('external-fragmentation.svg', svg);
}

function sketchTwoClocks() {
	const { document, svg, rc } = createSvg(760, 360, 'Prefill is compute-bound; decode is memory-bound');
	label(document, svg, 'The two clocks', 40, 40, { size: TITLE });

	box(rc, svg, 40, 70, 320, 240, { fill: '#dfe8f6', fillStyle: 'hachure', hachureGap: 8 });
	label(document, svg, 'PREFILL', 200, 110, { anchor: 'middle', size: TITLE });
	multiline(
		document,
		svg,
		['one pass · all tokens', 'large dense GEMMs', 'tensor cores busy', '', 'bounded by FLOPs', '→ TTFT'],
		200,
		150,
		{ anchor: 'middle', gap: 24 }
	);

	box(rc, svg, 400, 70, 320, 240, { fill: '#f3e4d4', fillStyle: 'hachure', hachureGap: 8 });
	label(document, svg, 'DECODE', 560, 110, { anchor: 'middle', size: TITLE });
	multiline(
		document,
		svg,
		['many passes · one token', 'skinny matvecs', 're-read weights + KV', '', 'bounded by BANDWIDTH', '→ ITL'],
		560,
		150,
		{ anchor: 'middle', gap: 24 }
	);
	save('two-clocks.svg', svg);
}

function sketchVllmSplit() {
	const { document, svg, rc } = createSvg(760, 380, 'vLLM V1 API server and EngineCore process split');
	label(document, svg, 'vLLM V1 process split', 40, 40, { size: TITLE });

	box(rc, svg, 60, 70, 640, 100, { fill: purple, hachureGap: 7 });
	label(document, svg, 'API server process', 380, 112, { anchor: 'middle', size: TITLE });
	label(document, svg, 'HTTP · tokenize · multimodal · detokenize', 380, 142, {
		anchor: 'middle',
		size: SMALL,
		fill: muted
	});

	arrow(rc, svg, 380, 176, 380, 214);
	label(document, svg, 'ZeroMQ IPC', 396, 202, { size: SMALL, fill: muted });

	box(rc, svg, 60, 220, 640, 120, { fill: blue, hachureGap: 7 });
	label(document, svg, 'EngineCore process', 380, 260, { anchor: 'middle', size: TITLE });
	label(document, svg, 'Scheduler  →  KVCacheManager  →  block pool', 380, 292, {
		anchor: 'middle'
	});
	label(document, svg, 'ModelExecutor  →  Worker(s)  →  attention backend', 380, 320, {
		anchor: 'middle'
	});
	save('vllm-process-split.svg', svg);
}

function sketchBlockPool() {
	const { document, svg, rc } = createSvg(760, 320, 'GPU memory carved into a fixed pool of KV blocks');
	label(document, svg, 'KV block pool', 40, 40, { size: TITLE });

	box(rc, svg, 40, 80, 170, 170, { fill: grey, hachureGap: 6 });
	multiline(document, svg, ['model', 'weights'], 125, 155, { anchor: 'middle', gap: 24 });

	box(rc, svg, 230, 80, 130, 170, { fill: yellow, hachureGap: 6 });
	multiline(document, svg, ['activation', 'peak'], 295, 155, { anchor: 'middle', gap: 24 });

	const colors = [purple, blue, green, pink, yellow, grey, purple, blue];
	colors.forEach((c, i) => {
		const x = 390 + i * 42;
		box(rc, svg, x, 100, 36, 130, { fill: c, hachureGap: 5 });
		label(document, svg, `b${i}`, x + 18, 250, { anchor: 'middle', size: SMALL, fill: muted });
	});
	label(document, svg, 'KV cache → fixed blocks (e.g. 16 tokens each)', 390, 80, { size: SMALL });
	label(document, svg, 'free-block queue: [b3, b6, b1, …]', 390, 280, { size: SMALL, fill: muted });
	save('kv-block-pool.svg', svg);
}

function sketchPrefixCache() {
	const { document, svg, rc } = createSvg(
		760,
		300,
		'Shared system-prompt blocks are reference-counted across requests'
	);
	label(document, svg, 'Prefix caching', 40, 40, { size: TITLE });

	label(document, svg, 'request 1', 40, 118, { size: SMALL, fill: muted });
	box(rc, svg, 150, 85, 300, 55, { fill: blue, hachureGap: 6 });
	label(document, svg, 'system prompt …………', 300, 120, { anchor: 'middle' });
	box(rc, svg, 470, 85, 240, 55, { fill: purple, hachureGap: 6 });
	label(document, svg, 'user question A', 590, 120, { anchor: 'middle' });

	label(document, svg, 'request 2', 40, 208, { size: SMALL, fill: muted });
	box(rc, svg, 150, 175, 300, 55, { fill: blue, hachureGap: 6 });
	label(document, svg, 'system prompt …………', 300, 210, { anchor: 'middle' });
	box(rc, svg, 470, 175, 240, 55, { fill: yellow, hachureGap: 6 });
	label(document, svg, 'user question B', 590, 210, { anchor: 'middle' });

	svg.appendChild(
		rc.line(150, 155, 450, 155, { stroke: accent, strokeWidth: 2, roughness: 1.1 })
	);
	label(document, svg, 'same physical blocks · refcounted', 300, 152, {
		anchor: 'middle',
		size: SMALL,
		fill: accent
	});
	save('prefix-cache.svg', svg);
}

function sketchHarnessLoop() {
	const { document, svg, rc } = createSvg(700, 380, 'Agent harness loop around the model call');
	label(document, svg, 'The harness is every box except one', 40, 40, { size: TITLE });

	const nodes = [
		{ x: 40, y: 80, t: ['assemble', 'context'], c: yellow },
		{ x: 240, y: 80, t: ['model', 'call'], c: purple },
		{ x: 440, y: 80, t: ['parse', 'intent'], c: blue },
		{ x: 240, y: 230, t: ['execute', 'tool'], c: green },
		{ x: 440, y: 230, t: ['observe'], c: pink }
	];
	for (const n of nodes) {
		box(rc, svg, n.x, n.y, 140, 80, { fill: n.c, hachureGap: 6 });
		n.t.forEach((line, i) =>
			label(document, svg, line, n.x + 70, n.y + 36 + i * 24, { anchor: 'middle' })
		);
	}
	arrow(rc, svg, 182, 120, 238, 120);
	arrow(rc, svg, 382, 120, 438, 120);
	arrow(rc, svg, 510, 164, 510, 228);
	arrow(rc, svg, 440, 270, 382, 270);
	arrow(rc, svg, 240, 270, 110, 270);
	arrow(rc, svg, 110, 270, 110, 160);
	arrow(rc, svg, 110, 160, 178, 120);
	label(document, svg, 'model occupies one box — harness is the rest', 40, 350, {
		size: SMALL,
		fill: muted
	});
	save('harness-loop.svg', svg);
}

/* ── new diagrams for remaining ASCII blocks ─────────────────────── */

function sketchAnswerSources() {
	const { document, svg, rc } = createSvg(780, 340, 'Where answers live for different question types');
	label(document, svg, 'Where the answer actually lives', 40, 40, { size: TITLE });

	const headers = ['question type', 'where the answer is', 'docs coverage'];
	const rows = [
		['“how does X work”', 'documentation', 'good'],
		['“how do I configure Y”', 'docs + CRD reference', 'partial'],
		['“what is the default”', 'source / CRD schema', 'poor'],
		['“why is this failing”', 'GitHub issues', 'none'],
		['“what does this mean”', 'controller source', 'none']
	];
	const cols = [40, 280, 560];
	const widths = [220, 260, 160];
	headers.forEach((h, i) => label(document, svg, h, cols[i] + 8, 80, { size: SMALL, fill: muted }));
	svg.appendChild(rc.line(40, 92, 720, 92, { stroke: muted, strokeWidth: 1.3, roughness: 1 }));

	rows.forEach((row, r) => {
		const y = 120 + r * 40;
		const fills = [yellow, blue, r < 2 ? green : pink];
		row.forEach((cell, c) => {
			box(rc, svg, cols[c], y - 22, widths[c], 32, {
				fill: fills[c],
				hachureGap: 7,
				fillStyle: 'hachure'
			});
			label(document, svg, cell, cols[c] + 12, y);
		});
	});
	save('answer-sources.svg', svg);
}

function sketchContextBudget() {
	const { document, svg, rc } = createSvg(760, 420, 'Context budget layers from stable prefix to volatile suffix');
	label(document, svg, 'Context as a fixed budget', 40, 40, { size: TITLE });

	const layers = [
		{ t: 'system prompt + rules', n: 'stable, cache-friendly', c: blue },
		{ t: 'tool definitions', n: 'stable', c: purple },
		{ t: 'durable memory', n: 'slow-changing facts', c: green },
		{ t: 'retrieved material', n: 'per-turn', c: yellow },
		{ t: 'compacted history', n: 'periodically rewritten', c: pink },
		{ t: 'recent trajectory', n: 'per-turn, verbatim', c: grey }
	];
	layers.forEach((L, i) => {
		const y = 70 + i * 48;
		box(rc, svg, 40, y, 680, 42, { fill: L.c, hachureGap: 6 });
		label(document, svg, L.t, 56, y + 28);
		label(document, svg, L.n, 700, y + 28, { anchor: 'end', size: SMALL, fill: muted });
	});
	label(document, svg, '▲ stable prefix', 56, 400, { size: SMALL, fill: muted });
	label(document, svg, 'volatile suffix ▲', 700, 400, { anchor: 'end', size: SMALL, fill: muted });
	save('context-budget.svg', svg);
}

function sketchSubagentIsolation() {
	const { document, svg, rc } = createSvg(780, 360, 'Inline search vs delegated sub-agent context isolation');
	label(document, svg, 'Inline vs delegated', 40, 40, { size: TITLE });

	box(rc, svg, 40, 70, 320, 250, { fill: pink, fillStyle: 'hachure', hachureGap: 8 });
	label(document, svg, 'inline', 200, 105, { anchor: 'middle', size: TITLE });
	multiline(
		document,
		svg,
		['main context:', '…', '30 file reads', 'reasoning', 'answer', '…', '', '45k tokens stay forever'],
		200,
		140,
		{ anchor: 'middle', gap: 22, size: SMALL }
	);

	box(rc, svg, 420, 70, 320, 250, { fill: green, fillStyle: 'hachure', hachureGap: 8 });
	label(document, svg, 'delegated', 580, 105, { anchor: 'middle', size: TITLE });
	multiline(
		document,
		svg,
		['sub-agent does the search', 'returns one line', '', 'main keeps:', '“core/retry.py:88”', '', '≈ 12 tokens'],
		580,
		140,
		{ anchor: 'middle', gap: 22, size: SMALL }
	);
	save('subagent-isolation.svg', svg);
}

function sketchRequestTree() {
	const { document, svg, rc } = createSvg(700, 360, 'LLM application requests form a tree of shared prefixes');
	label(document, svg, 'Workloads are trees, not queues', 40, 40, { size: TITLE });

	box(rc, svg, 220, 70, 260, 48, { fill: blue, hachureGap: 6 });
	label(document, svg, 'system prompt + tool defs', 350, 102, { anchor: 'middle' });

	arrow(rc, svg, 350, 122, 350, 150);
	arrow(rc, svg, 350, 140, 140, 170);
	arrow(rc, svg, 350, 140, 560, 170);

	const leaves = [
		{ x: 40, y: 180, t: 'turn 1' },
		{ x: 250, y: 180, t: "turn 1'" },
		{ x: 460, y: 180, t: "turn 1''" }
	];
	leaves.forEach((L) => {
		box(rc, svg, L.x, L.y, 160, 44, { fill: purple, hachureGap: 6 });
		label(document, svg, L.t, L.x + 80, L.y + 30, { anchor: 'middle' });
	});
	arrow(rc, svg, 120, 228, 120, 255);
	arrow(rc, svg, 330, 228, 330, 255);
	box(rc, svg, 40, 260, 160, 44, { fill: yellow, hachureGap: 6 });
	label(document, svg, 'turn 2', 120, 290, { anchor: 'middle' });
	box(rc, svg, 250, 260, 160, 44, { fill: yellow, hachureGap: 6 });
	label(document, svg, "turn 2'", 330, 290, { anchor: 'middle' });
	arrow(rc, svg, 120, 308, 120, 330);
	box(rc, svg, 40, 330, 160, 28, { fill: green, hachureGap: 6 });
	label(document, svg, 'turn 3', 120, 350, { anchor: 'middle', size: SMALL });
	label(document, svg, 'every edge is KV state that already exists somewhere', 380, 350, {
		size: SMALL,
		fill: muted
	});
	save('request-tree.svg', svg);
}

function sketchRadixMatch() {
	const { document, svg, rc } = createSvg(760, 300, 'Radix tree reuses KV for a matched prompt prefix');
	label(document, svg, 'Radix match on insert', 40, 40, { size: TITLE });
	label(document, svg, 'insert: “You are a helpful assistant. What is the capital of France?”', 40, 78, {
		size: SMALL,
		fill: muted
	});

	box(rc, svg, 40, 110, 70, 44, { fill: grey, hachureGap: 6 });
	label(document, svg, 'root', 75, 140, { anchor: 'middle' });
	arrow(rc, svg, 110, 132, 160, 132);

	box(rc, svg, 165, 110, 320, 44, { fill: blue, hachureGap: 6 });
	label(document, svg, '“You are a helpful assistant. ”', 325, 140, { anchor: 'middle', size: SMALL });
	label(document, svg, '← matched, reuse KV', 500, 140, { size: SMALL, fill: accent });

	arrow(rc, svg, 325, 158, 250, 190);
	arrow(rc, svg, 325, 158, 480, 190);

	box(rc, svg, 80, 200, 340, 44, { fill: green, hachureGap: 6 });
	label(document, svg, '“What is the capital of France?”', 250, 230, { anchor: 'middle', size: SMALL });
	label(document, svg, '← matched', 440, 230, { size: SMALL, fill: accent });

	box(rc, svg, 440, 200, 280, 44, { fill: yellow, hachureGap: 6 });
	label(document, svg, '“Summarise this document:”', 580, 230, { anchor: 'middle', size: SMALL });
	label(document, svg, 'nothing new to compute on the matched path', 40, 280, {
		size: SMALL,
		fill: muted
	});
	save('radix-match.svg', svg);
}

function sketchCacheAware() {
	const { document, svg, rc } = createSvg(780, 320, 'Cache-aware scheduling keeps hot prefixes resident');
	label(document, svg, 'Cache-agnostic vs cache-aware order', 40, 40, { size: TITLE });

	box(rc, svg, 40, 70, 330, 210, { fill: pink, fillStyle: 'hachure', hachureGap: 8 });
	label(document, svg, 'cache-agnostic', 205, 105, { anchor: 'middle' });
	multiline(
		document,
		svg,
		['R1 matches A (900)', 'R2 matches B (40)', 'R3 matches A (880)', 'R4 matches C (120)', 'R5 matches A (850)', '', 'A may be evicted'],
		205,
		140,
		{ anchor: 'middle', size: SMALL, gap: 22 }
	);

	box(rc, svg, 410, 70, 330, 210, { fill: green, fillStyle: 'hachure', hachureGap: 8 });
	label(document, svg, 'cache-aware', 575, 105, { anchor: 'middle' });
	multiline(
		document,
		svg,
		['R1 + R3 + R5 (all A)', 'batched together', 'A stays resident', 'then R4 (C), R2 (B)', '', 'prefix reuse sticks'],
		575,
		140,
		{ anchor: 'middle', size: SMALL, gap: 22 }
	);
	save('cache-aware-order.svg', svg);
}

function sketchOverlappedSched() {
	const { document, svg, rc } = createSvg(780, 300, 'Overlapped scheduling keeps the GPU busy');
	label(document, svg, 'Sequential vs overlapped scheduling', 40, 40, { size: TITLE });

	label(document, svg, 'sequential — GPU idle in every scheduling gap', 40, 80, { size: SMALL, fill: muted });
	box(rc, svg, 40, 95, 90, 36, { fill: yellow, hachureGap: 5 });
	label(document, svg, 'sched', 85, 120, { anchor: 'middle', size: SMALL });
	box(rc, svg, 150, 95, 120, 36, { fill: blue, hachureGap: 5 });
	label(document, svg, 'fwd', 210, 120, { anchor: 'middle', size: SMALL });
	box(rc, svg, 290, 95, 90, 36, { fill: yellow, hachureGap: 5 });
	label(document, svg, 'sched', 335, 120, { anchor: 'middle', size: SMALL });
	box(rc, svg, 400, 95, 120, 36, { fill: blue, hachureGap: 5 });
	label(document, svg, 'fwd', 460, 120, { anchor: 'middle', size: SMALL });

	label(document, svg, 'overlapped — schedule n+1 while GPU runs n', 40, 180, {
		size: SMALL,
		fill: muted
	});
	box(rc, svg, 40, 200, 140, 36, { fill: yellow, hachureGap: 5 });
	label(document, svg, 'sched n+1', 110, 225, { anchor: 'middle', size: SMALL });
	box(rc, svg, 40, 248, 200, 36, { fill: blue, hachureGap: 5 });
	label(document, svg, 'fwd n', 140, 273, { anchor: 'middle', size: SMALL });
	box(rc, svg, 200, 200, 140, 36, { fill: yellow, hachureGap: 5 });
	label(document, svg, 'sched n+2', 270, 225, { anchor: 'middle', size: SMALL });
	box(rc, svg, 250, 248, 200, 36, { fill: blue, hachureGap: 5 });
	label(document, svg, 'fwd n+1', 350, 273, { anchor: 'middle', size: SMALL });
	label(document, svg, 'GPU never waits for Python', 480, 273, { size: SMALL, fill: accent });
	save('overlapped-schedule.svg', svg);
}

function sketchJumpForward() {
	const { document, svg, rc } = createSvg(780, 280, 'Jump-forward skips determined tokens in constrained decoding');
	label(document, svg, 'Plain FSM mask vs jump-forward', 40, 40, { size: TITLE });

	label(document, svg, 'plain — 8 forward passes for {"name":', 40, 85, { size: SMALL, fill: muted });
	const toks = ['{', '"', 'n', 'a', 'm', 'e', '"', ':'];
	toks.forEach((t, i) => {
		box(rc, svg, 40 + i * 70, 100, 58, 44, { fill: pink, hachureGap: 5 });
		label(document, svg, t, 69 + i * 70, 130, { anchor: 'middle' });
	});

	label(document, svg, 'jump-forward — determined span costs 0 passes', 40, 185, {
		size: SMALL,
		fill: muted
	});
	box(rc, svg, 40, 200, 70, 44, { fill: blue, hachureGap: 5 });
	label(document, svg, '{', 75, 230, { anchor: 'middle' });
	box(rc, svg, 130, 200, 280, 44, { fill: green, hachureGap: 5 });
	label(document, svg, '"name":   (jump)', 270, 230, { anchor: 'middle' });
	box(rc, svg, 430, 200, 120, 44, { fill: purple, hachureGap: 5 });
	label(document, svg, '"Rohit"', 490, 230, { anchor: 'middle' });
	save('jump-forward.svg', svg);
}

function sketchToolErrors() {
	const { document, svg, rc } = createSvg(780, 320, 'Poor vs better tool error handling in an agent harness');
	label(document, svg, 'How the harness reports tool failure', 40, 40, { size: TITLE });

	box(rc, svg, 40, 70, 700, 100, { fill: pink, fillStyle: 'hachure', hachureGap: 8 });
	label(document, svg, 'poor', 60, 105);
	label(document, svg, 'tool raises  →  catch  →  “an error occurred”', 160, 105);
	label(document, svg, 'agent has no idea what to do next', 160, 140, { size: SMALL, fill: muted });

	box(rc, svg, 40, 190, 700, 100, { fill: green, fillStyle: 'hachure', hachureGap: 8 });
	label(document, svg, 'better', 60, 225);
	label(document, svg, 'tool raises  →  format  →  what / why / valid input / retry', 170, 225);
	label(document, svg, 'failure becomes usable context, not a dead end', 170, 260, {
		size: SMALL,
		fill: muted
	});
	save('tool-errors.svg', svg);
}

function sketchKvFormula() {
	const { document, svg, rc } = createSvg(760, 220, 'KV cache bytes per token formula');
	label(document, svg, 'KV bytes per token', 40, 40, { size: TITLE });
	box(rc, svg, 40, 70, 680, 70, { fill: yellow, hachureGap: 7 });
	label(document, svg, '2  ×  layers  ×  kv_heads  ×  head_dim  ×  dtype_bytes', 380, 115, {
		anchor: 'middle'
	});
	label(document, svg, '↑ one each for K and V', 90, 175, { size: SMALL, fill: accent });
	save('kv-formula.svg', svg);
}

function sketchKvSize() {
	const { document, svg, rc } = createSvg(760, 240, 'Example KV cache size for Llama-2-70B');
	label(document, svg, 'Llama-2-70B · GQA · fp16', 40, 40, { size: TITLE });
	box(rc, svg, 40, 70, 680, 120, { fill: blue, fillStyle: 'hachure', hachureGap: 8 });
	multiline(
		document,
		svg,
		['2 × 80 × 8 × 128 × 2 bytes  ≈  320 KB / token', '× 4096 tokens  ≈  1.3 GB for one sequence'],
		380,
		115,
		{ anchor: 'middle', gap: 36 }
	);
	save('kv-size-example.svg', svg);
}

function sketchRoofline() {
	const { document, svg, rc } = createSvg(760, 360, 'Roofline: decode sits on the memory roof');
	label(document, svg, 'Roofline sketch', 40, 40, { size: TITLE });

	// axes
	svg.appendChild(rc.line(80, 300, 700, 300, { stroke: ink, strokeWidth: 1.8, roughness: 1 }));
	svg.appendChild(rc.line(80, 300, 80, 70, { stroke: ink, strokeWidth: 1.8, roughness: 1 }));
	label(document, svg, 'throughput', 40, 90, { size: SMALL, fill: muted });
	label(document, svg, 'arithmetic intensity →', 520, 330, { size: SMALL, fill: muted });

	// roof
	svg.appendChild(
		rc.linearPath(
			[
				[80, 280],
				[280, 120],
				[680, 120]
			],
			{ stroke: accent, strokeWidth: 2.2, roughness: 1.1 }
		)
	);
	label(document, svg, 'compute roof', 560, 110, { size: SMALL, fill: accent });

	box(rc, svg, 160, 230, 90, 40, { fill: pink, hachureGap: 5 });
	label(document, svg, 'decode', 205, 258, { anchor: 'middle', size: SMALL });
	box(rc, svg, 420, 130, 90, 40, { fill: green, hachureGap: 5 });
	label(document, svg, 'prefill', 465, 158, { anchor: 'middle', size: SMALL });

	label(document, svg, 'batching moves decode rightward', 40, 350, { size: SMALL, fill: muted });
	save('roofline.svg', svg);
}

function sketchBatching() {
	const { document, svg, rc } = createSvg(780, 320, 'Static vs continuous batching');
	label(document, svg, 'Static vs continuous batching', 40, 40, { size: TITLE });

	box(rc, svg, 40, 70, 340, 210, { fill: pink, fillStyle: 'hachure', hachureGap: 8 });
	label(document, svg, 'STATIC', 210, 105, { anchor: 'middle' });
	multiline(
		document,
		svg,
		['A ████████░░░░', 'B ███░░░░░░░░░', 'C ████████████', 'D ██████░░░░░', '', 'idle slots wait'],
		210,
		140,
		{ anchor: 'middle', size: SMALL, gap: 22 }
	);

	box(rc, svg, 400, 70, 340, 210, { fill: green, fillStyle: 'hachure', hachureGap: 8 });
	label(document, svg, 'CONTINUOUS', 570, 105, { anchor: 'middle' });
	multiline(
		document,
		svg,
		['slot1 ████│██████', 'slot2 ██│███████', 'slot3 ██████│████', '', '│ = request boundary', 'slots stay full'],
		570,
		140,
		{ anchor: 'middle', size: SMALL, gap: 22 }
	);
	save('static-vs-continuous.svg', svg);
}

function sketchFlashAttention() {
	const { document, svg, rc } = createSvg(780, 300, 'Standard attention vs FlashAttention memory traffic');
	label(document, svg, 'Standard vs FlashAttention', 40, 40, { size: TITLE });

	box(rc, svg, 40, 70, 340, 190, { fill: pink, fillStyle: 'hachure', hachureGap: 8 });
	label(document, svg, 'STANDARD', 210, 105, { anchor: 'middle' });
	multiline(
		document,
		svg,
		['HBM ↔ N×N scores', 'write / read ×3', '', 'quadratic traffic', 'dominates runtime'],
		210,
		140,
		{ anchor: 'middle', size: SMALL, gap: 24 }
	);

	box(rc, svg, 400, 70, 340, 190, { fill: green, fillStyle: 'hachure', hachureGap: 8 });
	label(document, svg, 'FLASH', 570, 105, { anchor: 'middle' });
	multiline(
		document,
		svg,
		['HBM → K,V once', 'SRAM tiles + online softmax', '', 'matrix never leaves chip', 'one pass to output'],
		570,
		140,
		{ anchor: 'middle', size: SMALL, gap: 24 }
	);
	save('flash-attention.svg', svg);
}

function sketchSpeculative() {
	const { document, svg, rc } = createSvg(780, 300, 'Speculative decoding draft then verify');
	label(document, svg, 'Speculative decoding', 40, 40, { size: TITLE });

	label(document, svg, '1 · draft guesses k tokens (cheap)', 40, 85, { size: SMALL, fill: muted });
	['the', 'cat', 'sat', 'on', 'a'].forEach((t, i) => {
		box(rc, svg, 40 + i * 100, 100, 88, 48, { fill: yellow, hachureGap: 5 });
		label(document, svg, t, 84 + i * 100, 132, { anchor: 'middle' });
	});

	label(document, svg, '2 · target verifies all in one parallel pass', 40, 185, {
		size: SMALL,
		fill: muted
	});
	[
		['the ✓', green],
		['cat ✓', green],
		['sat ✓', green],
		['on ✗', pink],
		['drop', grey]
	].forEach(([t, c], i) => {
		box(rc, svg, 40 + i * 100, 200, 88, 48, { fill: c, hachureGap: 5 });
		label(document, svg, t, 84 + i * 100, 232, { anchor: 'middle' });
	});
	label(document, svg, 'cost ≈ one decode step, but yields 3 tokens', 40, 280, {
		size: SMALL,
		fill: muted
	});
	save('speculative-decoding.svg', svg);
}

function sketchDisagg() {
	const { document, svg, rc } = createSvg(780, 280, 'Disaggregated prefill and decode pools');
	label(document, svg, 'Disaggregated serving', 40, 40, { size: TITLE });

	label(document, svg, 'requests', 40, 140, { size: SMALL, fill: muted });
	arrow(rc, svg, 110, 135, 160, 135);

	box(rc, svg, 165, 80, 220, 140, { fill: blue, hachureGap: 7 });
	multiline(document, svg, ['PREFILL pool', 'compute-optimal', 'big batches', 'tuned for TTFT'], 275, 120, {
		anchor: 'middle',
		size: SMALL,
		gap: 24
	});

	arrow(rc, svg, 390, 150, 450, 150);
	label(document, svg, 'ship KV', 400, 130, { size: SMALL, fill: muted });

	box(rc, svg, 455, 80, 240, 140, { fill: yellow, hachureGap: 7 });
	multiline(
		document,
		svg,
		['DECODE pool', 'bandwidth-optimal', 'many sequences', 'tuned for TPOT'],
		575,
		120,
		{ anchor: 'middle', size: SMALL, gap: 24 }
	);

	arrow(rc, svg, 700, 150, 740, 150);
	label(document, svg, 'tokens', 700, 175, { size: SMALL, fill: muted });
	label(document, svg, 'each pool scaled independently — no interference', 40, 250, {
		size: SMALL,
		fill: muted
	});
	save('disaggregated-serving.svg', svg);
}

function sketchLatencyMetrics() {
	const { document, svg, rc } = createSvg(760, 220, 'TTFT and TPOT along a request timeline');
	label(document, svg, 'What “fast” means', 40, 40, { size: TITLE });

	box(rc, svg, 80, 90, 160, 50, { fill: blue, hachureGap: 5 });
	label(document, svg, 'prefill', 160, 122, { anchor: 'middle' });
	box(rc, svg, 260, 90, 90, 50, { fill: green, hachureGap: 5 });
	label(document, svg, '1st', 305, 122, { anchor: 'middle' });
	box(rc, svg, 370, 90, 90, 50, { fill: yellow, hachureGap: 5 });
	label(document, svg, 'decode', 415, 122, { anchor: 'middle', size: SMALL });
	box(rc, svg, 480, 90, 90, 50, { fill: yellow, hachureGap: 5 });
	label(document, svg, 'decode', 525, 122, { anchor: 'middle', size: SMALL });
	box(rc, svg, 590, 90, 90, 50, { fill: grey, hachureGap: 5 });
	label(document, svg, '…', 635, 122, { anchor: 'middle' });

	svg.appendChild(rc.line(80, 160, 350, 160, { stroke: accent, strokeWidth: 1.8, roughness: 1 }));
	label(document, svg, 'TTFT', 200, 185, { anchor: 'middle', fill: accent });
	svg.appendChild(rc.line(370, 160, 570, 160, { stroke: muted, strokeWidth: 1.8, roughness: 1 }));
	label(document, svg, 'TPOT', 470, 185, { anchor: 'middle', fill: muted });
	save('latency-metrics.svg', svg);
}

function sketchCudaGraphs() {
	const { document, svg, rc } = createSvg(780, 240, 'Piecewise CUDA graphs around eager attention');
	label(document, svg, 'Piecewise CUDA graphs', 40, 40, { size: TITLE });

	box(rc, svg, 40, 80, 260, 90, { fill: blue, hachureGap: 6 });
	multiline(document, svg, ['captured graph', 'norm · qkv · …'], 170, 118, {
		anchor: 'middle',
		gap: 26
	});
	arrow(rc, svg, 305, 125, 355, 125);
	box(rc, svg, 360, 80, 100, 90, { fill: yellow, hachureGap: 6 });
	multiline(document, svg, ['eager', 'attn'], 410, 118, { anchor: 'middle', gap: 26 });
	arrow(rc, svg, 465, 125, 515, 125);
	box(rc, svg, 520, 80, 220, 90, { fill: blue, hachureGap: 6 });
	multiline(document, svg, ['captured graph', 'o proj · MLP · …'], 630, 118, {
		anchor: 'middle',
		gap: 26
	});
	label(document, svg, 'no launch overhead          dynamic shapes          no launch overhead', 40, 210, {
		size: SMALL,
		fill: muted
	});
	save('cuda-graphs.svg', svg);
}

function sketchIntensity() {
	const { document, svg, rc } = createSvg(720, 180, 'Decode arithmetic intensity is about 1 FLOP per byte');
	label(document, svg, 'Decode intensity', 40, 40, { size: TITLE });
	box(rc, svg, 40, 70, 640, 70, { fill: yellow, hachureGap: 7 });
	label(document, svg, '(2 × params) / (2 bytes × params)  ≈  1 FLOP / byte', 360, 115, {
		anchor: 'middle'
	});
	save('decode-intensity.svg', svg);
}

/* run all */
[
	sketchPrefillDecodeKv,
	sketchFragmentation,
	sketchTwoClocks,
	sketchVllmSplit,
	sketchBlockPool,
	sketchPrefixCache,
	sketchHarnessLoop,
	sketchAnswerSources,
	sketchContextBudget,
	sketchSubagentIsolation,
	sketchRequestTree,
	sketchRadixMatch,
	sketchCacheAware,
	sketchOverlappedSched,
	sketchJumpForward,
	sketchToolErrors,
	sketchKvFormula,
	sketchKvSize,
	sketchRoofline,
	sketchBatching,
	sketchFlashAttention,
	sketchSpeculative,
	sketchDisagg,
	sketchLatencyMetrics,
	sketchCudaGraphs,
	sketchIntensity
].forEach((fn) => fn());

console.log('done —', outDirs[0]);
