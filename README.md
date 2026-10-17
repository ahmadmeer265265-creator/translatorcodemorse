# Morse Code Translator

Static Astro site for [translatorcodemorse.com](https://translatorcodemorse.com).

## Scripts

Use pnpm 12.9.1 through Corepack (`corepack enable`, then `corepack pnpm <script>`).

- `pnpm dev` — local dev server
- `pnpm build` — `astro build` plus `scripts/verify-dist.mjs`
- `pnpm preview` — serve `dist/`
- `pnpm test` — Vitest
- `pnpm lighthouse` — local Lighthouse on the built pages (mobile uses realistic `--throttling-method=simulate` / Slow 4G + 4× CPU)
- `pnpm images` — regenerate the annotated homepage article screenshots (see below)
- `node scripts/generate-icons.mjs` — regenerate PNG favicons and the Open Graph image into `public/` (run by hand; commit the PNGs)

## Regenerating article screenshots

The homepage article embeds four annotated screenshots of the tool UI
(`src/assets/article/*.webp`). They are **not** regenerated during `npm run build`.

To update them after any UI change:

1. `npm run images`
2. Review the four files in `src/assets/article/`.
3. Commit the updated `.webp` files.

`npm run images` (see `scripts/generate-article-images.mjs`) builds `dist`, starts
a local preview, drives a real Chromium (1280×900, 2× device scale factor) through
Playwright, types `SOS` so panels are populated, captures each area, composites
numbered amber callout outlines, and overwrites the WebP files. It is idempotent
and safe to re-run. It never adds JS to the tool — the screenshots are static
images referenced from `HomeArticle.astro`.

## Config you may need before deploy

| File | What to change |
|---|---|
| `src/config/site.ts` | `SITE_URL` (no trailing slash) and `CONTACT_EMAIL` |
| `src/config/pages.ts` | `lastUpdated` (`YYYY-MM-DD`) for each indexable path — edit by hand only when that page’s content materially changes |

## Cloudflare Pages

Use the npm `build` script so the dist verifier runs. Do not set the build command to `astro build` alone.

| Setting | Value |
|---|---|
| Framework preset | Astro |
| Build command | `pnpm build` |
| Build output directory | `dist` |
| Node.js version | `22` (`.nvmrc` and `engines`; or `NODE_VERSION=22`) |
| Package manager | pnpm (`packageManager` is `pnpm@12.9.1`) |

`pnpm build` is `astro build && node scripts/verify-dist.mjs`. The second step fails the deploy if a built JS file does not parse, the audio chunk is not lazy, JSON-LD is invalid, the sitemap is wrong, placeholder copy leaked into HTML, or an indexable page fails the title / description / H1 / canonical uniqueness checks.

## Pre-deploy checklist

1. Set `SITE_URL` and `CONTACT_EMAIL` in `src/config/site.ts`.
2. Confirm `lastUpdated` dates in `src/config/pages.ts` for pages whose content changed.
3. `corepack pnpm install --frozen-lockfile`
4. `corepack pnpm test`
5. `corepack pnpm build` (must print `verify-dist: ok`)
6. Optional: `corepack pnpm lighthouse` on a free port
7. Deploy `dist/` with Cloudflare Pages using the settings above

## Stack

Astro 7 (static), TypeScript strict, Tailwind 4, Vitest. No ads, analytics, or third-party client scripts.
