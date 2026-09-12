import { escapeHtml } from "./security"
import { t, type Locale } from "./i18n"
import type { Settings } from "./db"

export function layout(opts: {
  title: string
  body: string
  env: Env
  extraHead?: string
  chrome?: "public" | "setup" | "admin" | "login"
  locale?: Locale
  hasAvatar?: boolean
}): string {
  const chrome = opts.chrome ?? "public"
  const locale = opts.locale ?? "en"
  const dir = locale === "ar" ? "rtl" : "ltr"
  const beacon = opts.env.WEB_ANALYTICS_TOKEN
    ? `<script defer src="https://static.cloudflareinsights.com/beacon.min.js" data-cf-beacon='{"token":"${escapeHtml(opts.env.WEB_ANALYTICS_TOKEN)}"}'></script>`
    : ""
  const shell =
    chrome === "setup" || chrome === "login"
      ? "relative mx-auto max-w-lg px-4 pb-20 pt-10 sm:pt-14"
      : "relative mx-auto max-w-6xl px-4 pb-16 pt-6 sm:px-6 sm:pt-8"
  const copied = t(locale, "copied")
  return `<!DOCTYPE html>
<html lang="${locale}" dir="${dir}">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${escapeHtml(opts.title)}</title>
<link rel="preconnect" href="https://fonts.bunny.net">
<link href="https://fonts.bunny.net/css?family=fraunces:500,600,700|plus-jakarta-sans:400,500,600,700|amiri:400,700|cairo:400,500,600,700&display=swap" rel="stylesheet">
<link rel="stylesheet" href="/app.css">
<link rel="icon" href="/favicon.svg" type="image/svg+xml">
${opts.extraHead ?? ""}
${beacon}
</head>
<body class="min-h-dvh bg-paper font-sans text-ink antialiased">
<div class="pointer-events-none fixed inset-0 bg-[radial-gradient(ellipse_at_top,_rgba(226,91,42,0.14),_transparent_52%)]"></div>
<div class="${shell}">
${chrome === "setup" || chrome === "login" ? setupHeader(opts.env, locale, opts.hasAvatar === true, chrome === "setup") : ""}
<main>${opts.body}</main>
</div>
<script>
document.addEventListener("click", (e) => {
  const t = e.target.closest("[data-copy]");
  if (!t) return;
  navigator.clipboard.writeText(t.getAttribute("data-copy")).then(() => {
    const prev = t.textContent;
    t.textContent = ${JSON.stringify(copied)};
    setTimeout(() => { t.textContent = prev; }, 1200);
  });
});
document.addEventListener("change", (e) => {
  const input = e.target.closest("[data-avatar-input]");
  if (!input || !input.files || !input.files[0]) return;
  const box = document.querySelector("[data-avatar-preview]");
  if (!box) return;
  const url = URL.createObjectURL(input.files[0]);
  box.innerHTML = '<img src="' + url + '" alt="" class="size-full object-cover">';
});
</script>
</body>
</html>`
}

function mark(name: string, hasAvatar: boolean): string {
  if (hasAvatar) {
    return `<a href="/" class="block size-14 overflow-hidden rounded-2xl shadow-lift ring-1 ring-white/10" aria-label="${name}"><img src="/avatar" alt="" class="size-full object-cover"></a>`
  }
  return `<a href="/" class="grid size-14 place-items-center rounded-2xl bg-ink font-serif text-2xl text-paper shadow-lift ring-1 ring-white/10" aria-label="${name}">?</a>`
}

function setupHeader(env: Env, locale: Locale, hasAvatar: boolean, setup: boolean): string {
  const name = escapeHtml(env.SITE_NAME)
  const kicker = locale === "ar" ? "text-xs font-semibold text-ember" : "text-xs font-semibold uppercase tracking-[0.2em] text-ember"
  const lead = setup
    ? `<p class="mt-5 ${kicker}">${escapeHtml(t(locale, "setupKicker"))}</p>
<h1 class="mt-2 font-serif text-3xl font-semibold tracking-tight">${name}</h1>`
    : `<h1 class="mt-5 font-serif text-3xl font-semibold tracking-tight">${name}</h1>`
  return `<header class="mb-8 flex flex-col items-center text-center">
${mark(name, hasAvatar)}
${lead}
</header>`
}

export function profileSidebar(env: Env, settings: Settings): string {
  const name = escapeHtml(env.SITE_NAME)
  const locale = settings.locale
  const photo = settings.has_avatar
    ? `<img src="/avatar" alt="" class="size-full object-cover">`
    : `<span class="font-serif text-4xl text-paper">?</span>`
  const bio = settings.bio.trim() || t(locale, "tagline")
  const links = settings.links
    .map(
      (link) =>
        `<a class="group flex items-center justify-between gap-3 rounded-2xl px-3 py-2 text-sm font-medium text-ink transition hover:bg-card" href="${escapeHtml(link.url)}" rel="noopener noreferrer" target="_blank"><span class="min-w-0 truncate">${escapeHtml(link.title)}</span><span class="shrink-0 text-mute transition group-hover:text-ember" aria-hidden="true">↗</span></a>`,
    )
    .join("")
  return `<aside class="lg:sticky lg:top-8">
<a href="/" class="grid size-28 place-items-center overflow-hidden rounded-full bg-ink shadow-lift ring-4 ring-white/50" aria-label="${name}">${photo}</a>
<h1 class="mt-5 font-serif text-3xl font-semibold tracking-tight">${name}</h1>
<p class="mt-2 text-[0.95rem] leading-relaxed text-mute" dir="auto">${escapeHtml(bio)}</p>
${links ? `<nav class="mt-5 grid gap-0.5">${links}</nav>` : ""}
</aside>`
}

export function publicFrame(env: Env, settings: Settings, main: string): string {
  return `<div class="grid items-start gap-10 lg:grid-cols-[17rem_minmax(0,1fr)]">
${profileSidebar(env, settings)}
<div class="min-w-0">${main}</div>
</div>`
}
