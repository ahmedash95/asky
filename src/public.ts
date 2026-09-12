import { insertQuestion, listWall, getByPublicId, type Question, type Settings } from "./db"
import {
  escapeHtml,
  clientIp,
  checkOrigin,
  rateLimit,
  verifyTurnstile,
} from "./security"
import { layout, publicFrame } from "./html"
import { t, type Locale } from "./i18n"
import { btnBlock, btnGhost, card, flashOk, help, input, label } from "./ui"

export function handlePublic(request: Request, env: Env, settings: Settings): Promise<Response> {
  const url = new URL(request.url)
  const { pathname } = url
  const locale = settings.locale

  if (request.method === "GET" && pathname === "/") return home(url, env, settings)
  if (request.method === "POST" && pathname === "/ask") return ask(request, env, settings)

  if (request.method === "GET" && pathname.startsWith("/q/")) {
    const uuid = pathname.slice(3)
    if (uuid && !uuid.includes("/")) return permalink(url, env, settings, uuid)
  }

  return page(404, env, settings, `<p class="text-mute">${escapeHtml(t(locale, "notFound"))}</p>`)
}

function page(status: number, env: Env, settings: Settings, body: string, extraHead?: string): Promise<Response> {
  return Promise.resolve(
    new Response(
      layout({
        title: env.SITE_NAME,
        body: publicFrame(env, settings, body),
        env,
        extraHead,
        chrome: "public",
        locale: settings.locale,
        hasAvatar: settings.has_avatar === 1,
      }),
      { status, headers: { "content-type": "text/html; charset=utf-8" } },
    ),
  )
}

function askForm(env: Env, locale: Locale): string {
  const turnstile = env.TURNSTILE_SITE_KEY
    ? `<div class="cf-turnstile mt-4" data-sitekey="${escapeHtml(env.TURNSTILE_SITE_KEY)}"></div>
<script src="https://challenges.cloudflare.com/turnstile/v0/api.js" async defer></script>`
    : ""
  return `<form class="${card}" method="post" action="/ask">
<label class="sr-only" for="body">${escapeHtml(t(locale, "question"))}</label>
<textarea id="body" dir="auto" class="min-h-24 w-full resize-y bg-transparent font-serif text-xl leading-snug text-ink outline-none placeholder:text-mute/60 sm:min-h-32 sm:text-2xl" name="body" required maxlength="1000" placeholder="${escapeHtml(t(locale, "askPlaceholder"))}"></textarea>
<details class="mt-4">
<summary class="cursor-pointer text-sm font-medium text-mute hover:text-ink">${escapeHtml(t(locale, "signName"))} <span class="font-normal">${escapeHtml(t(locale, "optional"))}</span></summary>
<div class="mt-3 grid gap-3 sm:grid-cols-2">
<label class="${label}">${escapeHtml(t(locale, "name"))} <input class="${input}" dir="auto" name="name" maxlength="80" autocomplete="name"></label>
<label class="${label}">${escapeHtml(t(locale, "email"))} <input class="${input}" type="email" name="email" maxlength="120" autocomplete="email"></label>
</div>
<p class="${help}">${escapeHtml(t(locale, "anonymousHelp"))}</p>
</details>
${turnstile}
<button class="${btnBlock} mt-5" type="submit">${escapeHtml(t(locale, "sendQuestion"))}</button>
</form>`
}

function when(ts: number, locale: Locale): string {
  return new Date(ts * 1000).toLocaleDateString(locale === "ar" ? "ar" : "en-GB", {
    day: "numeric",
    month: "short",
    year: "numeric",
  })
}

function meta(q: Question, locale: Locale): string {
  const bits: string[] = []
  if (q.is_anonymous === 0 && q.asker_name) {
    bits.push(`${escapeHtml(t(locale, "askedBy"))} ${escapeHtml(q.asker_name)}`)
  }
  if (q.answered_at) {
    const iso = new Date(q.answered_at * 1000).toISOString()
    bits.push(`${escapeHtml(t(locale, "answeredOn"))} <time datetime="${iso}">${escapeHtml(when(q.answered_at, locale))}</time>`)
  }
  if (!bits.length) return ""
  return `<p class="mt-6 text-sm text-mute" dir="auto">${bits.join(" · ")}</p>`
}

function action(href: string, label: string, attrs = ""): string {
  return `<a class="flex min-h-11 flex-1 items-center justify-center px-2 text-sm font-medium text-mute transition hover:bg-card hover:text-ink" href="${escapeHtml(href)}"${attrs}>${escapeHtml(label)}</a>`
}

function shares(origin: string, q: Question, locale: Locale, onPage: boolean): string {
  const path = `/q/${q.public_id}`
  const permalink = `${origin}${path}`
  const tweet = `https://x.com/intent/tweet?url=${encodeURIComponent(permalink)}&text=${encodeURIComponent(q.body.slice(0, 120))}`
  const open = onPage ? "" : action(path, t(locale, "viewQuestion"))
  return `<footer class="flex divide-x divide-line border-t border-line bg-paper/70 dark:bg-paper/40">
${open}
${action(tweet, t(locale, "shareX"))}
<button type="button" class="flex min-h-11 flex-1 items-center justify-center px-2 text-sm font-medium text-mute transition hover:bg-card hover:text-ink" data-copy="${escapeHtml(permalink)}">${escapeHtml(t(locale, "copyLink"))}</button>
${action(`${path}/og.png`, t(locale, "downloadCard"))}
</footer>`
}

