import { escapeHtml } from "./security";
import { t, type Locale } from "./i18n";
import { siteName, type Settings } from "./db";

export function layout(opts: {
  title: string;
  body: string;
  env: Env;
  extraHead?: string;
  chrome?: "public" | "setup" | "admin" | "login";
  locale?: Locale;
  hasAvatar?: boolean;
  siteName?: string;
}): string {
  const chrome = opts.chrome ?? "public";
  const locale = opts.locale ?? "en";
  const dir = locale === "ar" ? "rtl" : "ltr";
  const beacon = opts.env.WEB_ANALYTICS_TOKEN
    ? `<script defer src="https://static.cloudflareinsights.com/beacon.min.js" data-cf-beacon='{"token":"${escapeHtml(opts.env.WEB_ANALYTICS_TOKEN)}"}'></script>`
    : "";
  const shell =
    chrome === "setup" || chrome === "login"
      ? "relative mx-auto max-w-lg px-4 pb-20 pt-10 sm:pt-14"
      : "relative mx-auto max-w-6xl px-3 pb-14 pt-4 sm:px-6 sm:pt-8 sm:pb-16";
  const copied = t(locale, "copied");
  const themeBoot =
    chrome === "public"
      ? `<script>(function(){try{var p=localStorage.getItem("asky-theme")||"system";if(p==="dark"||(p!=="light"&&matchMedia("(prefers-color-scheme: dark)").matches))document.documentElement.classList.add("dark")}catch(e){}})();</script>`
      : "";
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
${themeBoot}
${opts.extraHead ?? ""}
${beacon}
</head>
<body class="min-h-dvh bg-paper font-sans text-ink antialiased">
<div class="pointer-events-none fixed inset-0 bg-[radial-gradient(ellipse_at_top,_rgba(226,91,42,0.14),_transparent_52%)] dark:opacity-40"></div>
<div class="${shell}">
${chrome === "setup" || chrome === "login" ? setupHeader(opts.siteName ?? opts.env.SITE_NAME, locale, opts.hasAvatar === true, chrome === "setup") : ""}
<main>${opts.body}</main>
</div>
<script>
document.addEventListener("click", (e) => {
  const t = e.target.closest("[data-copy]");
  if (!t) return;
  const label = t.querySelector("[data-copy-label]") || t;
  navigator.clipboard.writeText(t.getAttribute("data-copy")).then(() => {
    const prev = label.textContent;
    label.textContent = ${JSON.stringify(copied)};
    setTimeout(() => { label.textContent = prev; }, 1200);
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
(function () {
  const key = "asky-theme";
  const buttons = document.querySelectorAll("[data-theme-set]");
  if (!buttons.length) return;
  const pref = () => { try { return localStorage.getItem(key) || "system"; } catch (e) { return "system"; } };
  const dark = (p) => p === "dark" || (p !== "light" && matchMedia("(prefers-color-scheme: dark)").matches);
  const apply = (p) => {
    document.documentElement.classList.toggle("dark", dark(p));
    buttons.forEach((b) => b.setAttribute("aria-pressed", b.getAttribute("data-theme-set") === p ? "true" : "false"));
  };
  apply(pref());
  matchMedia("(prefers-color-scheme: dark)").addEventListener("change", () => { if (pref() === "system") apply("system"); });
  document.addEventListener("click", (e) => {
    const b = e.target.closest("[data-theme-set]");
    if (!b) return;
    const p = b.getAttribute("data-theme-set");
    try { localStorage.setItem(key, p); } catch (e) {}
    apply(p);
  });
})();
</script>
</body>
</html>`;
}

function mark(name: string, hasAvatar: boolean): string {
  if (hasAvatar) {
    return `<a href="/" class="block size-14 overflow-hidden rounded-2xl shadow-lift ring-1 ring-white/10" aria-label="${name}"><img src="/avatar" alt="" class="size-full object-cover"></a>`;
  }
  return `<a href="/" class="grid size-14 place-items-center rounded-2xl bg-ink font-serif text-2xl text-paper shadow-lift ring-1 ring-white/10" aria-label="${name}">?</a>`;
}

function setupHeader(
  site: string,
  locale: Locale,
  hasAvatar: boolean,
  setup: boolean,
): string {
  const name = escapeHtml(site);
  const kicker =
    locale === "ar"
      ? "text-xs font-semibold text-ember"
      : "text-xs font-semibold uppercase tracking-[0.2em] text-ember";
  const lead = setup
    ? `<p class="mt-5 ${kicker}">${escapeHtml(t(locale, "setupKicker"))}</p>
<h1 class="mt-2 font-serif text-3xl font-semibold tracking-tight">${name}</h1>`
    : `<h1 class="mt-5 font-serif text-3xl font-semibold tracking-tight">${name}</h1>`;
  return `<header class="mb-8 flex flex-col items-center text-center">
${mark(name, hasAvatar)}
${lead}
</header>`;
}

function themeSwitch(locale: Locale, where: "side" | "foot" = "side"): string {
  const pill =
    "inline-flex min-h-9 items-center rounded-full px-3 text-xs font-medium text-mute transition hover:text-ink aria-pressed:bg-ink aria-pressed:text-paper";
  const btn = (id: "light" | "dark" | "system", label: string) =>
    `<button type="button" class="${pill}" data-theme-set="${id}" aria-pressed="false">${escapeHtml(label)}</button>`;
  const wrap =
    where === "side"
      ? "mt-10 hidden lg:flex"
      : "mt-12 flex justify-center lg:hidden";
  return `<div class="${wrap}">
<div class="inline-flex items-center gap-0.5 rounded-full bg-card p-1 ring-1 ring-line" role="group" aria-label="${escapeHtml(t(locale, "theme"))}">
${btn("light", t(locale, "themeLight"))}
${btn("dark", t(locale, "themeDark"))}
${btn("system", t(locale, "themeSystem"))}
</div>
</div>`;
}

export function profileSidebar(env: Env, settings: Settings): string {
  const name = escapeHtml(siteName(env, settings));
  const locale = settings.locale;
  const photo = settings.has_avatar
    ? `<img src="/avatar" alt="" class="size-full object-cover">`
    : `<span class="font-serif text-2xl text-paper lg:text-4xl">?</span>`;
  const bio = settings.bio.trim() || t(locale, "tagline");
  const links = settings.links
    .map(
      (link) =>
        `<a class="inline-flex max-w-full items-center gap-1 rounded-full border border-line bg-card px-2.5 py-1 text-xs font-medium text-ink transition hover:border-ember/40 hover:text-ember lg:-ms-2.5 lg:rounded-xl lg:border-0 lg:bg-transparent lg:py-1.5 lg:text-sm lg:hover:bg-card lg:hover:text-ink" href="${escapeHtml(link.url)}" rel="noopener noreferrer" target="_blank"><span class="min-w-0 truncate">${escapeHtml(link.title)}</span><span class="hidden shrink-0 text-mute lg:inline" aria-hidden="true">↗</span></a>`,
    )
    .join("");
  return `<aside class="border-b border-line pb-5 lg:sticky lg:top-8 lg:border-0 lg:pb-0">
<div class="flex items-center gap-3.5 lg:block">
<a href="/" class="grid size-14 shrink-0 place-items-center overflow-hidden rounded-full bg-ink shadow-lift ring-2 ring-white/40 lg:size-24 lg:ring-4 lg:ring-white/50" aria-label="${name}">${photo}</a>
<div class="min-w-0 lg:mt-5">
<h1 class="font-serif text-xl font-semibold tracking-tight lg:text-[1.75rem] lg:leading-tight">${name}</h1>
<p class="mt-0.5 line-clamp-2 text-sm leading-relaxed text-mute lg:mt-2.5 lg:line-clamp-none" dir="auto">${escapeHtml(bio)}</p>
</div>
</div>
${links ? `<nav class="mt-3 flex flex-wrap gap-1.5 lg:mt-5 lg:flex-col lg:items-start lg:gap-0.5">${links}</nav>` : ""}
${themeSwitch(locale, "side")}
</aside>`;
}

export function publicFrame(
  env: Env,
  settings: Settings,
  main: string,
): string {
  return `<div class="mx-auto grid items-start gap-6 lg:max-w-[58rem] lg:grid-cols-[15rem_minmax(0,1fr)] lg:gap-14">
${profileSidebar(env, settings)}
<div class="min-w-0">${main}</div>
</div>
${themeSwitch(settings.locale, "foot")}`;
}
