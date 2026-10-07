# Competitor audit

Observed on 5 October 2026 from this machine. Nothing below is filled in from memory.

## Method

- Target homepages were downloaded with curl (`200` responses). SEO fields, headings, links, and feature words were parsed from that HTML.
- Word counts are approximate: scripts and style blocks removed, tags stripped, then split on whitespace. They include navigation and footer text.
- A feature is marked **seen** only when that word or control was in the fetched HTML or, where noted, in a browser accessibility tree. **seen** is not proof the control works. Playback, downloads, and microphone decoding were not operated, so those outcomes are NOT VERIFIED.
- Sitemaps and `robots.txt` were fetched separately. `https://morsecode.world/sitemap.xml` returned HTTP 404 and an HTML body, so that site's full URL list is NOT VERIFIED. Its page list below is the internal links in the translator HTML.
- Lighthouse 13.5.0, mobile, headless Chrome, was run against the five target homepages. Transfer size, JS, CSS, and request counts are that run's network log.
- Google results were read in the Cursor browser, not from the curl download. The curl of `google.com/search` returned a page titled "Google Search" with no organic links (an access fallback). Those curl files are not used as rankings.
- The browser showed a location control. Query 1: "Islamabad - From your IP address". Query 2: "Mirpur, Abbottabad - From your device". Both URLs included `pws=0` and `hl=en`. This is not a US ranking.
- Each query produced 9 result headings with links inside `#rso`. A 10th organic result was NOT VERIFIED.

## Task 0 notes used by this audit

`SITE_NAME` in `src/config/site.ts` is `Morse Code Translator`. It was not changed.

Search of the project, excluding `node_modules`, `dist`, `.astro`, and `.lighthouse`, found the old placeholder only in `src/config/site.ts` before the edit. After the edit, `example.com` has zero matches. Other URLs in source are not this site's host: `https://schema.org` in JSON-LD, and Inter's license links to `https://github.com/rsms/inter` and `http://scripts.sil.org/OFL`. `package.json` `"name"` is `morse-code-translator`, a package name, not a domain.

---

## Google: "morse code translator"

Browser URL: `https://www.google.com/search?q=morse+code+translator&hl=en&num=10&pws=0`

An AI Overview sat in the results. Its visible citations included Morse Code World, Coddy Tech (`coddy.tech`), morsecodeapp.com, and morse-codetranslator.com. Those citations are not counted as the web-result list below.

| # | Result as shown | In the five-site list? |
|---|---|---|
| 1 | Morse Code Translator — Convert, Play & Decode, www.morsecode-translator.com | No |
| 2 | Morse Code Translator - Apps on Google Play, `play.google.com` … `id=com...` | No |
| 3 | Morse Code World, https://morsecode.world | Yes |
| 4 | Morse Code Audio Decoder, morsecode.world › international › audio-decoder | Same site as #3 |
| 5 | Morse code translator, academo.org › demos › morse-code-translator | No |
| 6 | Morse Code LED Reader, airgradient.com › morse | No |
| 7 | Morse Code Translator \| Text Converter, funtranslations.com › Translators | No |
| 8 | MORSE CODE TRANSLATOR \| AUDIO \| DECODER, morsecodeninja.com | No |
| 9 | Morse Code Translator - mrlogan.net | No |

Not in this 9-result list: `morse-codetranslator.com` (it was an AI Overview citation), `morsecodeapp.com` (AI Overview citation), `morsecodetranslator.tools`, `morsecodemaster.com`.

10th organic result: NOT VERIFIED.

## Google: "morse code translator audio"

Browser URL: `https://www.google.com/search?q=morse+code+translator+audio&hl=en&num=10&pws=0`

| # | Result as shown | In the five-site list? |
|---|---|---|
| 1 | mkouhia/morse-audio-decoder, GitHub | No |
| 2 | Morse Code Translator — Convert Text to Morse & Play, redstaglabs.com › Home › tools | No |
| 3 | Morse Code Audio Translator Online, simplified.com › Audio Translator | No |
| 4 | Best Morse Code Translator — Translate · Learn · Play, morse-codetranslator.com | Yes |
| 5 | MORSE CODE TRANSLATOR \| AUDIO \| DECODER, morsecodeninja.com | No |
| 6 | Morse Code : Audio Decoder, Google Play (the heading was partly in Bengali script) | No |
| 7 | Morse code translator: Encode and convert online, cryptii.com › pipes › morse-code-translator | No |
| 8 | Decode Morse Code Audio, saascounter.com › Blog | No |
| 9 | Audio Morse Code Translator: Extract Signals from Sound file, morse-coder.com › decoders › decode-audio | No |

AI Overview citations on this page named morse-coder.com, morsecodegenerator.org, SaasCounter, and Aback Tools. Those were not all separate rows in the table above.

10th organic result: NOT VERIFIED.

Top three extras from query 1, fetched when possible:

1. `https://www.morsecode-translator.com/` opened in the browser. Curl to that host timed out (HTTP 000, 0 bytes).
2. Play Store listing: curl timed out after 607,803 bytes. The saved file has no `<title>` and no `</html>`. Page content NOT VERIFIED.
3. `https://academo.org/demos/morse-code-translator/` downloaded (HTTP 200, 20,484 bytes).

---

## 1. https://morsecode.world/international/translator.html

Fetched HTTP 200, 93,742 bytes. Final URL unchanged.

### A. On-page SEO

