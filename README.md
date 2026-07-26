# kmrrohit.vercel.app

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
| Weekly meetup details and schedule | `src/lib/meetup.ts` |
| Posts | `posts/<slug>/page.md` |
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

Two things to know about the markdown pipeline:

- Prose is compiled as Svelte, so a bare `{` in body text is parsed as an expression. Escape it or wrap it in backticks.
- Fenced blocks accept the languages listed in `mdsvex.config.js`. A fence with no language renders as an unhighlighted monospace block, which is what the ASCII diagrams use.

## Routes

`/` home · `/writing` index · `/writing/[slug]` post · `/projects` · `/about` · `/meetup` · `/rss.xml` · `/sitemap.xml`

`/blog` and `/blog/[slug]` 308-redirect to their `/writing` equivalents.

## Comments

Giscus is wired up but inactive until `repoId` and `categoryId` are filled in `src/lib/config.ts` — get them from [giscus.app](https://giscus.app). Until then the comments section is not rendered.
