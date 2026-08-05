# kmrrohit.space

Personal site and writing, built with SvelteKit, mdsvex and Tailwind, deployed on Vercel.

```bash
npm install
npm run dev
```

`npm run build` produces the production bundle, `npm run check` runs `svelte-check`.

## Where things live

| What | Where |
|---|---|
| Name, nav, social links, giscus ids | `src/lib/config.ts` |
| Projects | `src/lib/projects.ts` |
| Experience, skills, achievements | `src/lib/work.ts` |
| Community call details, LinkedIn posts | `src/lib/community.ts` |
| Application brief (custom form answers) | `PROFILE.md` · `/profile` |
| Referral / cold-DM templates (hidden) | `src/lib/referral.ts` · `/referral` (noindex, not in nav) |
| Résumés | `static/rohit-kumar-resume-ai.pdf` · `static/rohit-kumar-resume-software.pdf` |
| Posts | `posts/<slug>/page.md` |
| Hand-drawn sketches (Rough.js) | `static/sketches/` · `npm run sketches` |
| LinkedIn / X post drafts + share cards | `social/` · `npm run social-cards` (not on the site) |
| Colour tokens and link styles | `src/app.postcss` |
| Article prose styles | `src/lib/components/markdown/` |

## Writing a post

Create `posts/<slug>/page.md`. The folder name becomes the URL at `/writing/<slug>`.

```yaml
---
title: The two clocks
description: One sentence, used for the listing and the social card.
date: '2026-03-14'
tags:
  - Inference
draft: false
---
```

Read time is computed from the source in `src/lib/posts.ts`, so there is nothing to maintain by hand. Set `readTime` in frontmatter only to override it.

### Sketches

Architecture diagrams use [Rough.js](https://roughjs.com/) — the same sketch engine behind Excalidraw — so they read like notebook scraps rather than ASCII code blocks.

```bash
npm run sketches   # regenerates SVG into static/sketches/ and src/lib/sketches/
```

Embed in a post with a normal image whose `alt` becomes the caption:

```md
![Prefill writes Keys and Values into the KV-cache.](/sketches/prefill-decode-kv.svg)
```

You can also drop hand-authored Excalidraw SVG exports into those folders; anything under `/sketches/` gets the pasted-note frame.

Two things to know about the markdown pipeline:

- Prose is compiled as Svelte, so a bare `{` in body text is parsed as an expression. Escape it or wrap it in backticks.
- Fenced blocks accept the languages listed in `mdsvex.config.js`. A fence with no language renders as an unhighlighted monospace block, which is what the ASCII diagrams use.

## Routes

`/` home · `/writing` index · `/writing/[slug]` post · `/projects` · `/life` · `/about` · `/community` · `/profile` (application brief) · `/rss.xml` · `/sitemap.xml`

`/blog` and `/blog/[slug]` 308-redirect to their `/writing` equivalents.

## Comments

Giscus is wired up but inactive until `repoId` and `categoryId` are filled in `src/lib/config.ts` — get them from [giscus.app](https://giscus.app). Until then the comments section is not rendered.