- Title: `Morse Code Translator | Morse Code World` (40 characters).
- Meta description (313 characters): "The translator can translate between Morse code and Latin, Hebrew, Arabic and Cyrillic alphabets. It can play, flash or vibrate the Morse code. You can also save the sound and share a link to use it to send messages to your friends. The speed, Farnsworth speed and frequency of the sound are all fully adjustable."
- H1: Morse Code Translator.
- H2: Discover more, Advanced Controls, Server Error, Message Not Shared, Theme.
- H3: Text to Morse, Morse to Text, Sound, Light & Vibration, Decode by ear, Morse code reference, What is SOS?, Morse code and the Titanic.
- Approximate words: 1,001.
- Canonical: `https://morsecode.world/international/translator.html`.
- Robots meta: not present in the fetched HTML.
- URL: path contains `translator`. The host is `morsecode.world`, not the phrase "morse code translator".
- Keyword in title and H1: yes.
- Open Graph: description, type `website`, site_name Morse Code World, title Morse Code Translator, url as canonical, image `https://morsecode.world/img/logo315px.png` (PNG, 315×315). Twitter card `summary`, site and creator `@morsecodeworld`.
- JSON-LD: none found.
- FAQ: `/faq.html` is linked. No FAQPage JSON-LD on this HTML.
- Internal links in this HTML include the translator, machine, a trainer section (generator, trainer, Japanese trainer, character, adaptive ICR, words, QSO, headlines, keyer, progress, help), audio decoders (adaptive and expert), Morse reference, Farnsworth and Wordsworth timing, American Morse translator/trainer/reference, labs (decoder, gaze decoder, sending practice, QSO, headlines, words, exact copy), keys, iambic, keyer efficiency, QSO formats and examples, alphabet, SOS, Titanic, FAQ, contact, privacy, licences.

### B. Tool features seen in this HTML

Text to Morse, Morse to text, audio, WPM, words per minute, Farnsworth, flash, vibration, download, WAV, MP3, microphone, trainer links, copy, share, punctuation, Cyrillic, Arabic, Hebrew, the phrase "dark mode", SOS. The word "flashlight" was not in the HTML; "flash" was. "blog" was not in the HTML.

Working audio, file download, and mic decode: NOT VERIFIED.

### C. Supporting content

From links on this page, not from a sitemap (`/sitemap.xml` was HTTP 404):

- International and American translators and references.
- Trainer and decoder suites, including audio decoder URLs.
- Timing pages (Farnsworth, Wordsworth).
- Reference articles: alphabet, SOS, Titanic, FAQ, keys, iambic keying, QSO formats.
- Labs tools.
- Shop link to `shop.morsecode.world` (external).

`robots.txt` (65 bytes, HTTP 200) disallows `/cgi-bin/`, `/js/`, and `/inc/`. It does not name a sitemap.

### D. Performance and tech

No Next, Nuxt, WordPress, or Astro marker in the HTML. Scripts: `pubfig.min.js` on `a.pub.network`, a local jQuery shim, `/js/pckg/ad/popup2.js`, and a local translator bundle. One local stylesheet. A woff2 URL for Rajdhani was in the HTML. Cloudflare string was present.

Lighthouse mobile:

| Performance | Accessibility | Best Practices | SEO | LCP | CLS | TBT |
|---|---|---|---|---|---|---|
| 53 | 98 | 54 | 92 | 3.1 s | 0 | 12,880 ms |

Transfer 6,282,251 bytes. 1,799 requests. Script transfer 2,581,859 bytes. Stylesheet transfer 28,015 bytes. Third-party hosts in the log included `a.pub.network`, `d.pub.network`, `c.pub.network`, `securepubads.g.doubleclick.net`, `c.amazon-adsystem.com`, Criteo, IntentIQ, Hadron, ID5, Amazon APS, Primis, and several safeframe hosts. Failed weighted audits included LCP, TBT, speed index, heading order, deprecations, third-party cookies, console errors, inspector issues, and crawlable anchors.

### E. UX

Visual mobile layout and above-the-fold screenshot: NOT VERIFIED. The lab run shows a very large ad-related request graph and a 12.9 s blocking time. Accessibility score 98, with heading-order failing.

### F. Beat and match

Beat: page weight, ad stack, missing JSON-LD, 313-character description, and the crawlable-anchors failure. Match: bidirectional translator, adjustable speed including Farnsworth, sound plus light, non-Latin alphabets, shareable links, and the depth of trainer, decoder, SOS, and alphabet pages.

## 2. https://morse-codetranslator.com/

Fetched HTTP 200, 185,581 bytes.

### A. On-page SEO

- Title: `Best Morse Code Translator — Translate · Learn · Play` (53 characters).
- Meta description (145 characters): "Use our free Morse code translator. Convert text to dots and dashes instantly. Play the audio, download the code, and decode secret messages now."
- Robots: `follow, index, max-snippet:-1, max-video-preview:-1, max-image-preview:large`.
- H1: The Best Morse Code Translator.
- H2: What Is Morse Code?; Hands-On Morse Code Translator in Seconds; Features of Our Morse Code Translator; Learn the Morse Code Alphabet, Numbers and Symbols; How to Read and Write Morse Code; Morse Code Sounds: The Rhythm of Communication; Learn Morse Code with Sound; Learn Morse Code Step by Step; Modern Uses of Morse Code; Why Morse Code Still Matters Today; Why Choose Our Morse Code Translator; Common Morse Code Translations; How to Improve Morse Code Skills; Frequently Asked Questions; Related Blogs.
- H3 includes numbered how-to steps, a full chart heading, punctuation, rhythm, timing, and many phrase links (I, K, No, B, Y, N, G, L, J, Yes, S, Darius).
- Approximate words: 5,172.
- Canonical: `https://morse-codetranslator.com/`.
- Keyword in title, H1, and host: yes. The host joins "code" and "translator".
- JSON-LD types parsed: Person, Organization, WebSite, ImageObject, WebPage, Article, FAQPage.
- Open Graph tags were not in the meta walk used for the other sites in a way I re-printed here. NOT VERIFIED as a complete OG inventory beyond what the first parser truncated. I will not invent them.
- FAQ heading and FAQPage type: yes.

