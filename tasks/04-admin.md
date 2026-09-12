# Task 04 — Hidden admin

**Status:** done  
**Owns (only these files):**

- `src/admin.ts`

**Must not edit:** public, og, db, security implementations, wrangler, CSS, README. You may `import { layout } from "./html"` and everything from `./db` + `./security`.

## Do

`isAdminPath` + `handleAdmin` per contract.

**Auth**

- If `ADMIN_PASSWORD` is empty, show a single line: set `ADMIN_PASSWORD` in `.dev.vars` / secrets. No bypass.
- Unauthenticated: password form POST to `ADMIN_PATH`. Rate limit `admin:{ip}` 8 / 600s. Timing-safe compare. On success, Set-Cookie session + 303 to `ADMIN_PATH`.
- Authenticated: inbox UI.
- POST `ADMIN_PATH/logout` clears cookie.

**Inbox UI** (`GET ADMIN_PATH?filter=inbox|public|all`, default inbox)

- Counts from `stats()`: total, unanswered, public, by country.
- Short note: page views / unique visits / country of visitors live in Cloudflare Web Analytics (not in-app).
- List questions with body, name/email (admin **may** see email), country, timestamps, public flag, answer.
- Answer form (textarea + checkbox Public) for unanswered; edit answer for answered.
- Actions as POST, `application/x-www-form-urlencoded`, origin-checked:
  - `ADMIN_PATH/answer` — `public_id`, `answer`, `is_public=on`
  - `ADMIN_PATH/visibility` — `public_id`, `is_public=on`
  - `ADMIN_PATH/delete` — `public_id`
- After writes, 303 back to inbox.

Do not link here from public pages (public task handles that). Do not hardcode `/admin`. Use `env.ADMIN_PATH`.

## Done when

- Secret path, password cookie, list/answer/publish/delete work.
- Email never needed on public; it is fine here.
