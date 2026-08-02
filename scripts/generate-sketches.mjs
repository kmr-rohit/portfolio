/**
 * Generate Excalidraw-style sketch SVGs with Rough.js (the same engine
 * Excalidraw uses for its hand-drawn look).
 *
 *   npm run sketches
 *
 * Drop additional hand-authored Excalidraw SVG exports into static/sketches/
 * — they pick up the same "pasted note" framing in posts.
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

const ink = '#1d1f22';
const muted = '#5c6168';
const purple = '#b7a0e0';
const yellow = '#e8d48b';
const blue = '#9bb7e8';
const red = '#e0a0a8';
const grey = '#c5c8ce';
const green = '#a8d4b8';
const pink = '#e8b4bc';
const paper = '#f7f5f0';

function createSvg(width, height) {
	const dom = new JSDOM('<!DOCTYPE html><html><body></body></html>');
	const { document } = dom.window;
	const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
	svg.setAttribute('xmlns', 'http://www.w3.org/2000/svg');
	svg.setAttribute('width', String(width));
	svg.setAttribute('height', String(height));
	svg.setAttribute('viewBox', `0 0 ${width} ${height}`);
	svg.setAttribute('role', 'img');

	const bg = document.createElementNS('http://www.w3.org/2000/svg', 'rect');
	bg.setAttribute('width', '100%');
	bg.setAttribute('height', '100%');
	bg.setAttribute('fill', paper);
	svg.appendChild(bg);

	const rc = rough.svg(svg, { options: { roughness: 1.35, bowing: 1.1, stroke: ink } });
	return { document, svg, rc };
}

function label(document, svg, text, x, y, opts = {}) {
	const el = document.createElementNS('http://www.w3.org/2000/svg', 'text');
	el.setAttribute('x', String(x));
	el.setAttribute('y', String(y));
	el.setAttribute('fill', opts.fill ?? ink);
	el.setAttribute('font-family', FONT);
	el.setAttribute('font-size', String(opts.size ?? 15));
	if (opts.anchor) el.setAttribute('text-anchor', opts.anchor);
	if (opts.weight) el.setAttribute('font-weight', opts.weight);
	el.textContent = text;
	svg.appendChild(el);
	return el;
}

function multiline(document, svg, lines, x, y, opts = {}) {
	const g = document.createElementNS('http://www.w3.org/2000/svg', 'text');
	g.setAttribute('x', String(x));
	g.setAttribute('y', String(y));
	g.setAttribute('fill', opts.fill ?? ink);
	g.setAttribute('font-family', FONT);
	g.setAttribute('font-size', String(opts.size ?? 13));
	if (opts.anchor) g.setAttribute('text-anchor', opts.anchor);
	lines.forEach((line, i) => {
		const t = document.createElementNS('http://www.w3.org/2000/svg', 'tspan');
		t.setAttribute('x', String(x));
		t.setAttribute('dy', i === 0 ? '0' : String(opts.gap ?? 16));
		t.textContent = line;
		g.appendChild(t);
	});
	svg.appendChild(g);
}

function box(rc, svg, x, y, w, h, opts) {
	svg.appendChild(
		rc.rectangle(x, y, w, h, {
			roughness: 1.4,
			bowing: 1.2,
			stroke: opts.stroke ?? ink,
			strokeWidth: opts.strokeWidth ?? 1.5,
			fill: opts.fill,
			fillStyle: opts.fillStyle ?? 'cross-hatch',
			hachureGap: opts.hachureGap ?? 5.5,
			hachureAngle: opts.hachureAngle ?? 50,
			fillWeight: opts.fillWeight ?? 1
		})
	);
}

function arrow(rc, svg, x1, y1, x2, y2, opts = {}) {
	svg.appendChild(
		rc.line(x1, y1, x2, y2, {
			stroke: opts.stroke ?? muted,
			strokeWidth: opts.strokeWidth ?? 1.4,
			roughness: 1.2,
			strokeLineDash: opts.dashed ? [6, 5] : undefined
		})
	);
	const angle = Math.atan2(y2 - y1, x2 - x1);
	const len = 8;
	const a1 = angle + Math.PI * 0.82;
	const a2 = angle - Math.PI * 0.82;
	svg.appendChild(
		rc.linearPath(
			[
				[x2 + Math.cos(a1) * len, y2 + Math.sin(a1) * len],
				[x2, y2],
				[x2 + Math.cos(a2) * len, y2 + Math.sin(a2) * len]
			],
			{ stroke: opts.stroke ?? muted, strokeWidth: opts.strokeWidth ?? 1.4, roughness: 1 }
		)
	);
}

function save(name, svg) {
	// Handwritten face for inlined SVGs (page font + @import backup).
	const style = svg.ownerDocument.createElementNS('http://www.w3.org/2000/svg', 'style');
	style.textContent = `@import url('https://fonts.googleapis.com/css2?family=Architects+Daughter&display=swap'); text{font-family:${FONT};}`;
	svg.insertBefore(style, svg.firstChild.nextSibling);

	const html = svg.outerHTML;
	for (const dir of outDirs) {
		const path = join(dir, name);
		writeFileSync(path, html);
		console.log('wrote', path);
	}
}

/** Prefill vs decode with KV-cache — inspired by common serving explainers. */
function sketchPrefillDecodeKv() {
	const W = 720;
	const H = 520;
	const { document, svg, rc } = createSvg(W, H);
	svg.setAttribute('aria-label', 'Prefill caches Keys and Values; decode restores them from the KV-cache');

	label(document, svg, 'Step 1 — Prefill', 36, 36, { size: 18, weight: '600' });

	box(rc, svg, 36, 56, 110, 70, { fill: purple });
	label(document, svg, 'Queries', 91, 88, { anchor: 'middle', size: 14 });
	label(document, svg, 'Q', 91, 108, { anchor: 'middle', size: 13, fill: muted });

	label(document, svg, '×', 156, 98, { size: 20, anchor: 'middle' });

	box(rc, svg, 176, 56, 110, 70, { fill: yellow });
	label(document, svg, 'Keysᵀ', 231, 88, { anchor: 'middle', size: 14 });
	label(document, svg, 'K', 231, 108, { anchor: 'middle', size: 13, fill: muted });

	label(document, svg, '×', 296, 98, { size: 20, anchor: 'middle' });

	box(rc, svg, 316, 56, 110, 70, { fill: blue });
	label(document, svg, 'Values', 371, 88, { anchor: 'middle', size: 14 });
	label(document, svg, 'V', 371, 108, { anchor: 'middle', size: 13, fill: muted });

	label(document, svg, '=', 436, 98, { size: 20, anchor: 'middle' });

	box(rc, svg, 456, 56, 110, 70, { fill: red });
	label(document, svg, 'Results', 511, 88, { anchor: 'middle', size: 14 });
	label(document, svg, 'O', 511, 108, { anchor: 'middle', size: 13, fill: muted });

	// tiny attention grid
	box(rc, svg, 580, 52, 100, 78, { fill: blue, fillStyle: 'hachure', hachureGap: 4 });
	multiline(document, svg, ['Causal', 'attention', 'scores'], 630, 78, {
		anchor: 'middle',
		size: 12,
		gap: 14
	});

	arrow(rc, svg, 231, 130, 300, 188);
	arrow(rc, svg, 371, 130, 360, 188);
	label(document, svg, 'Caching K', 250, 168, { size: 12, fill: muted });
	label(document, svg, 'Caching V', 378, 168, { size: 12, fill: muted });

	box(rc, svg, 220, 196, 280, 48, { fill: grey, fillStyle: 'cross-hatch', hachureGap: 4.5 });
	label(document, svg, 'KV-cache', 360, 226, { anchor: 'middle', size: 16, weight: '600' });

	label(document, svg, 'Step N — Decode', 36, 292, { size: 18, weight: '600' });

	box(rc, svg, 36, 312, 54, 70, { fill: purple });
	label(document, svg, 'Q', 63, 352, { anchor: 'middle', size: 14 });

	label(document, svg, '×', 108, 352, { size: 20, anchor: 'middle' });

	box(rc, svg, 128, 312, 150, 70, { fill: yellow });
	box(rc, svg, 128, 312, 96, 70, { fill: grey, fillStyle: 'cross-hatch', hachureGap: 4 });
	label(document, svg, 'K_prev', 176, 342, { anchor: 'middle', size: 12 });
	label(document, svg, 'K_new', 252, 352, { anchor: 'middle', size: 12 });

	label(document, svg, '×', 296, 352, { size: 20, anchor: 'middle' });

	box(rc, svg, 316, 312, 150, 70, { fill: blue });
	box(rc, svg, 316, 312, 96, 70, { fill: grey, fillStyle: 'cross-hatch', hachureGap: 4 });
	label(document, svg, 'V_prev', 364, 342, { anchor: 'middle', size: 12 });
	label(document, svg, 'V_new', 440, 352, { anchor: 'middle', size: 12 });

	label(document, svg, '=', 484, 352, { size: 20, anchor: 'middle' });

	box(rc, svg, 504, 312, 54, 70, { fill: red });
	label(document, svg, 'O', 531, 352, { anchor: 'middle', size: 14 });

	arrow(rc, svg, 300, 248, 200, 308, { dashed: true });
	arrow(rc, svg, 360, 248, 390, 308, { dashed: true });
	label(document, svg, 'restore K', 168, 278, { size: 12, fill: muted });
	label(document, svg, 'restore V', 400, 278, { size: 12, fill: muted });

	label(
		document,
		svg,
		'Prefill writes the cache once. Decode reads it back and only appends the new token.',
		36,
		430,
		{ size: 13, fill: muted }
	);

	save('prefill-decode-kv.svg', svg);
}

