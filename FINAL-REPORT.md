# Final report

Measured 28 Nov 2026 on this machine, from the current `phase-11-alphabet` tree. Phase 10 was tried and reverted before this run, so the built site still uses `inlineStylesheets: 'always'`.

Commands used for the columns below:

- HTML gzip-9, brotli q11, and request count: `corepack pnpm budget` (that runs `corepack pnpm build`, then `node scripts/budget.mjs`). Requests are 1 HTML file plus each `script src`, stylesheet `href`, and `img src`. `verify-dist: ok` printed during that build.
- Inbound links: a Node crawl of the 18 sitemap HTML files. A page counts once when another sitemap page has an `<a href>` to it. A page does not count a link to itself. This is the same count used in Phase 1 and Phase 6.
- HTTP status: `curl.exe -s -o NUL -w "%{http_code}"` against `corepack pnpm dlx wrangler@4.54.0 pages dev dist --port 8799`.
- LCP and CLS: Playwright Chromium against `http://127.0.0.1:4174` (static `dist`). A `PerformanceObserver` was installed before navigation. Viewports were 390×844 and 1280×900. CLS was 0 at both widths on every page, so the table has one CLS column.
- Translator script row: the same `corepack pnpm budget` output, confirmed by reading the file and gzipping it with Node `zlib` level 9.

Baseline HTML and request numbers are the `BASELINE.md` table from 28 Nov 2026. Baseline LCP was not stored per page. The 27 Nov site measurement was a range of 108–228 ms. Baseline CLS was 0. Baseline inbound links were 17 for each footer page, 2 for `/widgets/`, 7 for `/i-love-you-in-morse-code/`, and 8 for `/how-morse-code-works/` and `/yes-in-morse-code/`.

## Baseline vs now

| Path | gzip KB base | gzip KB now | req base | req now | links base | links now | HTTP | LCP 390 | LCP 1280 | CLS |
| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| `/` | 33.2 | 33.4 | 9 | 9 | 17 | 17 | 200 | 160 | 164 | 0 |
| `/about/` | 11.9 | 12.0 | 3 | 3 | 17 | 17 | 200 | 72 | 96 | 0 |
| `/accessibility/` | 11.7 | 11.7 | 3 | 3 | 17 | 17 | 200 | 64 | 56 | 0 |
| `/american-morse-code-translator/` | 27.7 | 27.7 | 6 | 6 | 17 | 17 | 200 | 152 | 144 | 0 |
| `/contact/` | 11.8 | 11.8 | 3 | 3 | 17 | 17 | 200 | 48 | 60 | 0 |
| `/how-morse-code-works/` | 24.4 | 24.5 | 3 | 3 | 8 | 10 | 200 | 152 | 196 | 0 |
| `/i-love-you-in-morse-code/` | 23.9 | 23.9 | 4 | 4 | 7 | 10 | 200 | 76 | 156 | 0 |
| `/morse-code-alphabet/` | 14.3 | 14.8 | 3 | 3 | 17 | 17 | 200 | 48 | 104 | 0 |
| `/morse-code-audio-translator/` | 25.3 | 25.6 | 6 | 6 | 17 | 17 | 200 | 76 | 144 | 0 |
| `/morse-code-image-translator/` | 31.8 | 31.9 | 5 | 5 | 17 | 17 | 200 | 48 | 108 | 0 |
| `/morse-code-machine/` | 28.5 | 28.5 | 5 | 5 | 17 | 17 | 200 | 108 | 196 | 0 |
| `/morse-code-numbers/` | 13.3 | 13.3 | 3 | 3 | 17 | 17 | 200 | 104 | 120 | 0 |
| `/morse-code-speed-statistics/` | 17.0 | 17.0 | 3 | 3 | 17 | 17 | 200 | 204 | 108 | 0 |
| `/privacy/` | 12.4 | 12.4 | 3 | 3 | 17 | 17 | 200 | 44 | 52 | 0 |
| `/sos-in-morse-code/` | 13.3 | 13.3 | 3 | 3 | 17 | 17 | 200 | 92 | 92 | 0 |
| `/terms/` | 12.1 | 12.1 | 3 | 3 | 17 | 17 | 200 | 92 | 64 | 0 |
| `/widgets/` | 12.4 | 12.6 | 3 | 3 | 2 | 6 | 200 | 148 | 76 | 0 |
| `/yes-in-morse-code/` | 19.6 | 19.7 | 3 | 3 | 8 | 10 | 200 | 60 | 88 | 0 |
| `/404` | — | — | — | — | — | — | 404 | — | — | — |
| `/404/` | — | — | — | — | — | — | 404 | — | — | — |
| `/sitemap.xml` | — | — | — | — | — | — | 200 | — | — | — |
| `/favicon.svg` | — | — | — | — | — | — | 200 | — | — | — |
| `/site.webmanifest` | — | — | — | — | — | — | 200 | — | — | — |
| `/.well-known/security.txt` | — | — | — | — | — | — | 200 | — | — | — |
| `/this-page-does-not-exist/` | — | — | — | — | — | — | 404 | — | — | — |

`/sitemap.xml` returned the same body as `/sitemap-index.xml`. Every sitemap page had one `h1` and no page JavaScript error in the Playwright run. The highest LCP in this run was 204 ms (`/morse-code-speed-statistics/` at 390 px), under the 250 ms cap. Homepage LCP was 160 ms at 390 and 164 ms at 1280, inside the 108–228 ms baseline range.

### Homepage translator script

Command: `corepack pnpm budget`, confirmed with Node `zlib` gzip level 9.

