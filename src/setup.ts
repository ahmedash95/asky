import { getSettings, saveSettings } from "./db"
import { layout } from "./html"
import { parseLocale, t, type Locale } from "./i18n"
import { readAvatar } from "./avatar"
import {
  checkOrigin,
  clientIp,
  cookieHeader,
  escapeHtml,
  hashPassword,
  makeSession,
  normalizeAdminPath,
  rateLimit,
} from "./security"
import { btnBlock, card, flashErr, help, input, label } from "./ui"

export async function handleSetup(request: Request, env: Env): Promise<Response> {
  const url = new URL(request.url)
  const locale = parseLocale(url.searchParams.get("lang"))
  if (request.method === "POST") {
    if (!checkOrigin(request)) return new Response("Forbidden", { status: 403 })
    if (url.pathname !== "/" && url.pathname !== "/setup") {
      return page(env, locale, setupForm(env, locale))
    }
    return submit(request, env)
  }
  return page(env, locale, setupForm(env, locale, url.searchParams.get("err")))
}

function page(env: Env, locale: Locale, body: string): Response {
  return new Response(
    layout({
      title: t(locale, "setupTitle"),
      body,
      env,
      chrome: "setup",
      locale,
      extraHead: `<meta name="robots" content="noindex">`,
    }),
    { headers: { "content-type": "text/html; charset=utf-8" } },
  )
}

function langSwitch(locale: Locale): string {
  const on = "rounded-full bg-ink px-3 py-1.5 text-sm font-medium text-paper"
  const off = "rounded-full px-3 py-1.5 text-sm font-medium text-mute hover:text-ink"
  return `<div class="mb-5 flex justify-center gap-1 rounded-full bg-card p-1 ring-1 ring-line">
<a class="${locale === "en" ? on : off}" href="/?lang=en">${escapeHtml(t(locale, "english"))}</a>
<a class="${locale === "ar" ? on : off}" href="/?lang=ar">${escapeHtml(t(locale, "arabic"))}</a>
</div>`
}

function setupForm(env: Env, locale: Locale, err?: string | null): string {
  const suggested = escapeHtml(normalizeAdminPath(env.ADMIN_PATH ?? "/inbox") ?? "/inbox")
  const flash = err ? `<p class="${flashErr}">${escapeHtml(err)}</p>` : ""
  return `${langSwitch(locale)}${flash}
<section class="${card}">
<p class="font-serif text-2xl font-semibold leading-tight">${escapeHtml(t(locale, "setupTitle"))}</p>
<p class="mt-2 text-sm leading-relaxed text-mute">${escapeHtml(t(locale, "setupLead"))}</p>
<form class="mt-6 grid gap-4" method="post" action="/setup" enctype="multipart/form-data">
<input type="hidden" name="locale" value="${locale}">
<div>
<p class="${label}">${escapeHtml(t(locale, "photo"))}</p>
<div class="mt-2 flex items-center gap-3">
<div data-avatar-preview class="grid size-14 place-items-center overflow-hidden rounded-2xl bg-ink font-serif text-2xl text-paper shadow-lift">?</div>
<label class="text-sm font-medium text-ember hover:text-ember-dark">
<span>${escapeHtml(t(locale, "photo"))}</span>
<input class="sr-only" data-avatar-input type="file" name="avatar" accept="image/jpeg,image/png,image/webp,image/gif">
</label>
</div>
<p class="${help}">${escapeHtml(t(locale, "photoHelp"))}</p>
</div>
<label class="${label}">${escapeHtml(t(locale, "adminPath"))}
<input class="${input}" dir="ltr" name="admin_path" value="${suggested}" required maxlength="64" autocomplete="off">
</label>
<p class="${help}">${escapeHtml(t(locale, "adminPathHelp"))}</p>
<label class="${label}">${escapeHtml(t(locale, "password"))}
<input class="${input}" type="password" name="password" required minlength="8" maxlength="200" autocomplete="new-password">
</label>
<label class="${label}">${escapeHtml(t(locale, "confirmPassword"))}
<input class="${input}" type="password" name="confirm" required minlength="8" maxlength="200" autocomplete="new-password">
</label>
<button class="${btnBlock} mt-2" type="submit">${escapeHtml(t(locale, "saveContinue"))}</button>
</form>
</section>`
}

async function submit(request: Request, env: Env): Promise<Response> {
  const form = await request.formData()
  const locale = parseLocale(form.get("locale"))
  if (await getSettings(env.DB)) {
    return new Response(null, { status: 303, headers: { Location: "/" } })
  }
  if (!(await rateLimit(env.DB, `setup:${clientIp(request)}`, 8, 600))) {
    return page(env, locale, setupForm(env, locale, t(locale, "tooManyTries")))
  }
  const adminPath = normalizeAdminPath(String(form.get("admin_path") ?? ""))
  const password = String(form.get("password") ?? "")
  const confirm = String(form.get("confirm") ?? "")
  const avatar = await readAvatar(form)
  if (avatar === "invalid") {
    return page(env, locale, setupForm(env, locale, t(locale, "badPhoto")))
  }
  if (!adminPath) {
    return page(env, locale, setupForm(env, locale, t(locale, "badPath")))
  }
  if (password.length < 8 || password.length > 200) {
    return page(env, locale, setupForm(env, locale, t(locale, "shortPassword")))
  }
  if (password !== confirm) {
    return page(env, locale, setupForm(env, locale, t(locale, "passwordMismatch")))
  }
  const sessionSecret = [...crypto.getRandomValues(new Uint8Array(32))]
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("")
  const ok = await saveSettings(env.DB, {
    admin_path: adminPath,
    password_hash: await hashPassword(password),
    session_secret: sessionSecret,
    locale,
    avatar: avatar ?? undefined,
  })
  if (!ok) return new Response(null, { status: 303, headers: { Location: "/" } })
  return new Response(null, {
    status: 303,
    headers: {
      Location: adminPath,
      "Set-Cookie": cookieHeader(await makeSession(sessionSecret), request),
    },
  })
}