/** External fragmentation — contiguous allocator wasting free holes. */
function sketchFragmentation() {
	const W = 720;
	const H = 420;
	const { document, svg, rc } = createSvg(W, H);
	svg.setAttribute('aria-label', 'External fragmentation in a contiguous memory allocator');

	label(document, svg, 'Memory allocation & external fragmentation', 36, 36, {
		size: 18,
		weight: '600'
	});

	box(rc, svg, 36, 56, 70, 22, { fill: pink, hachureGap: 4 });
	label(document, svg, 'Allocated', 116, 72, { size: 13 });
	box(rc, svg, 210, 56, 70, 22, { fill: green, hachureGap: 4 });
	label(document, svg, 'Free', 290, 72, { size: 13 });

	const rows = [
		{ y: 110, label: 'Initial: 128 bytes free', segs: [[0, 128, 'free']] },
		{
			y: 160,
			label: 'Request 1 (32 B)',
			segs: [
				[0, 32, 'used'],
				[32, 96, 'free']
			]
		},
		{
			y: 210,
			label: 'Request 2 (16 B)',
			segs: [
				[0, 32, 'used'],
				[32, 31, 'free'],
				[63, 16, 'used'],
				[79, 49, 'free']
			]
		},
		{
			y: 260,
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
			y: 310,
			label: 'Request 4 — stuck',
			segs: [
				[0, 32, 'used'],
				[32, 8, 'used'],
				[40, 23, 'free'],
				[63, 16, 'used'],
				[79, 16, 'free'],
				[95, 33, 'free']
			],
			frag: true
		}
	];

	const ox = 180;
	const scale = 3.6;

	for (const row of rows) {
		label(document, svg, row.label, 36, row.y + 18, { size: 12, fill: muted });
		for (const [start, len, kind] of row.segs) {
			box(rc, svg, ox + start * scale, row.y, len * scale, 28, {
				fill: kind === 'used' ? pink : green,
				hachureGap: 4.2,
				strokeWidth: 1.3
			});
		}
		if (row.frag) {
			svg.appendChild(
				rc.line(ox + 40 * scale, row.y + 34, ox + 63 * scale, row.y + 34, {
					stroke: blue,
					strokeWidth: 1.6,
					roughness: 1.1
				})
			);
			label(document, svg, '↕ holes too small', ox + 42 * scale, row.y + 52, {
				size: 12,
				fill: '#3d6ced'
			});
		}
	}

	label(document, svg, '0', ox, 372, { size: 11, fill: muted });
	label(document, svg, '127', ox + 128 * scale, 372, { size: 11, fill: muted, anchor: 'end' });
	label(
		document,
		svg,
		'Plenty of free bytes in total — just not in one contiguous run.',
		36,
		400,
		{ size: 13, fill: muted }
	);

	save('external-fragmentation.svg', svg);
}