function qa(origin: string, q: Question, locale: Locale, onPage = false): string {
  if (q.answer == null) return ""
  const path = `/q/${q.public_id}`
  const title = onPage
    ? `<p class="font-serif text-xl font-medium leading-snug sm:text-2xl" dir="auto">${escapeHtml(q.body)}</p>`
    : `<p class="font-serif text-xl font-medium leading-snug sm:text-2xl"><a class="transition hover:text-ember" href="${escapeHtml(path)}" dir="auto">${escapeHtml(q.body)}</a></p>`
  return `<article class="overflow-hidden rounded-2xl bg-card shadow-lift ring-1 ring-line/80 sm:rounded-3xl">
<div class="px-5 pt-5 pb-7 sm:px-7 sm:pt-6 sm:pb-8">
${title}
<p class="mt-5 text-[1.05rem] leading-relaxed text-ink/90" dir="auto">${escapeHtml(q.answer)}</p>
${meta(q, locale)}
</div>
${shares(origin, q, locale, onPage)}
</article>`
}

async function home(url: URL, env: Env, settings: Settings): Promise<Response> {
  const locale = settings.locale
  const thanks =
    url.searchParams.get("asked") === "1"
      ? `<p class="${flashOk}">${escapeHtml(t(locale, "thanks"))}</p>`
      : ""
  const wall = await listWall(env.DB)
  const items = wall.map((q) => qa(url.origin, q, locale)).join("")
  const list =
    wall.length === 0
      ? `<p class="mt-8 text-sm text-mute">${escapeHtml(t(locale, "emptyWall"))}</p>`
      : `<h2 class="mt-8 mb-3 font-serif text-lg font-semibold sm:mt-10 sm:mb-4 sm:text-xl">${escapeHtml(t(locale, "answered"))}</h2>
<div class="grid gap-3 sm:gap-5">${items}</div>`
  return page(200, env, settings, `${thanks}${askForm(env, locale)}${list}`)
}

async function ask(request: Request, env: Env, settings: Settings): Promise<Response> {
  const locale = settings.locale
  if (!checkOrigin(request)) return page(403, env, settings, `<p class="text-mute">${escapeHtml(t(locale, "forbidden"))}</p>`)

  const ip = clientIp(request)
  if (!(await rateLimit(env.DB, `ask:${ip}`, 5, 600))) {
    return page(429, env, settings, `<p class="text-mute">${escapeHtml(t(locale, "tooManyAsks"))}</p>`)
  }

  const form = await request.formData()
  const body = String(form.get("body") ?? "").trim()
  const name = String(form.get("name") ?? "").trim()
  const email = String(form.get("email") ?? "").trim()

  if (body.length < 1 || body.length > 1000) return page(400, env, settings, `<p class="text-mute">${escapeHtml(t(locale, "invalidQuestion"))}</p>`)
  if (name.length > 80) return page(400, env, settings, `<p class="text-mute">${escapeHtml(t(locale, "invalidName"))}</p>`)
  if (email.length > 120) return page(400, env, settings, `<p class="text-mute">${escapeHtml(t(locale, "invalidEmailLen"))}</p>`)
  if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return page(400, env, settings, `<p class="text-mute">${escapeHtml(t(locale, "invalidEmail"))}</p>`)

  if (env.TURNSTILE_SECRET_KEY) {
    const token = String(form.get("cf-turnstile-response") ?? "") || null
    if (!(await verifyTurnstile(token, ip, env.TURNSTILE_SECRET_KEY))) {
      return page(400, env, settings, `<p class="text-mute">${escapeHtml(t(locale, "botCheck"))}</p>`)
    }
  }

  await insertQuestion(env.DB, {
    public_id: crypto.randomUUID(),
    body,
    asker_name: name || null,
    asker_email: email || null,
    is_anonymous: !name && !email,
    country: request.headers.get("CF-IPCountry") || null,
  })

  return new Response(null, { status: 303, headers: { Location: "/?asked=1" } })
}

async function permalink(url: URL, env: Env, settings: Settings, uuid: string): Promise<Response> {
  const q = await getByPublicId(env.DB, uuid)
  if (!q || q.answer == null) {
    return page(404, env, settings, `<p class="text-mute">${escapeHtml(t(settings.locale, "notAnswered"))}</p>`)
  }

  const image = `${url.origin}/q/${q.public_id}/og.png`
  const extraHead = `<meta property="og:title" content="${escapeHtml(env.SITE_NAME)}">
<meta property="og:description" content="${escapeHtml(q.body)}">
<meta property="og:image" content="${escapeHtml(image)}">
<meta name="twitter:card" content="summary_large_image">`

  const back = `<p class="mb-4"><a class="${btnGhost} w-full sm:w-auto" href="/">${escapeHtml(t(settings.locale, "backToQuestions"))}</a></p>`
  return page(200, env, settings, `${back}${qa(url.origin, q, settings.locale, true)}`, extraHead)
}