| | File | Hash | Raw bytes | gzip-9 bytes |
| --- | --- | --- | ---: | ---: |
| BASELINE.md | `Translator.astro_astro_type_script_index_0_lang.BFwF2DBv.js` | `BFwF2DBv` | 19690 | 6083 |
| This run | `Translator.astro_astro_type_script_index_0_lang.BFwF2DBv.js` | `BFwF2DBv` | 19690 | 6083 |

Match.

## Phase acceptance

| Phase | Acceptance line | Result | How this run checked it |
| --- | --- | --- | --- |
| 1 | Payload report for every sitemap page, plus the translator script row | PASS | `corepack pnpm budget` printed all 18 pages and the translator row. `verify-dist: ok`. |
| 2 | Six short titles rewritten into the 50–60 range, descriptions still inside the checker limits, yes page and H1s left alone | PASS | `verify-dist: ok` (title ≤60, description 140–155, unique title and description, one `h1`). Built title lengths: about 54, American 51, privacy 59, contact 55, terms 55, accessibility 57. |
| 3 | `/404` and an unknown path return 404; `/contact/`, `/sitemap.xml`, `/favicon.svg`, `/site.webmanifest`, and `/.well-known/security.txt` return 200 | PASS | `curl.exe` against Wrangler Pages dev, listed in the table above. |
| 4 | FAQ text on the page matches FAQPage JSON-LD, and no answer is repeated across questions on the same page | PASS | Node comparison of the 11 FAQ pages in `dist`. 0 mismatches, 0 duplicate answers. JSON parsed with `JSON.parse`. |
| 5 | Cloudflare Web Analytics beacon, one extra request, no CSP error | Parked, not run | No Web Analytics site token was in the repo. The snippet was not added. |
| 6 | `/widgets/` above 5 inbound links, the three phrase pages above 9, no page below 5 | PASS | The crawl this run: widgets 6, the three phrase pages 10, every other sitemap page 17. |
| 7 | One Organization and one WebSite, breadcrumbs only where a trail is visible, JSON-LD parses | PASS | Node parse of every sitemap page this run. Each page has one Organization and one WebSite. BreadcrumbList is present only on pages whose HTML has the visible breadcrumb nav. |
| 8 | Share images 1200×630, under 300 KB, alt set | PASS | Node plus `sharp` this run. All 18 `og:image` and `twitter:image` URLs match, end in `.jpg`, and are 1200×630. Largest file is 53,412 bytes. The Phase 8 screenshot was not taken again. |
| 8b | Those same images are JPEG, not WebP | PASS | Same image check. Zero WebP share URLs. |
| 9 | Keyboard use of type, convert, clear, and copy; 44 px targets that failed are fixed | PASS | Playwright keyboard walk this run: SOS became `... --- ...`, Clear emptied both fields and returned focus to Text, Copy Morse code put `.... ..` on the clipboard. At 390 px the four mode labels are 78×44. |
| 10 | Move CSS out of the HTML only if every page's total transfer goes down and the page gains one CSS request | Evaluated and closed, no change | See below. `inlineStylesheets` is still `always`. |
| 11 | Letter and digit anchors, a jump row, and a one-page print chart, with HTML growth under 3 KB | PASS | Playwright this run: all 36 anchors (`#a`–`#z`, `#0`–`#9`) scrolled to the matching row. Print media hid the header, footer, and jump row. `page.pdf` was 1 page. Built alphabet HTML is 66,913 bytes, 1,623 bytes above the 65,290-byte file from before the anchors. |
| 12 | This report, Phase 3 status codes, translator script unchanged, and no page over the payload budget | MIXED | The report, status codes, and translator row pass. The strict payload lines do not. See the bottom. |

## Phase 10, evaluated and closed

`inlineStylesheets: 'auto'` was built once and then reverted. It did not stay in the tree.

`auto` wrote 6 CSS files. The homepage linked 3 of them and still kept 1,925 bytes inline. Requests went from 9 to 12 on `/`, and from 6 to 8 on the American and audio pages. HTML gzip fell (homepage 33.4 KB to 25.1 KB), but gzip of the HTML plus its CSS files was higher than the old HTML alone on 12 of 18 pages. The homepage first load was about 1.3 KB heavier. Full-page screenshots of the homepage, alphabet, audio, and about pages at 390 and 1280 px had 0 differing pixels. Local LCP did not show a benefit worth that cost (homepage 164 ms to 140 ms; alphabet 120 ms to 124 ms; audio 104 ms to 116 ms; about 56 ms to 96 ms). CLS stayed 0.

A single shared CSS file was not tried. Small pages would download CSS they do not use, and most visits are a single page.

## What failed or was skipped

- Phase 5 was not run. There is no Cloudflare Web Analytics token in the repo, so the beacon, the CSP host change, and the network-tab check were not done.
- Phase 10 was measured and closed with no source change. It does not pass its own acceptance (one extra CSS request, and lower total transfer on every page).
- The written payload rule is not met, and it was already not met in `BASELINE.md`. Homepage gzip is 33.4 KB, under the 40 KB cap. Six other pages are over 22 KB gzip: American 27.7, audio 25.6, image 31.9, machine 28.5, how Morse works 24.5, and I love you 23.9. Homepage requests are 9, above the cap of 6. No page gained a request. The largest gzip increase versus `BASELINE.md` is the alphabet page, 14.3 KB to 14.8 KB, under the 5 KB cap.
- The Phase 8 share-card screenshot was not taken again this pass. The file checks were.
- Production wire LCP from 27 Nov was not re-measured. The LCP numbers above are local Playwright against `dist`.
