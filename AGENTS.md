# AGENTS.md

## Cursor Cloud specific instructions

This is a static SvelteKit personal site (mdsvex + Tailwind, `@sveltejs/adapter-vercel`). It is a single frontend app with no backend services, database, or environment variables required to run locally. Standard commands live in `package.json` and `README.md`.

### Node version (important)
- `package.json` pins `engines.node: 24.x` and `.npmrc` sets `engine-strict=true`, so `npm install` and the scripts fail on the VM's default Node 22.
- Node 24 is installed via `nvm` and symlinked into `/usr/local/cargo/bin` (which precedes `/exec-daemon` in `PATH`), so `node -v` resolves to v24 automatically in new shells. If a shell somehow still shows Node 22, run `nvm use 24` (nvm is sourced from `~/.bashrc`).

### Run / build / check
- Dev server: `npm run dev` (Vite on `http://localhost:5173/`). This is the primary way to develop.
- Build: `npm run build` (outputs to `.svelte-kit/output`).
- Type/Svelte check: `npm run check` — passes clean.

### Content pipeline
- Posts live in `posts/<slug>/page.md` and render at `/writing/<slug>`; read time is computed automatically in `src/lib/posts.ts`. Adding a `page.md` with valid frontmatter is enough to publish a post (hot-reloads in dev).

### Known caveat: `npm run lint` is broken at the repo level
- `npm run lint` runs `prettier --check . && eslint .`. Prettier currently reports style issues across ~100 files, and there is **no ESLint config file** in the repo, so `eslint .` errors with "couldn't find a configuration file". Both failures are pre-existing repo state, not an environment problem. Do not mass-reformat or add an ESLint config unless the task explicitly asks for it. Use `npm run check` for type/Svelte validation instead.
