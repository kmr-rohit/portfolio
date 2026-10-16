/**
 * Imports the Concepts folder of the SystemDesign Obsidian vault into
 * content/system-design/, and renders every embedded Excalidraw drawing to a
 * static SVG under static/learn/system-design/diagrams/.
 *
 * Usage: node scripts/system-design/import.mjs <vault> [--skip-diagrams]
 *
 * Diagram rendering drives a headless Chrome over the DevTools protocol and
 * uses Excalidraw's own exportToSvg, so the output matches the vault. Set
 * CHROME to point at a Chrome binary if it is not in the default macOS path.
 */

import { spawn } from "node:child_process";
import {
  existsSync,
  mkdirSync,
  mkdtempSync,
  readdirSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { basename, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = resolve(fileURLToPath(new URL("../..", import.meta.url)));
const OUT_NOTES = join(ROOT, "content/system-design");
// Kept out of static/learn/ so the folder does not shadow the /learn routes.
const OUT_DIAGRAMS = join(ROOT, "static/system-design/diagrams");
const DIAGRAM_URL = "/system-design/diagrams";
const BASE_URL = "/learn/system-design";
const EXCALIDRAW_PACKAGE = "https://cdn.jsdelivr.net/npm/@excalidraw/utils@0.1.5";
const LZ_STRING = "https://cdn.jsdelivr.net/npm/lz-string@1.5.0/libs/lz-string.min.js";

const [vaultArg, ...flags] = process.argv.slice(2);
if (!vaultArg) {
  console.error("Usage: node scripts/system-design/import.mjs <vault> [--skip-diagrams]");
  process.exit(1);
}
const vault = resolve(vaultArg);
const conceptsDir = join(vault, "Concepts");
const drawingsDir = join(conceptsDir, "Excalidraw");

export function slugify(value) {
  return value
    .trim()
    .toLowerCase()
    .replace(/&/g, " and ")
    .replace(/[^\w\s-]/g, "")
    .replace(/[\s_]+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "");
}

function parseFrontmatter(source) {
  const match = source.match(/^---\n([\s\S]*?)\n---\n?/);
  if (!match) return { data: {}, body: source };
  const data = {};
  let listKey = null;
  for (const line of match[1].split("\n")) {
    const item = line.match(/^\s+-\s+(.*)$/);
    if (item && listKey) {
      data[listKey].push(item[1].trim());
      continue;
    }
    const kv = line.match(/^([\w-]+):\s*(.*)$/);
    if (!kv) continue;
    listKey = null;
    if (kv[2].trim() === "") {
      listKey = kv[1];
      data[listKey] = [];
      continue;
    }
    const [, key, raw] = kv;
    let value = raw.trim();
    if (value.startsWith("[") && value.endsWith("]")) {
      value = value
        .slice(1, -1)
        .split(",")
        .map((item) => item.trim())
        .filter(Boolean);
    } else if (/^-?\d+$/.test(value)) {
      value = Number(value);
    }
    data[key] = value;
  }
  return { data, body: source.slice(match[0].length) };
}

const notes = readdirSync(conceptsDir)
  .filter((file) => file.endsWith(".md") && !file.startsWith("00 - "))
  .map((file) => {
    const { data, body } = parseFrontmatter(
      readFileSync(join(conceptsDir, file), "utf8")
    );
    const title = data.title || basename(file, ".md");
    return { file, title, slug: slugify(basename(file, ".md")), data, body };
  });

const published = new Map(
  notes.map((note) => [basename(note.file, ".md").toLowerCase(), note])
);

/** Splits markdown into fenced-code and prose segments. */
function segments(body) {
  const parts = [];
  const fence = /^(```|~~~)[^\n]*\n[\s\S]*?^\1[^\S\n]*$/gm;
  let last = 0;
  for (const match of body.matchAll(fence)) {
    if (match.index > last) parts.push({ code: false, text: body.slice(last, match.index) });
    parts.push({ code: true, text: match[0] });
    last = match.index + match[0].length;
  }
  if (last < body.length) parts.push({ code: false, text: body.slice(last) });
  return parts;
}

/**
 * Applies fn to prose and escapes inline code spans.
 *
 * mdsvex writes text into the Svelte template without escaping it, so `<`
 * and braces must arrive as entities. Inline code is kept literal by remark,
 * so a single entity is enough there; prose entities are decoded once by
 * remark, so prose gets them double-encoded (see escapeProse).
 */
function mapProse(text, fn) {
  return text
    .split(/(`+[^`\n]*?`+)/g)
    .map((piece, index) =>
      index % 2 === 1
        ? piece.replace(/</g, "&lt;").replace(/\{/g, "&#123;").replace(/\}/g, "&#125;")
        : fn(piece)
    )
    .join("");
}

function escapeHtml(value) {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function linkFor(target, heading) {
  const note = published.get(target.toLowerCase());
  if (!note && target) return null;
  const hash = heading ? `#${slugify(heading)}` : "";
  return note ? `${BASE_URL}/${note.slug}${hash}` : hash;
}

function convertCallouts(text) {
  const lines = text.split("\n");
  const out = [];
  for (let i = 0; i < lines.length; i++) {
    const head = lines[i].match(/^>\s*\[!(\w+)\][+-]?\s*(.*)$/);
    if (!head) {
      out.push(lines[i]);
      continue;
    }
    const [, kind, title] = head;
    const body = [];
    while (i + 1 < lines.length && lines[i + 1].startsWith(">")) {
      body.push(lines[++i].replace(/^>\s?/, ""));
    }
    out.push(
      `<aside class="sd-callout sd-callout--${kind.toLowerCase()}">`,
      "",
      title ? `<p class="sd-callout-title">${title}</p>` : "",
      "",
      ...body,
      "",
      "</aside>"
    );
  }
  return out.join("\n");
}

function convertProse(text, note, diagrams) {
  text = text.replace(/%%[\s\S]*?%%/g, "");
  text = convertCallouts(text);
  return mapProse(text, (prose) =>
    prose
      // Escape what Svelte and remark-math would otherwise interpret.
      .replace(/\$/g, "&#36;")
      .replace(/<(?!\/?(aside|p)[\s>])/g, "&amp;lt;")
      .replace(/\{/g, "&amp;#123;")
      .replace(/\}/g, "&amp;#125;")
      .replace(/==([^=\n]+)==/g, "<mark>$1</mark>")
      .replace(/!\[\[([^\]|#]+?)(?:\.excalidraw)?(?:\.md)?(?:\\?\|[^\]]*)?\]\]/g, (_, name) => {
        const source = join(drawingsDir, `${name}.excalidraw.md`);
        if (!existsSync(source)) {
          console.warn(`  ${note.file}: missing drawing ${name}`);
          return "";
        }
        const slug = slugify(name);
        diagrams.set(slug, source);
        return `<figure class="sd-figure"><img src="${DIAGRAM_URL}/${slug}.svg" alt="${escapeHtml(
          `Diagram: ${name}`
        )}" loading="lazy" decoding="async" /></figure>`;
      })
      .replace(/\[\[([^\]|#]*)(?:#([^\]|]+))?(?:\\?\|([^\]]+))?\]\]/g, (_, target, heading, alias) => {
        const label = (alias || heading || target).trim();
        const href = linkFor(target.trim(), heading?.trim());
        return href ? `[${label}](${href})` : label;
      })
  );
}

function summaryOf(body) {
  const paragraph = body
    .split(/\n{2,}/)
    .map((block) => block.trim())
    .find((block) => block && !/^(#|>|---|```|\||!\[|-|\*|\d+\.)/.test(block));
  return (paragraph ?? "")
    .replace(/\[\[([^\]|#]*)(?:#[^\]|]+)?(?:\\?\|([^\]]+))?\]\]/g, (_, t, a) => a || t)
    .replace(/[*_`]/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

function yamlString(value) {
  return JSON.stringify(String(value));
}

mkdirSync(OUT_NOTES, { recursive: true });
for (const file of readdirSync(OUT_NOTES)) rmSync(join(OUT_NOTES, file));

const diagrams = new Map();
for (const note of notes) {
  const body = note.body.replace(/^\s*#\s+[^\n]+\n/, "");
  const converted = segments(body)
    .map((part) => (part.code ? part.text : convertProse(part.text, note, diagrams)))
    .join("")
    .trim();
  const stageName = String(note.data.stage_name ?? "").replace(/^\d+\s*·\s*/, "");
  const tags = (note.data.tags ?? []).filter((tag) => tag !== "concept");
  // Only these fields are published; the vault's revision dates stay private.
  const frontmatter = [
    "---",
    `title: ${yamlString(note.title)}`,
    `summary: ${yamlString(summaryOf(body))}`,
    `stage: ${Number(note.data.stage ?? 99)}`,
    `stageName: ${yamlString(stageName)}`,
    `tier: ${yamlString(note.data.tier ?? "useful")}`,
    `seq: ${Number(note.data.seq ?? 999)}`,
    `tags: [${tags.map(yamlString).join(", ")}]`,
    "---",
  ];
  writeFileSync(join(OUT_NOTES, `${note.slug}.md`), `${frontmatter.join("\n")}\n\n${converted}\n`);
}
console.log(`notes: ${notes.length} written to ${OUT_NOTES}`);

if (flags.includes("--skip-diagrams")) process.exit(0);

/** Returns the drawing as a JS expression: plain JSON, or an LZ-string decode. */
function drawingExpression(path) {
  const source = readFileSync(path, "utf8");
  const plain = source.match(/```json\n([\s\S]*?)\n```/);
  if (plain) return JSON.stringify(JSON.parse(plain[1]));
  const compressed = source.match(/```compressed-json\n([\s\S]*?)\n```/);
  if (!compressed) throw new Error(`no drawing found in ${path}`);
  const base64 = compressed[1].replace(/\s+/g, "");
  return `JSON.parse(LZString.decompressFromBase64(${JSON.stringify(base64)}))`;
}

async function renderDiagrams() {
  const chromePath =
    process.env.CHROME ?? "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome";
  const port = 9300 + Math.floor(Math.random() * 600);
  const profile = mkdtempSync(join(tmpdir(), "sd-chrome-"));
  const chrome = spawn(
    chromePath,
    ["--headless=new", `--remote-debugging-port=${port}`, "--no-first-run", `--user-data-dir=${profile}`, "about:blank"],
    { stdio: "ignore" }
  );
  const sleep = (ms) => new Promise((done) => setTimeout(done, ms));
  let ws;
  for (let i = 0; i < 60 && !ws; i++) {
    try {
      const targets = await (await fetch(`http://127.0.0.1:${port}/json`)).json();
      const page = targets.find((target) => target.type === "page");
      if (page) ws = new WebSocket(page.webSocketDebuggerUrl);
    } catch {
      await sleep(250);
    }
  }
  await new Promise((done) => (ws.onopen = done));
  let id = 0;
  const pending = new Map();
  ws.onmessage = (event) => {
    const message = JSON.parse(event.data);
    pending.get(message.id)?.(message);
    pending.delete(message.id);
  };
  const send = (method, params = {}) =>
    new Promise((done) => {
      const callId = ++id;
      pending.set(callId, done);
      ws.send(JSON.stringify({ id: callId, method, params }));
    });
  const evaluate = async (expression) => {
    const response = await send("Runtime.evaluate", { expression, awaitPromise: true, returnByValue: true });
    if (response.result?.exceptionDetails) {
      throw new Error(JSON.stringify(response.result.exceptionDetails).slice(0, 400));
    }
    return response.result?.result?.value;
  };

  // Load from the CDN's origin so the module import is same-origin.
  await send("Page.enable");
  await send("Page.navigate", { url: `${EXCALIDRAW_PACKAGE}/package.json` });
  await sleep(1500);
  await evaluate(`import(${JSON.stringify(`${EXCALIDRAW_PACKAGE}/dist/prod/index.js`)}).then((module) => { window.Excalidraw = module; })`);
  await evaluate(`new Promise((done, fail) => {
    const script = document.createElement("script");
    script.src = ${JSON.stringify(LZ_STRING)};
    script.onload = done; script.onerror = fail;
    document.head.appendChild(script);
  })`);

  mkdirSync(OUT_DIAGRAMS, { recursive: true });
  for (const file of readdirSync(OUT_DIAGRAMS)) rmSync(join(OUT_DIAGRAMS, file));

  for (const [slug, path] of diagrams) {
    const svg = await evaluate(`(async () => {
      const drawing = ${drawingExpression(path)};
      // Fonts are subset and inlined, so the SVG works inside an <img>.
      const svg = await Excalidraw.exportToSvg({
        data: {
          elements: drawing.elements.filter((element) => !element.isDeleted),
          appState: { ...(drawing.appState || {}), exportBackground: false, exportWithDarkMode: false },
          files: drawing.files || {},
        },
        config: { padding: 16 },
      });
      return svg.outerHTML;
    })()`);
    const output = svg.replace(/<svg /, '<svg role="img" ');
    writeFileSync(join(OUT_DIAGRAMS, `${slug}.svg`), output);
  }

  ws.close();
  const exited = new Promise((done) => chrome.once("exit", done));
  chrome.kill();
  await exited;
  rmSync(profile, { recursive: true, force: true });
  console.log(`diagrams: ${diagrams.size} rendered to ${OUT_DIAGRAMS}`);
}

await renderDiagrams();