/** Two clocks overview for the-two-clocks post. */
function sketchTwoClocks() {
	const W = 720;
	const H = 340;
	const { document, svg, rc } = createSvg(W, H);
	svg.setAttribute('aria-label', 'Prefill is compute-bound; decode is memory-bound');

	label(document, svg, 'The two clocks', 36, 36, { size: 18, weight: '600' });

	box(rc, svg, 36, 60, 300, 220, { fill: '#dfe8f6', fillStyle: 'hachure', hachureGap: 7 });
	label(document, svg, 'PREFILL', 186, 92, { anchor: 'middle', size: 16, weight: '600' });
	multiline(
		document,
		svg,
		['one pass · all tokens', 'large dense GEMMs', 'tensor cores busy', '', 'bounded by FLOPs', '→ TTFT'],
		186,
		126,
		{ anchor: 'middle', size: 14, gap: 20 }
	);

	box(rc, svg, 384, 60, 300, 220, { fill: '#f3e4d4', fillStyle: 'hachure', hachureGap: 7 });
	label(document, svg, 'DECODE', 534, 92, { anchor: 'middle', size: 16, weight: '600' });
	multiline(
		document,
		svg,
		['many passes · one token', 'skinny matvecs', 're-read weights + KV', '', 'bounded by BANDWIDTH', '→ ITL'],
		534,
		126,
		{ anchor: 'middle', size: 14, gap: 20 }
	);

	save('two-clocks.svg', svg);
}

