# Asky

Tiny self-hosted ask inbox. One Cloudflare Worker and D1. Visitors ask questions; you answer them from a hidden admin page. Public answers show on the wall and can be shared with a generated thumbnail.

The first visit is setup: pick a hidden admin path and a password. The public ask page stays closed until that is saved.

## Local

```sh
npm i
cp .dev.vars.example .dev.vars
npm run db:local
npm run dev
```

Open the URL Wrangler prints, complete setup, then share the site.

## Deploy

On your Cloudflare account:

1. Create the database and paste the id into `wrangler.jsonc` (`database_id`, currently `replace-me`):

   ```sh
   npx wrangler d1 create asky
   ```

2. Apply migrations:

   ```sh
   npx wrangler d1 migrations apply asky --remote
   ```

3. Deploy:

   ```sh
   npm run deploy
   ```

4. Open the Worker URL, complete admin setup, then point followers at the site.

Set your display name, photo, bio and links on the Profile tab of your admin page. `SITE_NAME` in `wrangler.jsonc` is only the fallback used until you save a display name; `SITE_TAGLINE` is the fallback for an empty bio. `ADMIN_PATH` there is only the suggested default on the setup form.

A custom hostname on a Cloudflare zone gives you DDoS protection in front of the Worker.

Your admin inbox shows each asker's country as a flag from `flagcdn.com`. That is the only third-party request in the app, it happens on your private pages only, and the country name itself is resolved locally. If the image cannot load, the country name still shows.

## Optional

In `.dev.vars` locally, or as Wrangler secrets in production:

- `TURNSTILE_SITE_KEY` and `TURNSTILE_SECRET_KEY` — when both are set, `/ask` requires Turnstile
- `WEB_ANALYTICS_TOKEN` — Cloudflare Web Analytics beacon

Page views, unique visits, and visitor country live in Web Analytics. The inbox only shows D1 counts and asker-country totals.

Public answered questions are at `/` and `/q/{uuid}`. Share images are `/q/{uuid}/og.png`.
