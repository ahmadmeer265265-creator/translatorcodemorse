# Payload baseline

Measured 28 Nov 2026 from `corepack pnpm budget` (Astro build + `verify-dist`, then local compression of `dist/sitemap-0.xml` HTML).

gzip is level 9. Brotli is Node `zlib` quality 11, which is tighter than the 27 Nov Cloudflare wire numbers (homepage 33.6 KB, alphabet 14.6 KB). Requests are 1 HTML document plus each `script src`, stylesheet `href`, and `img src`. `srcset` candidates are not counted. No `/_astro/*.css` file exists.

| Path | gzip-9 KB | brotli q11 KB | Requests | Inline style bytes | Style blocks | CSS refs |
| --- | ---: | ---: | ---: | ---: | ---: | ---: |
| / | 33.2 | 27.4 | 9 | 42775 | 1 | 0 |
| /about/ | 11.9 | 10.2 | 3 | 25715 | 1 | 0 |
| /accessibility/ | 11.7 | 10.0 | 3 | 25715 | 1 | 0 |
| /american-morse-code-translator/ | 27.7 | 22.5 | 6 | 33502 | 1 | 0 |
| /contact/ | 11.8 | 10.1 | 3 | 25715 | 1 | 0 |
| /how-morse-code-works/ | 24.4 | 18.9 | 3 | 25715 | 1 | 0 |
| /i-love-you-in-morse-code/ | 23.9 | 19.1 | 4 | 26952 | 1 | 0 |
| /morse-code-alphabet/ | 14.3 | 12.0 | 3 | 25715 | 1 | 0 |
| /morse-code-audio-translator/ | 25.3 | 20.6 | 6 | 38220 | 1 | 0 |
| /morse-code-image-translator/ | 31.8 | 24.9 | 5 | 37988 | 1 | 0 |
| /morse-code-machine/ | 28.5 | 23.1 | 5 | 34290 | 1 | 0 |
| /morse-code-numbers/ | 13.3 | 11.2 | 3 | 25715 | 1 | 0 |
| /morse-code-speed-statistics/ | 17.0 | 14.5 | 3 | 35680 | 1 | 0 |
| /privacy/ | 12.4 | 10.6 | 3 | 25715 | 1 | 0 |
| /sos-in-morse-code/ | 13.3 | 11.2 | 3 | 25715 | 1 | 0 |
| /terms/ | 12.1 | 10.3 | 3 | 25715 | 1 | 0 |
| /widgets/ | 12.4 | 10.7 | 3 | 25715 | 1 | 0 |
| /yes-in-morse-code/ | 19.6 | 15.5 | 3 | 25715 | 1 | 0 |

## Homepage translator script

| File | Hash | Raw bytes | gzip-9 bytes | Script requests |
| --- | --- | ---: | ---: | ---: |
| Translator.astro_astro_type_script_index_0_lang.BFwF2DBv.js | BFwF2DBv | 19690 | 6083 | 1 |

## Reconciliation

The audit PDF and this prompt do not list a numbered Phase 2 through Phase 12. The guardrails name only Phase 3 (the `/404` status) and Phase 10 (one cached CSS file). Findings below are what the current repo and live HTML actually show. Closed items are not to be fixed.

| Item | Result | Where |
| --- | --- | --- |
| Phase 10: `inlineStylesheets: 'always'`, no `/_astro/*.css` | Reproduced. Inline style is one block per page, but it is 42,775 bytes only on `/`. Other pages are 25,715–38,220 bytes. | `astro.config.ts` line 100 |
| Phase 3: `/404` answers 200 and must answer 404 | Reproduced live: `/404` is 200, an unknown path is 404. | `src/pages/404.astro` |
| `/contact/` answers 200 | Reproduced live. This is a real page, not a missing route. | `src/pages/contact.astro` |
| `/sitemap.xml`, `/favicon.svg`, `/site.webmanifest`, `/.well-known/security.txt` answer 404 | Reproduced live. `public/.well-known/` does not exist. | `public/` |
| `robots.txt` points at `/sitemap-index.xml` | Reproduced. | `src/pages/robots.txt.ts` line 5 |
| No analytics | Reproduced. No tracking snippet in source. | site source |
| CSP `connect-src 'self'` and `script-src 'self' 'unsafe-inline'` | Reproduced. | `public/_headers` lines 7–9 |
| FAQ examples called machine-written | Reproduced. Those questions and the “where you can convert” answer are still in the FAQ data. | `src/data/faq.ts` lines 4, 12, 21, 46 |
| Many pages share `/og-default.jpg`; some use WebP | Reproduced as a pattern. Four feature pages override it; the rest use the shared JPEG. Not counted page by page in this pass. | `src/config/site.ts` lines 19–22 |
| Three publisher names | Reproduced: `Morse Code Translator`, `Mir Labs`, and `Iris Labs`. | `src/config/site.ts` line 7; `src/pages/american-morse-code-translator.astro` line 82; `public/sitemap-video.xml` line 30 |
| Speed study citation hidden | Not reproduced. The Zenodo citation is now on the speed page. | `src/pages/morse-code-speed-statistics.astro` line 380 |
| HTML cache is `max-age=0, must-revalidate`; `/_astro/*` is immutable | Reproduced in config. Live cache headers were not re-measured. | `public/_headers` lines 9 and 33 |
| `<th>` missing `scope` | CLOSED. Cells in source use `scope`. | `src/pages/how-morse-code-works.astro` and the other table pages |
| Orphan pages | CLOSED by the current guardrails. Not re-opened. | — |
| Speed page missing its keyword | CLOSED by the current guardrails. The page title and body are about sending speed. There is no meta keywords tag. | `src/pages/morse-code-speed-statistics.astro` lines 8–10 |
| Yes-page title truncated by mistake | CLOSED. The 56-character title is deliberate. | `src/pages/yes-in-morse-code.astro` line 11 |
