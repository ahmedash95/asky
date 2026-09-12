# Task 01 — Scaffold

**Status:** done  
**Owns (only these files):**

- `package.json`
- `wrangler.jsonc`
- `tsconfig.json`
- `.gitignore`
- `.dev.vars.example`
- `src/index.ts`
- `src/env.d.ts`

**Must not edit:** anything else, including other `src/*.ts`, `migrations/`, `public/`, `README.md`.

## Do

1. Worker named `asky`, `main: src/index.ts`, `compatibility_date: 2026-09-12`.
2. `assets.directory = "./public"`.
3. D1 binding `DB`, database_name `asky`, placeholder `database_id` (comment in README is not your job; put `"database_id": "replace-me"`).
4. Vars: `SITE_NAME: "Asky"`, `SITE_TAGLINE: "Ask me anything."`, `ADMIN_PATH: "/inbox"`.
5. `observability.enabled: true`.
6. `package.json`: `"type": "module"`, scripts `dev` = `wrangler dev`, `deploy` = `wrangler deploy`, `db:local` = `wrangler d1 migrations apply asky --local`. Dev dep `wrangler` (current v4).
7. TS: strict, types for Workers. `src/env.d.ts` declares `Env` exactly as in `00-contract.md`.
8. `.gitignore`: `node_modules`, `.wrangler`, `.dev.vars`, `dist`.
9. `.dev.vars.example`: `ADMIN_PASSWORD=change-me` plus commented Turnstile + `WEB_ANALYTICS_TOKEN`.
10. `src/index.ts`: **thin router only**. Import `handlePublic` from `./public`, `handleAdmin` + `isAdminPath` from `./admin`, `handleOg` from `./og`. Route table as in the contract. Security headers on every response: `Referrer-Policy: no-referrer`, `X-Content-Type-Options: nosniff`. Do not implement page HTML here.

## Done when

- Wrangler config is valid JSONC.
- Router matches the contract table.
- No business logic in `index.ts` beyond routing + headers.