### B. Tool features seen in this HTML

Text to Morse, Morse to text, audio, WPM, Farnsworth, flashlight, flash, vibration, download, WAV, MP3, copy, share, punctuation, practice, chart, history, SOS. Cyrillic, Arabic, and Hebrew strings were not found. The exact phrase "dark mode" was not found ("dark" as a substring was, and is not treated as a theme control).

Working controls: NOT VERIFIED.

### C. Supporting content

Sitemap HTTP 200, 42 `<loc>` URLs. Topics include audio translator, image translator, quiz, cheat sheet, alphabet, letters, numbers, words, key, international Morse, how it works, how to learn, when it was invented, whether it is still used, SOS, hi, hello, help, help me, I love you, love, yes, no, single letters (a, s, j, l, g, n, y, b, k, i), Darius, and "we used to live here". Plus about, contact, updates, disclaimer, privacy, terms.

`robots.txt` allows `/` and points at `https://morse-codetranslator.com/sitemap.xml`.

### D. Performance and tech

The HTML contains both `wp-content` paths and `/_next/static` chunks, so both a WordPress path and a Next.js path were present. MediaVine script `scripts.mediavine.com` is in the HTML. Ads marker: yes.

Lighthouse mobile:

| Performance | Accessibility | Best Practices | SEO | LCP | CLS | TBT |
|---|---|---|---|---|---|---|
| 29 | 100 | 58 | 100 | 7.2 s | 0.007 | 2,140 ms |

Transfer 1,024,683 bytes. 55 requests. Script transfer 582,925 bytes. Stylesheet transfer 12,255 bytes. Third parties included MediaVine, Grow.me, scriptwrapper, Google tag manager, Google Analytics, doubleclick, consentmanager, Cloudflare insights. Failed weighted audits: FCP, LCP, TBT, speed index, deprecations, third-party cookies, inspector issues.

### E. UX

Visual layout: NOT VERIFIED. Lab data shows the worst LCP of the five and an ad network on the page. Accessibility score was 100 in this run.

### F. Beat and match

Beat: 7.2 s LCP, MediaVine, and the thin single-letter URL pattern if those pages are doorway-like (content quality of those URLs was NOT VERIFIED; only the sitemap URLs were fetched). Match: homepage copy volume, FAQ schema, alphabet and number hubs, phrase pages (SOS, I love you), audio page, and image-translator URL.

## 3. https://morsecodeapp.com/

Fetched HTTP 200, 109,581 bytes.

### A. On-page SEO

- Title: `Morse Code Translator – Morse to Text – Text to Morse Code` (58 characters).
- Meta description: no `name="description"` meta in the fetched HTML.
- Canonical: not present.
- Robots meta: not present.
- H1: MORSE CODE TRANSLATOR.
- H2: a lead line about converting, playing audio, tap input, and live decode; TAP INPUT MODE; AUDIO DECODER; What Is a Morse Code Translator?; How to Translate Morse Code; How Morse Code Encoding Works; Getting the Most Out of Your Translator; When to Use This Morse Code Translator; A Brief History of Morse Code; Understanding Your Settings; Frequently Asked Questions; Learn More About Morse Code; Ready to Translate?; CHANGELOG; SETTINGS.
- H3 includes share, embed, what it handles, what it does not do, text-to-Morse, Morse-to-text, tap input, audio decode, emergency, ham radio, school, jewelry, puzzles, accessible input, SOS, audio settings, timing, display.
- Approximate words: 4,449.
- Keyword in title and H1: yes. Host is `morsecodeapp.com`, which does not contain "translator".
- JSON-LD: none found.
- Open Graph: none found in the meta scan.
- FAQ heading: yes. FAQ schema: not found.
- Internal `href="/..."` links: none in the fetched HTML. The sitemap is the page list.

### B. Tool features seen in this HTML

Text to Morse, Morse to text, audio, WPM, Farnsworth, flash, vibration, download, WAV, MP3, microphone, tap input, live audio decoder heading, copy, share, punctuation, Cyrillic, Arabic, practice, chart, history, SOS. Hebrew string: not found. Exact "dark mode": not found. "flashlight": not found; "flash" was.

Working mic decode: NOT VERIFIED.

### C. Supporting content

Sitemap HTTP 200, 9 URLs:

- `/`
- `/learn/what-is-morse-code`
- `/learn/how-morse-code-works`
- `/learn/sos-in-morse-code`
- `/learn/i-love-you-morse-code`
- `/about`, `/terms`, `/privacy`, `/contact`

No blog URL in that sitemap. The homepage HTML does contain the word "blog".

`robots.txt` allows `/`, disallows `/admin/`, `/embed/`, and `/embed.js`, and names the sitemap.

### D. Performance and tech

No Next/WordPress/Astro marker. Google Tag Manager script is in the HTML. Fonts: `fonts.googleapis.com` and `fonts.gstatic.com` appeared in the Lighthouse host list and in the HTML scan.

Lighthouse mobile:

| Performance | Accessibility | Best Practices | SEO | LCP | CLS | TBT |
|---|---|---|---|---|---|---|
| 56 | 90 | 100 | 100 | 4.5 s | 0.001 | 700 ms |

