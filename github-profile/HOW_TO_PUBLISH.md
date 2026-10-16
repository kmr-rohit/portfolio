# Publish the GitHub profile README

GitHub only renders a profile README from a **public** repo named exactly after the user: [`kmr-rohit/kmr-rohit`](https://github.com/kmr-rohit/kmr-rohit). This folder is the source of truth; the portfolio agent cannot push to that special repo.

## 1. Regenerate SVGs (optional)

From the portfolio root:

```bash
npm run github-profile
```

Writes `github-profile/assets/*.svg` and a copy under `static/github-profile/` (served at `https://kmrrohit.space/github-profile/` after deploy).

## 2. Copy into the profile repo

In `kmr-rohit/kmr-rohit` on `main`:

| From this folder | To `kmr-rohit/kmr-rohit` |
| --- | --- |
| `README.md` | `README.md` (replace the old one) |
| `assets/` | `assets/` |
| `.github/workflows/snake.yml` | `.github/workflows/snake.yml` |

Then commit and push. Relative `./assets/*.svg` paths resolve on the profile page.

## 3. Contribution snake (optional)

After the workflow file is in the profile repo, run **Actions → contribution snake → Run workflow**. When it finishes, uncomment the `<picture>` block at the bottom of the profile `README.md` (search for `github-contribution-grid-snake`).

## 4. GitHub profile metadata

The README does not update the GitHub **bio / location / website** fields. Those are still stale on github.com/kmr-rohit (Hyderabad, `kmrrohit.vercel.app`, “AI App Dev - I”). Set them in [profile settings](https://github.com/settings/profile):

- Bio: `AI engineer @ Oracle · GSoC 2026 · Kubeflow Docs Agent`
- Location: `Bengaluru, India`
- Website: `https://kmrrohit.space`
