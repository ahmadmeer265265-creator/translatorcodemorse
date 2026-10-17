# Homepage SEO keyword pass (article-edits-2)

Date: 2026-10-17  
Scope: `src/pages/index.astro` (title/meta/JSON-LD description) + light edits in `src/components/HomeArticle.astro` + `docs/article-source.txt` (I MISS YOU Morse token for the homepage Morse-token test).

## Title / meta (chosen)

- **Title:** Morse Code Translator: Free Online Converter & Audio (52 characters)
- **Description:** Free private Morse code translator to convert or decode text online. Play sound, use tap and flash, download WAV—no sign-up, works in your browser. (147 characters)
- Applied via the `title` / `description` consts in `index.astro` to: `<title>`, meta description, `og:title`, `og:description`, `twitter:title`, `twitter:description`, and the `description` fields of WebPage / WebSite / WebApplication JSON-LD (same shared `description` variable).

## Keyword items

### 1. Morse code converter / conversion
- **Verdict:** added
- **Where:** About Morse Code Translator
- **Before:** `A Morse Code Translator is an online tool that converts simple text into Morse code — dots and dashes.`
- **After:** `A Morse Code Translator is an online Morse code converter that turns simple text into Morse code — dots and dashes.`

### 2. translator app / web application
- **Verdict:** added (`web application`)
- **Where:** Why Choose Our Morse Code Translator
- **Before:** `…needs no sign-up, and runs in your browser, so your messages stay on your device.`
- **After:** `…needs no sign-up, and runs as a browser-based web application, so your messages stay on your device.`
- **Note:** Did not say “app download” or installable app.

### 3. online Morse code decoder / Morse code decoder
- **Verdict:** added (`online Morse code decoder`)
- **Where:** Morse Code to Text feature section
- **Before:** `When decoding a message, type or paste every dot as ( . ) and dash as ( - ) into the top box.`
- **After:** Opening sentence added: `This online Morse code decoder turns dots and dashes into plain text.` then the existing decode instructions continue.

### 4. decode Morse code
- **Verdict:** added
- **Where:** How to Use — Choose your direction
- **Before:** `…or Morse to Text to decode a message back into English.`
- **After:** `…or Morse to Text to decode Morse code back into English.`

### 5. Morse code translator sound
- **Verdict:** added
- **Where:** Customize the Sound
- **Before:** `You can customize the settings below to make playback fit your level:`
- **After:** `You can customize the Morse code translator sound settings below to make playback fit your level:`

### 6. Morse code dictionary
- **Verdict:** added
- **Where:** Look Up a Letter
- **Before:** `…just open Reference.`
- **After:** `…just open Reference — a built-in Morse code dictionary.`

### 7. generator
- **Verdict:** added (`phrase generator`)
- **Where:** Try a Random Message
- **Before:** `…load a sample message.`
- **After:** `…load a sample from the phrase generator.`

### 8. Morse code maker
- **Verdict:** added
- **Where:** Why Choose Our Morse Code Translator
- **Before:** `This translator works both ways, …`
- **After:** `This Morse code maker works both ways, …`

### 9. Morse code player
- **Verdict:** added
- **Where:** Hear It, See It or Feel It
- **Before:** `Press Play to hear your message as beeps, …`
- **After:** `Use the Morse code player: press Play to hear your message as beeps, …`

### 10. Morse code simulator
- **Verdict:** added
- **Where:** Hear It — Light bullet (Flash)
- **Before:** `Light: a flashing light that matches the rhythm, like real signal training`
- **After:** `Light: a flashing light that matches the rhythm, like a Morse code simulator for real signal training`

### 11. Morse code puzzle solver
- **Verdict:** added
- **Where:** Send a Morse Puzzle
- **Before:** `…send it to someone as a little puzzle to solve.`
- **After:** `…send it to someone as a Morse code puzzle solver challenge.`

### 12. printable Morse code chart
- **Verdict:** added
- **Where:** Look Up a Letter (same paragraph as dictionary)
- **Before:** (ended after Reference sentence)
- **After:** Added: `For a printable Morse code chart of the full alphabet, see the alphabet page.` with link to `/morse-code-alphabet/` (existing print-friendly chart page; no new print code on the homepage).

### 13. sentence
- **Verdict:** already present
- **Where:** Step 6 (“full sentences”); Live Counters (“a sentence needs”)
- **Reason:** No edit — the word already appears in the article.

### 14. I MISS YOU table row (optional)
- **Verdict:** added
- **Where:** Common Morse Code Messages table
- **Morse (verified with site `encode('I MISS YOU')`):** `.. / -- .. ... ... / -.-- --- ..-`
- **Also updated:** `docs/article-source.txt` so the homepage Morse-token test includes the new token.