Transfer 323,287 bytes. 15 requests. Script transfer 192,599 bytes. Stylesheet transfer 17,431 bytes. Third parties: Google Tag Manager, Google Fonts, Google Analytics. Failed weighted audits: FCP, LCP, TBT, speed index, aria-hidden-focus, button-name, link-in-text-block. SEO still scored 100 even with no description or canonical in the HTML I parsed. I am not overriding that score.

### E. UX

Visual layout: NOT VERIFIED. Accessibility failures observed by Lighthouse: focused element inside `aria-hidden`, buttons without accessible names, and link color not distinguished in a text block.

### F. Beat and match

Beat: missing description, canonical, and schema; Google Fonts on the critical path; the three accessibility failures. Match: tap keyer, live audio decoder copy, WPM and Farnsworth, SOS and "I love you" URLs, and a short learn cluster.

## 4. https://morsecodetranslator.tools/

Fetched HTTP 200, 134,548 bytes.

### A. On-page SEO

- Title: `Morse Code Translator – Text to Morse & Morse to Text` (53 characters).
- Meta description (140 characters): "Translate text to Morse code and Morse code to text instantly. Copy, play, share, or download results with private browser-based processing."
- Robots: `index, follow`.
- H1: Morse Code Translator.
- H2: Text and Morse code translator; Translate in either direction; How the signal is written; Write Morse that decodes cleanly; Check the result in the form you need; Use the translator for a complete task; Compare complete Morse code examples; Morse alphabet at a glance; Hear rhythm, not just dots and dashes; Morse translator FAQ; International Morse.
- H3 covers typing, pasting, panels, character and word gaps, spaces, slashes, punctuation, listening, copy or download, share, SOS, HELLO WORLD, ARE YOU OK?, local processing.
- Approximate words: 1,604.
- Canonical: `https://morsecodetranslator.tools` (no trailing slash in the tag).
- Keyword in title and H1: yes. The host is the phrase without spaces.
- JSON-LD types: WebApplication, FAQPage.
- Open Graph: title, description, url, site_name Morse Code Translator, locale `en`, image `/opengraph-image`, type website. Twitter card `summary_large_image` with the same title, description, and image. `twitter:site` was the site URL, not a @handle.
- FAQ heading and FAQPage: yes.
- Homepage links: `/`, `/#translator`, alphabet, learn, blog, about, research timing article, editorial policy, privacy, terms, and three hash examples (SOS, HELLO WORLD, ARE YOU OK?).

### B. Tool features seen in this HTML

Text to Morse, Morse to text, audio, WPM, flash, download, WAV, copy, share, punctuation, practice, chart, SOS, alphabet. Not found: Farnsworth, flashlight, vibration, MP3, microphone, Cyrillic, Arabic, Hebrew, the phrase "dark mode".

Working controls: NOT VERIFIED.

### C. Supporting content

Sitemap HTTP 200, 54 URLs. Distinct topics beyond the homepage:

- `/morse-code-alphabet`, `/learn-morse-code`, `/research/morse-code-timing`, `/about`, editorial policy, privacy, terms.
- Blog posts and category/tag URLs, including spacing, letters, I love you, necklaces, letter S, numbers, no, phonetic alphabet chart, sound translator, help, a learning timeline, tapping rhythm, beginner learning, best way to learn, and practical phrases.

`robots.txt` allows `/`, disallows query `q`, sign-in, settings, activity, admin, and API, and names the sitemap.

### D. Performance and tech

`/_next/static` chunks: Next.js. 28 script URLs in the HTML, mostly those chunks. One CSS file under `/_next/static/css/`. No Google Fonts URL in the HTML. Font files themselves: NOT VERIFIED (they may be inside CSS).

Lighthouse mobile:

| Performance | Accessibility | Best Practices | SEO | LCP | CLS | TBT |
|---|---|---|---|---|---|---|
| 65 | 96 | 100 | 100 | 4.0 s | 0 | 450 ms |

Transfer 434,534 bytes. 33 requests. Script transfer 377,026 bytes. Stylesheet transfer 28,394 bytes. Third party in the log: `static.cloudflareinsights.com`. Failed weighted audits: FCP, LCP, TBT, speed index, color contrast. This was the best performance score of the five.

### E. UX

Visual layout: NOT VERIFIED. Lighthouse recorded a color-contrast failure. No ad network appeared in the request log. Cloudflare analytics beacon did.

### F. Beat and match

Beat: 377 KB of JavaScript and the contrast failure. This is the closest performance competitor and the one with FAQ schema plus a research article. Match: bidirectional tool, WPM, WAV, copy and share, alphabet page, learn page, and a real blog rather than only letter doorway URLs.

## 5. https://morsecodemaster.com/

Fetched HTTP 200, 192,549 bytes.

### A. On-page SEO

- Title: `Morse Code Master - Free Online Text to Morse Code Translator` (61 characters).
- Meta description (178 characters): "Free online Morse code translator. Convert text to Morse code and Morse code to text instantly. Play audio, see visual flashes, and access the complete Morse code alphabet chart."
- Robots: `index, follow`.
- H1: Morse Code Master. The phrase "morse code translator" is in the title and description, not in the H1.
- H2: Morse Code Translator; International Morse Code Reference; About Morse Code; How to Use This Morse Code Translator; Frequently Asked Questions About Morse Code; Learn Morse Code: Morse Code Translator, Interpreter & Alphabet Guide; Latest Articles.
- H3 includes output, audio playback, settings, letters, numbers, punctuation, special signals, what it is, history, modern use, how it works, enter text, enter Morse, real-time conversion, play, adjust, copy, several FAQ questions, and three article titles.
- Approximate words: 1,691.
- Canonical: `https://morsecodemaster.com/`.
- Keyword in title: yes. In H1: no. In host: the host does not contain "translator".
- Generator meta: `Next.js`.
- JSON-LD: none found.
- Open Graph: title, description, url, site_name, locale `en_US`, image `/og-image.png` with width 1200, height 630, alt text, type png, og type website. Twitter `summary_large_image`, creator `@morsecodemaster`.
- FAQ section: yes. FAQPage schema: not found.
- Homepage links include localized lesson, Koch, trainer, games, knowledge (alphabet, abbreviations, words, phrases, history), codebook, creative, blog, privacy, terms, and an outbound image-to-image.org campaign link.

