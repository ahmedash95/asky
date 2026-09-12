# Contract (read this first)

Tiny self-hosted ask inbox. One Cloudflare Worker, D1, static CSS. TypeScript. No UI framework. No Hono.

## Open-gap defaults (locked)

- Ask form: name + email **optional**. Empty both → anonymous. Checkbox optional; not required.
- Admin auth: `ADMIN_PASSWORD` secret + HMAC-signed cookie. Not Cloudflare Access.
- Admin path: `ADMIN_PATH` wrangler var, deploy-time. Default `/inbox`.
- Manage: list, answer, edit answer, publish/unpublish (`is_public`), delete.
- Permalinks: `/q/{uuid}` and `/q/{uuid}/og.png`.
- Rate limit: D1 table (works on free plan). Not the paid Rate Limiting binding.
- Turnstile: if `TURNSTILE_SITE_KEY` and `TURNSTILE_SECRET_KEY` are set, enforce on `/ask`. If unset, skip (local dev).
- Metrics: optional Web Analytics beacon via `WEB_ANALYTICS_TOKEN`. Admin shows D1 counts + asker country breakdown. No Analytics Engine binding.
- No email notify-on-answer.
- No sequential ids in public URLs. `crypto.randomUUID()` for `public_id`.

## Env

```ts
interface Env {
  DB: D1Database
  ADMIN_PASSWORD: string
  ADMIN_PATH: string
  SITE_NAME: string
  SITE_TAGLINE: string
  TURNSTILE_SITE_KEY?: string
  TURNSTILE_SECRET_KEY?: string
  WEB_ANALYTICS_TOKEN?: string
}
```

Wrangler vars: `SITE_NAME`, `SITE_TAGLINE`, `ADMIN_PATH`.
Secrets / `.dev.vars`: `ADMIN_PASSWORD`, optional Turnstile + analytics.

## D1 schema

```sql
CREATE TABLE questions (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  public_id TEXT NOT NULL UNIQUE,
  body TEXT NOT NULL,
  asker_name TEXT,
  asker_email TEXT,
  is_anonymous INTEGER NOT NULL DEFAULT 1,
  answer TEXT,
  is_public INTEGER NOT NULL DEFAULT 0,
  created_at INTEGER NOT NULL,
  answered_at INTEGER,
  country TEXT
);

CREATE INDEX idx_wall ON questions (answered_at DESC)
  WHERE is_public = 1 AND answer IS NOT NULL;

CREATE TABLE rate_limits (
  key TEXT PRIMARY KEY,
  count INTEGER NOT NULL,
  reset_at INTEGER NOT NULL
);
```

Wall query **must** be: `is_public = 1 AND answer IS NOT NULL`. Never list unanswered or unlisted on `/`.

## Routes

| Method | Path | Owner |
| --- | --- | --- |
| GET | `/` | public |
| POST | `/ask` | public |
| GET | `/q/:uuid` | public |
| GET | `/q/:uuid/og.png` | og (called from index) |
| GET/POST | `{ADMIN_PATH}` and `{ADMIN_PATH}/*` | admin |
| GET | `/app.css`, `/favicon.svg` | static assets |

`src/index.ts` is a thin router only.

## File map and signatures

```
src/index.ts          # scaffold — router
src/env.d.ts          # scaffold — Env
src/db.ts             # data-security
src/security.ts       # data-security
src/public.ts         # public
src/admin.ts          # admin
src/og.ts             # og-ui-docs
src/html.ts           # public may put shared layout here; admin may import layout() only
public/app.css        # og-ui-docs
public/favicon.svg    # og-ui-docs
migrations/0001_init.sql
```

### `src/db.ts`

```ts
export type Question = {
  id: number
  public_id: string
  body: string
  asker_name: string | null
  asker_email: string | null
  is_anonymous: number
  answer: string | null
  is_public: number
  created_at: number
  answered_at: number | null
  country: string | null
}

export function insertQuestion(db: D1Database, q: {
  public_id: string
  body: string
  asker_name: string | null
  asker_email: string | null
  is_anonymous: boolean
  country: string | null
}): Promise<void>

export function listWall(db: D1Database): Promise<Question[]>  // public answered only, newest first, cap 100
export function getByPublicId(db: D1Database, publicId: string): Promise<Question | null>
export function listAdmin(db: D1Database, filter: "inbox" | "public" | "all"): Promise<Question[]>  // cap 200
export function answerQuestion(db: D1Database, publicId: string, answer: string, isPublic: boolean): Promise<void>
export function setPublic(db: D1Database, publicId: string, isPublic: boolean): Promise<void>
export function deleteQuestion(db: D1Database, publicId: string): Promise<void>
export function stats(db: D1Database): Promise<{
  total: number
  unanswered: number
  public: number
  byCountry: { country: string; count: number }[]
}>
```

Inbox filter: unanswered (`answer IS NULL`). Public filter: `is_public = 1`. All: everything, newest first.

### `src/security.ts`

```ts
export function escapeHtml(s: string): string
export function clientIp(request: Request): string
export function checkOrigin(request: Request): boolean  // same-origin POST; allow missing Origin on same-site
export function cookieHeader(value: string): string
export function readSession(request: Request, secret: string): Promise<boolean>
export function makeSession(secret: string): Promise<string>  // HMAC cookie value, 30d
export function timingSafeEqual(a: string, b: string): boolean
export function rateLimit(db: D1Database, key: string, limit: number, windowSecs: number): Promise<boolean>  // true if allowed
export function verifyTurnstile(token: string | null, ip: string, secret: string): Promise<boolean>
```

Ask limit: `5` / `600s` per IP. Admin login limit: `8` / `600s` per IP.

Session cookie name: `asky`. HttpOnly, Secure, SameSite=Lax, Path=/.

### `src/public.ts`

```ts
export function handlePublic(request: Request, env: Env): Promise<Response>
```

Handles `/`, `/ask`, `/q/:uuid` (not `og.png`). 404 for unknown public paths.

### `src/admin.ts`

```ts
export function isAdminPath(pathname: string, adminPath: string): boolean
export function handleAdmin(request: Request, env: Env): Promise<Response>
```

Normalize `ADMIN_PATH` to start with `/`, no trailing slash. Never leak the path in public HTML.

### `src/og.ts`

```ts
export function handleOg(request: Request, env: Env, uuid: string): Promise<Response>
```

1200×630 PNG. Question text on a designed background. Only for **public answered** questions; otherwise 404. Cache-Control `public, max-age=3600`.

### `src/html.ts` (owned by **public** task)

```ts
export function layout(opts: {
  title: string
  body: string
  env: Env
  extraHead?: string
}): string
```

Include `/app.css`. If `WEB_ANALYTICS_TOKEN` set, include Cloudflare Web Analytics beacon. Admin pages may call `layout()`.

## HTML / XSS

Escape every user string with `escapeHtml`. Never show `asker_email` on public pages. Show name only when `is_anonymous = 0` and name is present.

## Validation

- Question body: trim, 1–1000 chars, required
- Name: 0–80
- Email: 0–120; if present, must look like `x@y.z`
- Answer: trim, 1–5000 chars

## CSS tokens (og-ui-docs must implement)

Paper `#f4efe6`, ink `#1a1510`, terracotta `#c45c26`, rule `#d9d0c3`. System serif for questions, system-ui for chrome. No Inter, no purple gradients, no Google Fonts.

## Out of scope

Visitor accounts, likes, follows, multi-tenant, native apps, notify-on-answer, Cloudflare Access, R2, KV, Durable Objects, Pages.
