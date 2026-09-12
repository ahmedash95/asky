# Task 03 — Public site

**Status:** done  
**Owns (only these files):**

- `src/public.ts`
- `src/html.ts`

**Must not edit:** admin, og, db, security, wrangler, CSS (link `/app.css` only), README.

## Do

`handlePublic` + `layout()` per contract.

**GET `/`**

- Ask form at top (always). `method=post action=/ask`.
- Fields: question textarea required; name; email. Hint: leave name/email blank to ask anonymously.
- If Turnstile site key set, render the Turnstile widget.
- Thank-you banner when `?asked=1`.
- List wall from `listWall`. Each item: question, answer, byline if identified, link to `/q/{uuid}`, share links:
  - X/Twitter intent: `https://x.com/intent/tweet?url={permalink}&text={snippet}`
  - native `<a href="{permalink}">` 
  - `<a href="{permalink}/og.png">Thumbnail</a>`
- Unpublished / unanswered must be impossible to see here even if `listWall` were wrong — still do not render if `is_public` is 0 or `answer` is null.

**POST `/ask`**

- Origin check; 403 if fail.
- Rate limit `ask:{ip}` 5 / 600s → 429.
- Validate body/name/email as contract.
- Turnstile verify if secret set.
- Insert with `crypto.randomUUID()`, `CF-IPCountry` header (or null).
- 303 redirect to `/?asked=1`.

**GET `/q/:uuid`**

- 404 if missing **or** not (`is_public && answer`).
- OG tags: `og:title`, `og:description` (question), `og:image` absolute `{origin}/q/{uuid}/og.png`, twitter card `summary_large_image`.
- Full Q&A + same share links.

Use `layout()` for all HTML. Escape all user text. Never print email on public pages.

Do not handle `/q/:uuid/og.png` here — return nothing for that; the router sends it to `handleOg`.

## Done when

- Main page has ask + public wall only.
- Permalinks use UUID, not numeric id.
- XSS-escaped.