### B. Tool features seen in this HTML

Text to Morse, Morse to text, audio, WPM, Farnsworth, flashlight, flash, download, WAV, trainer, practice, copy, share, punctuation, chart, history, SOS. Not found: vibration, MP3, microphone, Cyrillic, Arabic, Hebrew, the phrase "dark mode".

Working controls: NOT VERIFIED.

### C. Supporting content

Sitemap HTTP 200, 333 `<loc>` values. Locales in those URLs: en, zh, es, fr, de, ja, ko, pt, ru, ar. English path stems (33):

- `/`, `/lessons/`, `/lessons/koch/`, `/lessons/1/` through `/lessons/8/`
- `/trainer/`, `/games/`, `/games/spy/`, `/games/ship/`, `/games/space/`
- `/creative/`, `/codebook/`
- `/knowledge/`, alphabet, abbreviations, words, phrases, history
- `/blog/` plus eight article slugs: military secrecy, custom codebook, amateur-radio contact procedure, light signals, whether Morse is still useful, what international Morse is, daily practice, best ways to learn

The other locales repeat those paths. I did not open each locale. Hreflang behavior: NOT VERIFIED.

`robots.txt` allows `/`, disallows `/_next/static/`, `/api/`, `/admin/`, and `/index.html`, and names the sitemap.

### D. Performance and tech

Next.js, from the generator meta and `/_next/static` scripts (16 script URLs, 3 CSS files). Google Tag Manager is in the Lighthouse third-party list. A Cloudflare beacon script is in the HTML. No woff2 or Google Fonts URL in the HTML scan. Actual font files: NOT VERIFIED.

Lighthouse mobile:

| Performance | Accessibility | Best Practices | SEO | LCP | CLS | TBT |
|---|---|---|---|---|---|---|
| 60 | 96 | 92 | 100 | 4.6 s | 0 | 850 ms |

Transfer 648,733 bytes. 43 requests. Script transfer 369,544 bytes. Stylesheet transfer 35,323 bytes. Third parties: Google Tag Manager, Google Analytics, Cloudflare insights. Failed weighted audits: FCP, LCP, TBT, speed index, color contrast, image-size-responsive, console errors.

### E. UX

Visual layout: NOT VERIFIED. The HTML includes an outbound display campaign link to image-to-image.org. Lighthouse recorded contrast and responsive-image failures. I did not see a full-screen ad in a screenshot because I did not open this page in the browser.

### F. Beat and match

Beat: H1 does not contain the main query, no FAQ schema, 333 near-duplicate locale URLs, contrast, and about 370 KB of JS. Match: trainer, Koch lessons, games, codebook, knowledge hub, and a real article set. That learning product is the widest of the five.

---

## Extra result: morsecode-translator.com

Opened in the browser. Curl timed out, so there is no saved HTML file and no Lighthouse run. Lighthouse, page weight, request count, and third-party script list: NOT VERIFIED.

From the live accessibility tree and `document` meta:

- Title: `Morse Code Translator — Convert, Play & Decode` (46 characters).
- Description (128 characters): "Convert text to Morse code and decode Morse back to text. Play audio, download WAV, and use the alphabet chart. Free, no signup."
- Canonical: `https://www.morsecode-translator.com/`.
- Robots meta: empty.
- H1: Morse Code Translator.
- JSON-LD types read from the DOM: WebApplication, Organization.
- Controls present in the accessibility tree, above the first content H2: Text to Morse, Morse to Text, swap, text boxes, Clear, Random, Copy, Share, Play, Stop, Download WAV, Repeat, Light, Vibrate, a WPM spinbutton set to 20, Configure.
- The features section text on the page says audio uses 5–40 WPM, Farnsworth, pitch, volume, sine/square/sawtooth/triangle, light, phone vibration, and WAV. The FAQ text says decoding is from typed dots and dashes, not microphone audio.
- Dark Mode is a menu item.
- Language list in the menu included Indonesian, Danish, German, English, Spanish, French, Italian, Hungarian, Dutch, Polish, Portuguese, Romanian, Finnish, Swedish, Vietnamese, Turkish, Czech, Greek, Russian, Hebrew, Arabic, Thai, Japanese, Chinese, and Korean. Whether those locales are real pages: NOT VERIFIED.
- Linked sections: image translator, alphabet, learn, blog, changelog, FAQs, about, contact, privacy, terms, disclaimer, plus phrase links (SOS, I love you, hello, hi, help, help me, yes, no, love).
- Visible blog titles: SOS still matters, mastering the basics, real-world uses.
- H2 outline observed: What is Morse Code?; How Does Morse Code Work?; What Is a Morse Code Translator?; Features Offered by This Tool; How to Use the Morse Code Translator; The History of Morse Code; Why Use Morse Code Today?; Advanced Features; Learning Morse Code; Why Choose This Morse Code Translator?; Popular Morse Code Translations; Frequently Asked Questions.
- Ads in the accessibility tree: none seen. A full ad-network check: NOT VERIFIED.
- Above the fold: the translator controls were in the tree before the explanatory H2s.

