# Social post drafts

Repo-only drafts for sharing writing on **LinkedIn** and **X**. Nothing here is routed by the site.

## Layout

```
social/
  README.md
  <slug>/
    linkedin.md   # paste into LinkedIn
    x.md          # paste into X (short + optional thread)
    card.png      # 1200×630 share image
    card.svg      # source for the card
```

## How to post

1. Open `social/<slug>/`.
2. Copy `linkedin.md` or `x.md`.
3. Attach `card.png`.
4. Add the canonical link: `https://kmrrohit.vercel.app/writing/<slug>`.

## Regenerating cards

```bash
npm run social-cards
```

Edit titles/hooks in `scripts/generate-social-cards.mjs`, then re-run. Draft copy in the markdown files is hand-written — the script does not overwrite it.

## Why this shape

| Option | Pros | Cons |
|---|---|---|
| **This folder (chosen)** | Versioned with the essay, easy to diff, no site surface | You still paste manually |
| Notion / Google Doc | Nice editing UX | Drift from the repo; another place to remember |
| Scheduled tool (Buffer, Typefully) | One-click publish | Paid; still need a source of truth for wording |
| Hidden `/social` route | Preview in browser | Accidental SEO / public exposure |

Keep drafts next to the writing they promote. When an essay changes materially, update the matching files here in the same PR.

## Voice notes

- First person, concrete, no “excited to share” filler.
- Lead with the idea, not the URL.
- LinkedIn can hold 4–8 short paragraphs; X prefers one punchy post (thread optional).
- Always include the link at the end so the platform does not bury it.