/** vLLM process split. */
function sketchVllmSplit() {
	const W = 720;
	const H = 360;
	const { document, svg, rc } = createSvg(W, H);
	svg.setAttribute('aria-label', 'vLLM V1 splits the API server and EngineCore across processes');

	label(document, svg, 'vLLM V1 process split', 36, 36, { size: 18, weight: '600' });

	box(rc, svg, 60, 70, 600, 90, { fill: purple, hachureGap: 6 });
	label(document, svg, 'API server process', 360, 106, { anchor: 'middle', size: 15, weight: '600' });
	label(document, svg, 'HTTP · tokenize · multimodal · detokenize', 360, 130, {
		anchor: 'middle',
		size: 13,
		fill: muted
	});

	arrow(rc, svg, 360, 164, 360, 198);
	label(document, svg, 'ZeroMQ IPC', 372, 186, { size: 12, fill: muted });

	box(rc, svg, 60, 204, 600, 110, { fill: blue, hachureGap: 6 });
	label(document, svg, 'EngineCore process', 360, 240, { anchor: 'middle', size: 15, weight: '600' });
	label(document, svg, 'Scheduler  →  KVCacheManager  →  block pool', 360, 266, {
		anchor: 'middle',
		size: 13
	});
	label(document, svg, 'ModelExecutor  →  Worker(s)  →  attention backend', 360, 290, {
		anchor: 'middle',
		size: 13
	});

	save('vllm-process-split.svg', svg);
}

/** KV block pool. */
function sketchBlockPool() {
	const W = 720;
	const H = 300;
	const { document, svg, rc } = createSvg(W, H);
	svg.setAttribute('aria-label', 'GPU memory carved into a fixed pool of KV blocks');

	label(document, svg, 'KV block pool', 36, 36, { size: 18, weight: '600' });

	box(rc, svg, 40, 70, 160, 160, { fill: grey, hachureGap: 5 });
	multiline(document, svg, ['model', 'weights'], 120, 140, { anchor: 'middle', size: 14, gap: 18 });

	box(rc, svg, 220, 70, 120, 160, { fill: yellow, hachureGap: 5 });
	multiline(document, svg, ['activation', 'peak'], 280, 140, { anchor: 'middle', size: 14, gap: 18 });

	const colors = [purple, blue, green, pink, yellow, grey, purple, blue];
	colors.forEach((c, i) => {
		const x = 370 + i * 38;
		box(rc, svg, x, 90, 32, 120, { fill: c, hachureGap: 4 });
		label(document, svg, `b${i}`, x + 16, 230, { anchor: 'middle', size: 11, fill: muted });
	});
	label(document, svg, 'KV cache → fixed blocks (e.g. 16 tokens each)', 370, 70, { size: 13 });
	label(document, svg, 'free-block queue: [b3, b6, b1, …]', 370, 262, { size: 13, fill: muted });

	save('kv-block-pool.svg', svg);
}