## Extra result: Google Play app

Listing URL pattern shown by Google: `play.google.com` with id starting `com.Morse.Translator`. The download did not finish. Title, description, rating, and install count: NOT VERIFIED.

## Extra result: academo.org/demos/morse-code-translator

Fetched HTTP 200, 20,484 bytes. Lighthouse: NOT VERIFIED.

- Title: `Morse code translator | Academo.org - Free, interactive, education.` (67 characters).
- Description (145 characters): "Use this online tool to generate morse code from regular text. Your input is converted into dots and dashes, and you can listen to how it sounds."
- H1: Morse code translator.
- H2: none.
- H3: List of letters and numbers in morse code; You might also be interested in.
- Words: about 376.
- Canonical link tag: not present. `og:url` is `https://academo.org/demos/morse-code-translator/`.
- JSON-LD: none.
- Open Graph and Twitter tags are present, including a 1200×630 image.
- Description talks about text to Morse and listening. Morse-to-text, WPM, download, and mic decode: NOT VERIFIED (those words were not extracted as a feature pass).
- Scripts include jQuery from Google's CDN, Adsence `pagead2.googlesyndication.com`, Carbon ads, Media.net, BuySellAds, cookie consent from jsDelivr, and a local `jscwlib` Morse demo script.
- Stylesheet includes a Google Fonts CSS URL for Material Symbols.
- Google Analytics string was in the HTML.

---

## Comparison

Feature cells mean the string or control was seen, not that it was operated.

| | world | morse-codetranslator | morsecodeapp | .tools | master | morsecode-translator.com |
|---|---|---|---|---|---|---|
| Perf / A11y / BP / SEO | 53 / 98 / 54 / 92 | 29 / 100 / 58 / 100 | 56 / 90 / 100 / 100 | 65 / 96 / 100 / 100 | 60 / 96 / 92 / 100 | 54 / 97 / 73 / 100 |
| LCP / CLS / TBT | 3.1 s / 0 / 12.9 s | 7.2 s / 0.007 / 2.1 s | 4.5 s / 0.001 / 700 ms | 4.0 s / 0 / 450 ms | 4.6 s / 0 / 850 ms | 3.1 s / 0.055 / 1,410 ms |
| Transfer / requests | 6.0 MB / 1,799 | 1.0 MB / 55 | 316 KB / 15 | 424 KB / 33 | 634 KB / 43 | 636 KB / 53 |
| JS / CSS transfer | 2.5 MB / 27 KB | 569 KB / 12 KB | 188 KB / 17 KB | 368 KB / 28 KB | 361 KB / 35 KB | 439 KB / 12 KB |
| Title length | 40 | 53 | 58 | 53 | 61 | 46 |
| Description length | 313 | 145 | none | 140 | 178 | 128 |
| H1 has "translator" | yes | yes | yes | yes | no | yes |
| JSON-LD | none | WebSite, FAQPage, Article, others | none | WebApplication, FAQPage | none | WebApplication, Organization |
| Ads or ad hosts | pubfig, Google/Amazon ads | MediaVine | none in the log | none in the log | none in the log | AdSense, Clarity, Cloudflare beacon |
| Text and Morse both ways | seen | seen | seen | seen | seen | controls seen |
| Audio play | seen | seen | seen | seen | seen | Play button seen |
| WPM | seen | seen | seen | seen | seen | spinbutton seen |
| Farnsworth | seen | seen | seen | not seen | seen | page text seen |
| Light | flash seen | flashlight seen | flash seen | flash seen | flashlight seen | Light button seen |
| Vibrate | seen | seen | seen | not seen | not seen | button seen |
| WAV download | seen | seen | seen | seen | seen | button seen |
| Mic or file decode | mic word; decoder URLs linked | not seen on homepage HTML | Audio Decoder heading | not seen | not seen | FAQ says mic decode is not what this tool does |
| Trainer | many trainer URLs | practice copy | practice copy | practice copy | trainer, Koch, games | learn link; a trainer app NOT VERIFIED |
| Non-Latin | Hebrew, Arabic, Cyrillic | not seen | Cyrillic, Arabic | not seen | not seen | Hebrew and Arabic in a language menu; pages NOT VERIFIED |
| Dark mode | phrase seen | not seen as a phrase | not seen as a phrase | not seen as a phrase | not seen as a phrase | menu item seen |
| Alphabet or chart | alphabet URL | chart section and URLs | chart words; no chart URL in sitemap | alphabet URL | alphabet URL | alphabet link |
| FAQ | FAQ URL | FAQ heading and schema | FAQ heading, no schema | FAQ heading and schema | FAQ heading, no schema | FAQ link |
| Blog or articles | not seen | 42 sitemap URLs, many single phrases | 4 learn URLs | blog and research URLs | lessons, knowledge, 8 EN articles × 10 locales | blog links seen |

## Gap list

Seen on one site, or on none of the five homepages:

- A fast page with no ad waterfall. The best lab score here was 65. None was close to a 100 performance score. world and morse-codetranslator.com pay for that with pubfig and MediaVine.
- Microphone or file decode is a heading on morsecodeapp.com and a set of decoder URLs on morsecode.world. It was not seen on morsecodetranslator.tools or morsecodemaster.com. The current number-one result's own FAQ says it does not decode microphone audio.
- Image-to-Morse is a first-class link on morsecode-translator.com and a sitemap URL on morse-codetranslator.com. It was not seen on the other target homepages.
- Koch lessons plus games were seen on morsecodemaster.com only.
- American Morse was seen on morsecode.world only.
- Hebrew, Arabic, and Cyrillic as alphabets were stated on morsecode.world. morsecodeapp.com's HTML included Cyrillic and Arabic. The others did not.
- Ten-locale URL sets were seen only on morsecodemaster.com.
- FAQPage JSON-LD was seen on morse-codetranslator.com and morsecodetranslator.tools, not on the other three.
- A description under about 160 characters plus a title that contains the exact query was done cleanly by morsecodetranslator.tools (140 / 53) and morsecode-translator.com (128 / 46). morsecode.world's description is 313 characters. morsecodeapp.com has no description tag.

