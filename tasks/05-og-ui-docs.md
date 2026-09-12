# Task 05 — OG thumbnail, CSS, README

**Status:** done  
**Owns (only these files):**

- `src/og.ts`
- `public/app.css`
- `public/favicon.svg`
- `README.md`
- `src/fonts/*` (one OFL/SIL TTF or OTF, keep it small)

**Must not edit:** `src/index.ts`, `src/public.ts`, `src/admin.ts`, `src/db.ts`, `src/security.ts`, wrangler, migrations.

## Do

### OG PNG — `handleOg(request, env, uuid)`

- Load question via `getByPublicId`. 404 unless `is_public && answer`.
- Render 1200×630 PNG: designed background (ink `#1a1510`, terracotta accent `#c45c26`), site name small, **question text** large and wrapped, ellipsis if too long. Not a generic purple gradient.
- Use `@cf-wasm/resvg` (import from `@cf-wasm/resvg/workerd`) + SVG string + bundled font. Add `@cf-wasm/resvg` to `package.json` **only if** you must — prefer adding it under `dependencies` in `package.json` (this is the one allowed extra edit: you may add that single dependency key; do not rewrite the rest of package.json if it already exists; if it does not exist, create a tiny `package.json` patch by writing the dependency in a comment at the top of `src/og.ts` as `// dep: @cf-wasm/resvg` AND still run `npm install @cf-wasm/resvg` which will create/update lockfile). Simplest: `npm install @cf-wasm/resvg` is allowed; do not otherwise change scripts or wrangler.
- `Content-Type: image/png`, `Cache-Control: public, max-age=3600`.
- Download a small OFL font into `src/fonts/` (e.g. Source Serif 4 or IBM Plex Serif static file). Import as `?arraybuffer` or read via bundler — Wrangler can import `.ttf` if you put `import font from "./fonts/foo.ttf"` with the right type. If import is painful, embed as base64 in a `.ts` file you own.

### CSS

Paper page, ink text, terracotta buttons, hairline rules, readable mobile column (~40rem). Style: form, wall cards, permalink, admin table-ish layout (admin uses same classes: `wrap`, `card`, `btn`, `ask`, `q`, `a`, `flash`, `muted`). No Inter, no Google Fonts, no purple.

Favicon: simple SVG mark (question-mark / stamp).

### README

How to run locally (`npm i`, copy `.dev.vars.example` → `.dev.vars`, `npm run db:local`, `npm run dev`). How to deploy (`wrangler d1 create asky`, paste id into wrangler, `wrangler d1 migrations apply asky --remote`, `wrangler secret put ADMIN_PASSWORD`, `npm run deploy`). What to change: `ADMIN_PATH`, `SITE_NAME`. Note: custom domain on a Cloudflare zone gives DDoS protection; Turnstile optional; Web Analytics token optional. Do not claim features we did not build.

## Done when

- `handleOg` matches contract and produces PNG for public answered questions.
- CSS exists and covers public + admin class names used in the contract/tasks.
- README is enough to self-host on the operator's Cloudflare account.
