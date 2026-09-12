# Task 02 — Data and security

**Status:** done  
**Owns (only these files):**

- `migrations/0001_init.sql`
- `src/db.ts`
- `src/security.ts`
- `src/security.test.ts` (optional but preferred: node `--experimental-strip-types --test` covering `escapeHtml`, `timingSafeEqual`, origin check)

**Must not edit:** `src/index.ts`, `src/public.ts`, `src/admin.ts`, `src/og.ts`, wrangler, CSS, README.

## Do

Implement exact exports from `tasks/00-contract.md`.

- SQL schema copied from the contract. Include the wall index.
- `listWall` never returns unpublished, unanswered, or non-public rows.
- `insertQuestion` stores `created_at` as unix seconds (`Date.now()/1000`).
- `answerQuestion` sets `answered_at` to now; keeps existing `public_id`.
- Rate limit: upsert by key; if `reset_at` is in the past, reset count to 1 and new window; else increment; deny when `count > limit`. Return `true` if the request is allowed.
- Session: HMAC-SHA256 over `expiryUnix` using `ADMIN_PASSWORD` as key via `crypto.subtle`. Cookie value `expiry.hexsig`. Reject expired.
- `verifyTurnstile`: POST `https://challenges.cloudflare.com/turnstile/v0/siteverify` with secret, response, remoteip. If secret is empty, return `true`.
- `escapeHtml`: `& < > " '`.
- `checkOrigin`: allow if Origin host matches request URL host; if Origin missing, allow GET-like or same-host Referer; deny cross-site POST.

## Done when

- Contract signatures exist and types compile conceptually (no extra exports required).
- Wall query cannot leak inbox items.
- One small test file for `escapeHtml` / `timingSafeEqual` if you add it.