## Keyword and page cluster

Primary keyword for the homepage: **morse code translator**. The pages that ranked are tools, and the H1s that match are the tool name. Search intent: do the conversion now.

Secondary pages, from queries and URLs that already exist in this audit. No search volumes.

| Page | Intent |
|---|---|
| Morse code alphabet | Look up the chart of letters, numbers, and punctuation. |
| Morse code numbers | Look up digits only. |
| SOS in Morse code | Find the distress signal and what it means. |
| I love you in Morse code | Copy one phrase for a gift, tattoo, or message. |
| Hello, hi, help, yes, and no in Morse code | Copy a short common phrase. |
| How Morse code works | Understand dots, dashes, and the gap between letters and words. |
| Morse code timing and WPM | Set speed, including what Farnsworth spacing changes. |
| Morse code audio translator | Play text as beeps, or find a page aimed at the audio query. |
| Decode Morse code from audio | Turn a recording or microphone signal into text. |
| Learn Morse code | A beginner practice plan, not another copy of the translator. |
| Morse code history | Who built it and where it was used. |
| Is Morse code still used | Ham radio, aviation, and emergencies. |
| Morse code for ham radio contacts | The QSO procedure pages already published by two competitors. |
| Morse code chart image or cheat sheet | A printable or saveable chart. |
| Morse code light and flashlight | Signal with a lamp or screen, which several tools already advertise. |

## Priority for this site

Ordered by how directly the gap showed up in the lab data and the two result pages, against how large the build is. Effort is a judgment, not a measurement.

1. Put a working bidirectional translator on the homepage, with the query in the title and H1. Every strong result is a tool. The current homepage says the tool will be added later.
2. Add play, WPM, copy, and WAV on that same page. Those controls were on the number-one result and were mentioned on all five targets.
3. Publish the alphabet page that already has a URL, with letters, numbers, punctuation, and SOS. The URL is already in the sitemap.
4. Add FAQ copy and FAQPage JSON-LD on the translator. Two competitors already do. morsecodeapp.com and morsecodemaster.com have the questions without the schema.
5. Keep third-party scripts off the page. The two ad-heavy sites scored 53 and 29. The lightest target was still 316 KB and LCP 4.5 s. The current build's lab score is 100 with no external JS.
6. Add a small set of phrase pages only where the page answers one intent (SOS, I love you, numbers), and do not copy the single-letter URL pattern until those pages are real references. morse-codetranslator.com's sitemap is dominated by those URLs; their content was NOT VERIFIED.
7. Add an audio-decoder page for the second query. The results were GitHub, generic audio tools, and decoder URLs, and the number-one translator says it does not decode a microphone. That is a gap, and it is more work than playback.
8. Add Farnsworth as a second timing control after plain WPM. It was named on four of the five targets and on the number-one page.
9. Add light and vibrate after audio. They are common, but the result pages lead with translate and sound.
10. Start the blog with the timing, learning, and "still used" articles already in competitors' sitemaps. Do this after the tool and the alphabet page exist.
11. A Koch trainer, games, and ten locales are what morsecodemaster.com has and the others do not. That is a product, not the first ranking step.
12. Image decode is visible on the number-one site and on one sitemap. It is specialized. Do it after text, audio, and the chart.

---

## Optional competitor: https://morsecode-translator.com/

Observed 6 October 2026. This is not `translatorcodemorse.com`. Curl followed `https://morsecode-translator.com/` to `https://www.morsecode-translator.com/` (HTTP 200, 100,890 bytes). The earlier comparison column that said performance was NOT VERIFIED is updated above with this lab run. `translatorcodemorse.com` was not fetched.

### A. On-page SEO

- Title: `Morse Code Translator — Convert, Play & Decode` (46 characters). The query is in the title.
- Meta description (128 characters): "Convert text to Morse code and decode Morse back to text. Play audio, download WAV, and use the alphabet chart. Free, no signup."
- Robots meta: `INDEX,FOLLOW`.
- H1: Morse Code Translator. The query is in the H1.
- H2: What is Morse Code?; How Does Morse Code Work?; What Is a Morse Code Translator?; Features Offered by This Tool:; How to Use the Morse Code Translator; The History of Morse Code; Why Use Morse Code Today?; Advanced Features of the Morse Code Translator; Learning Morse Code; Why Choose This Morse Code Translator?; Popular Morse Code Translations; Frequently Asked Questions (FAQs).
- H3: 1. Encoding English to Morse Code; 2. Decoding Morse Code to English; Historical Highlights:; Modern Applications:; How to Read Morse Code; How to Write Morse Code; 1.What is Morse code?; 2. Can I use Morse code for emergencies?; 3. Is learning Morse code difficult?; 4. Is this translator free to use?; 5. Can I play Morse code as audio?; plus three article titles (SOS still matters, mastering the basics, real-world uses).
- Approximate words: 1,532, using the same strip-scripts-and-tags method as the other pages.
- Canonical: `https://www.morsecode-translator.com` (no trailing slash). `og:url` matches that.
- Host contains `morsecode-translator`. It does not contain the spaced phrase "morse code translator", and the hyphen sits after `morsecode`, not after `morse`.
- Open Graph: title, type `Landing page`, image `https://www.morsecode-translator.com/img/logo.png`, site_name `www.morsecode-translator.com`, description, url. Twitter card `summary`, with the same title, description, and image. Image width and height were not in those tags.
- JSON-LD types parsed from the HTML: WebApplication, Organization.
- FAQ heading is on the page. FAQPage JSON-LD was not in the parsed blocks.