/** Prefix cache sharing. */
function sketchPrefixCache() {
	const W = 720;
	const H = 280;
	const { document, svg, rc } = createSvg(W, H);
	svg.setAttribute('aria-label', 'Shared system-prompt blocks are reference-counted across requests');

	label(document, svg, 'Prefix caching', 36, 36, { size: 18, weight: '600' });

	box(rc, svg, 80, 80, 280, 48, { fill: blue, hachureGap: 5 });
	label(document, svg, 'system prompt …………', 220, 110, { anchor: 'middle', size: 14 });
	box(rc, svg, 370, 80, 220, 48, { fill: purple, hachureGap: 5 });
	label(document, svg, 'user question A', 480, 110, { anchor: 'middle', size: 14 });
	label(document, svg, 'request 1', 36, 110, { size: 13, fill: muted });

	box(rc, svg, 80, 160, 280, 48, { fill: blue, hachureGap: 5 });
	label(document, svg, 'system prompt …………', 220, 190, { anchor: 'middle', size: 14 });
	box(rc, svg, 370, 160, 220, 48, { fill: yellow, hachureGap: 5 });
	label(document, svg, 'user question B', 480, 190, { anchor: 'middle', size: 14 });
	label(document, svg, 'request 2', 36, 190, { size: 13, fill: muted });

	svg.appendChild(
		rc.line(80, 140, 360, 140, { stroke: '#3d6ced', strokeWidth: 1.5, roughness: 1.1 })
	);
	label(document, svg, 'same physical blocks · refcounted', 220, 154, {
		anchor: 'middle',
		size: 12,
		fill: '#3d6ced'
	});

	save('prefix-cache.svg', svg);
}

/** Agent harness loop. */
function sketchHarnessLoop() {
	const W = 640;
	const H = 360;
	const { document, svg, rc } = createSvg(W, H);
	svg.setAttribute('aria-label', 'Agent harness loop around the model call');

	label(document, svg, 'The harness is every box except one', 36, 36, { size: 18, weight: '600' });

	const nodes = [
		{ x: 40, y: 80, t: 'assemble\ncontext', c: yellow },
		{ x: 220, y: 80, t: 'model\ncall', c: purple },
		{ x: 400, y: 80, t: 'parse\nintent', c: blue },
		{ x: 220, y: 220, t: 'execute\ntool', c: green },
		{ x: 400, y: 220, t: 'observe', c: pink }
	];

	for (const n of nodes) {
		box(rc, svg, n.x, n.y, 130, 70, { fill: n.c, hachureGap: 5 });
		const [a, b] = n.t.split('\n');
		label(document, svg, a, n.x + 65, n.y + 30, { anchor: 'middle', size: 14 });
		if (b) label(document, svg, b, n.x + 65, n.y + 48, { anchor: 'middle', size: 14 });
	}

	arrow(rc, svg, 172, 115, 218, 115);
	arrow(rc, svg, 352, 115, 398, 115);
	arrow(rc, svg, 465, 154, 465, 218);
	arrow(rc, svg, 400, 255, 352, 255);
	arrow(rc, svg, 220, 255, 105, 255);
	arrow(rc, svg, 105, 255, 105, 150);
	arrow(rc, svg, 105, 150, 170, 115);

	label(document, svg, 'model occupies one box — harness is the rest', 36, 330, {
		size: 13,
		fill: muted
	});

	save('harness-loop.svg', svg);
}

sketchPrefillDecodeKv();
sketchFragmentation();
sketchTwoClocks();
sketchVllmSplit();
sketchBlockPool();
sketchPrefixCache();
sketchHarnessLoop();

console.log('done');