### B. Tool features

Seen in the downloaded HTML: text to Morse, WPM, Farnsworth, flash, vibrate, download, WAV, the word microphone, decode, practice, copy, share, punctuation, the phrase "dark mode", SOS, alphabet, FAQ, blog, image. Not found as strings: flashlight, MP3, the word trainer.

In the browser accessibility tree on a 390×844 viewport, these controls were present before the first explanatory H2: Text to Morse, Morse to Text, swap, text boxes, Clear, Random, Copy, Share, Play, Stop, Download WAV, Repeat, Light, Vibrate, a WPM spinbutton showing 20, and Configure. A Dark Mode item was in the menu. I did not press Play, Download, Light, or Vibrate, so whether they succeed is NOT VERIFIED.

The FAQ text in that tree says decoding is from typed or pasted dots and dashes, not from microphone audio. The HTML contains the word "microphone" in that denial. A working mic or file decoder on this URL: not observed.

Hebrew and Arabic appear as locale links (`/he`, `/ar`), not as a claim that the Morse alphabet includes those scripts. Morse support for non-Latin letters: NOT VERIFIED.

### C. Supporting content

`robots.txt` (HTTP 200, 200 bytes):

```
User-agent: *
Disallow:

Sitemap: https://www.morsecode-translator.com/sitemap.xml
```

It also comments links to `/llms.txt` and `/llm.xml`. I did not fetch those files.

Sitemap HTTP 200, 26 `<loc>` values:

- `/`, `/learn-morse-code`, `/morse-code-alphabet`, `/morse-code-image-translator`
- `/changelog`, `/faqs`, `/about`, `/contact`, `/privacy-policy`, `/terms-and-conditions`, `/disclaimer`, `/blog`
- Blog posts: mastering the basics, real-world uses, decoding secret language, the future of Morse code, SOS still matters
- Phrase pages: I love you, SOS, hello, hi, help, help me, yes, no, love

The homepage HTML also links locale paths for Indonesian, Danish, German, Spanish, French, Italian, Hungarian, Dutch, Polish, Portuguese, Romanian, Finnish, Swedish, Vietnamese, Turkish, Czech, Greek, Russian, Hebrew, Arabic, Thai, Japanese, Chinese, and Korean. Those locale URLs are not in the 26-URL sitemap. I did not open them. Whether they are real translations: NOT VERIFIED.

### D. Performance and tech

The HTML has a `csrf-token` meta and one stylesheet plus one script under `/build/assets/` (`app-CQBI0k-a.css`, `app-CBR0q-On.js`). An inline assignment loads `https://pagead2.googlesyndication.com/pagead/js/adsbygoogle.js?client=ca-pub-1317219510766101`. A WebP image URL (`morse-code-translator-360.webp`) is in the HTML. The Open Graph image is a PNG. No `fonts.googleapis.com` or `woff2` string was in the HTML. Font files: NOT VERIFIED. Naming a framework beyond the csrf token and `/build/assets/` paths: NOT VERIFIED.

Lighthouse 13.5.0, mobile, headless Chrome, final URL `https://www.morsecode-translator.com/`:

| Performance | Accessibility | Best Practices | SEO | LCP | CLS | TBT |
|---|---|---|---|---|---|---|
| 54 | 97 | 73 | 100 | 3.1 s | 0.055 | 1,410 ms |

Transfer 651,115 bytes. 53 requests. Script transfer 449,257 bytes. Stylesheet transfer 12,693 bytes. Third-party hosts in that log: `static.cloudflareinsights.com`, `pagead2.googlesyndication.com`, `www.clarity.ms`, `c.clarity.ms`, `c.bing.com`, `googleads.g.doubleclick.net`, `ep1.adtrafficquality.google`, `ep2.adtrafficquality.google`, `www.google.com`, `fundingchoicesmessages.google.com`.

Failed weighted audits: FCP, LCP, TBT, CLS, speed index, color contrast, third-party cookies, console errors, inspector issues.

### E. UX

At 390×844 CSS pixels in the browser, `scrollWidth` equalled `innerWidth` (390), so this viewport did not scroll sideways. The H1 was about 69px from the top. The Play button was about 748px from the top, still inside that viewport. An `ins.adsbygoogle` element and an `aswift_0` iframe were in the DOM with measured height 0, so a filled ad's size on screen is NOT VERIFIED. No full-screen interstitial was in the accessibility tree.

### F. Weaknesses and strengths

Weaknesses I measured: AdSense plus Microsoft Clarity, CLS 0.055, 1.4 s total blocking time, about 439 KB of script, a color-contrast failure, and `og:type` set to `Landing page` rather than a usual `website` value. The FAQ is on the page without FAQPage JSON-LD. Mic decode is explicitly not this tool.

Strengths I measured: the query is in a 46-character title and the H1, the description is 128 characters, canonical and `og:url` match, WebApplication schema is present, and the translator controls (both directions, WPM, play, WAV, light, vibrate, copy, share) are in the first screen on a 390px-wide viewport. The sitemap already covers an alphabet, an image translator, phrase pages, and a short blog.
