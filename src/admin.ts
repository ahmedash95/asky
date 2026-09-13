import {
  answerQuestion,
  deleteQuestion,
  listAdmin,
  siteName,
  stats,
  updateProfile,
  type Question,
  type Settings,
} from "./db";
import { readAvatar } from "./avatar";
import { countryCode, countryName, flagUrl } from "./country";
import { layout } from "./html";
import { icon } from "./icons";
import { parseLocale, t } from "./i18n";
import { readLinksFromForm } from "./links";
import {
  checkOrigin,
  clientIp,
  cookieHeader,
  escapeHtml,
  makeSession,
  normalizeAdminPath,
  rateLimit,
  readSession,
  verifyPassword,
} from "./security";
import {
  btn,
  btnBlock,
  btnDanger,
  btnQuiet,
  card,
  field,
  flashErr,
  flashOk,
  input,
  label,
  sectionTitle,
  textarea,
} from "./ui";

type View = "inbox" | "answered" | "profile";

function restPath(pathname: string, base: string): string {
  if (pathname === base || pathname === `${base}/`) return "/";
  return pathname.startsWith(`${base}/`) ? pathname.slice(base.length) : "/";
}

function parseView(raw: string | null): View {
  return raw === "answered" || raw === "profile" ? raw : "inbox";
}

function html(
  env: Env,
  settings: Settings,
  title: string,
  body: string,
  chrome: "admin" | "login" = "admin",
): Response {
  return new Response(
    layout({
      title,
      body,
      env,
      chrome,
      locale: settings.locale,
      hasAvatar: settings.has_avatar === 1,
      siteName: siteName(env, settings),
    }),
    { headers: { "content-type": "text/html; charset=utf-8" } },
  );
}

function seeOther(location: string, extra?: Record<string, string>): Response {
  return new Response(null, {
    status: 303,
    headers: { Location: location, ...extra },
  });
}

function when(ts: number, locale: Settings["locale"]): string {
  return new Date(ts * 1000).toLocaleDateString(
    locale === "ar" ? "ar" : "en-GB",
    {
      day: "numeric",
      month: "short",
      year: "numeric",
    },
  );
}

export function isAdminPath(pathname: string, adminPath: string): boolean {
  const base = normalizeAdminPath(adminPath) ?? adminPath;
  return pathname === base || pathname.startsWith(`${base}/`);
}

export async function handleAdmin(
  request: Request,
  env: Env,
  settings: Settings,
): Promise<Response> {
  const base = settings.admin_path;
  const url = new URL(request.url);
  const rest = restPath(url.pathname, base);

  if (request.method === "POST" && !checkOrigin(request)) {
    return new Response("Forbidden", { status: 403 });
  }

  if (request.method === "POST" && rest === "/logout") {
    const secure = new URL(request.url).protocol === "https:";
    return seeOther(base, {
      "Set-Cookie": `asky=; HttpOnly; SameSite=Lax; Path=/; Max-Age=0${secure ? "; Secure" : ""}`,
    });
  }

  const authed = await readSession(request, settings.session_secret);
  if (!authed) {
    if (request.method === "POST" && rest === "/")
      return login(request, env, settings, base);
    if (request.method === "GET") {
      return html(
        env,
        settings,
        t(settings.locale, "logIn"),
        loginForm(settings, base),
        "login",
      );
    }
    return new Response("Forbidden", { status: 403 });
  }

  if (request.method === "GET") {
    if (rest !== "/") return new Response("Not found", { status: 404 });
    return dashboard(url, env, settings, base);
  }

  if (request.method === "POST") {
    if (rest === "/answer") return writeAnswer(request, env, base);
    if (rest === "/delete") return writeDelete(request, env, base);
    if (rest === "/profile") return writeProfile(request, env, settings, base);
    return new Response("Not found", { status: 404 });
  }

  return new Response("Method not allowed", { status: 405 });
}

function loginForm(settings: Settings, base: string, err?: string): string {
  const locale = settings.locale;
  const flash = err ? `<p class="${flashErr}">${escapeHtml(err)}</p>` : "";
  return `${flash}
<section class="${card}">
<p class="font-serif text-2xl font-semibold">${escapeHtml(t(locale, "welcomeBack"))}</p>
<p class="mt-2 text-sm text-mute">${escapeHtml(t(locale, "loginLead"))}</p>
<form class="mt-6 grid gap-4" method="post" action="${escapeHtml(base)}">
<label class="${label}">${escapeHtml(t(locale, "password"))}
<input class="${input}" type="password" name="password" required autocomplete="current-password">
</label>
<button class="${btnBlock}" type="submit">${escapeHtml(t(locale, "logIn"))}</button>
</form>
</section>`;
}

async function login(
  request: Request,
  env: Env,
  settings: Settings,
  base: string,
): Promise<Response> {
  if (!(await rateLimit(env.DB, `admin:${clientIp(request)}`, 8, 600))) {
    return new Response("Too many attempts", { status: 429 });
  }
  const form = await request.formData();
  const password = String(form.get("password") ?? "");
  if (!(await verifyPassword(password, settings.password_hash))) {
    return html(
      env,
      settings,
      t(settings.locale, "logIn"),
      loginForm(settings, base, t(settings.locale, "wrongPassword")),
      "login",
    );
  }
  return seeOther(base, {
    "Set-Cookie": cookieHeader(
      await makeSession(settings.session_secret),
      request,
    ),
  });
}

async function dashboard(
  url: URL,
  env: Env,
  settings: Settings,
  base: string,
): Promise<Response> {
  const locale = settings.locale;
  const view = parseView(url.searchParams.get("view"));
  const s = await stats(env.DB);
  const pane =
    view === "profile"
      ? profilePane(url, env, settings, base)
      : await questionsPane(env, settings, base, view);

  return html(
    env,
    settings,
    t(locale, view),
    `<div class="mx-auto lg:grid lg:max-w-[60rem] lg:grid-cols-[14rem_minmax(0,1fr)] lg:items-start lg:gap-14">
${adminNav(env, settings, base, view, s)}
<div class="min-w-0">${pane}</div>
</div>`,
  );
}

function adminNav(
  env: Env,
  settings: Settings,
  base: string,
  view: View,
  s: { unanswered: number; answered: number },
): string {
  const locale = settings.locale;
  const href = escapeHtml(base);
  const name = escapeHtml(siteName(env, settings));
  const photo = settings.has_avatar
    ? `<img src="/avatar" alt="" class="size-full object-cover">`
    : `<span class="font-serif text-lg text-paper">?</span>`;
  const item = (id: View, label: string, count?: number) => {
    const on = view === id;
    const base =
      "flex min-h-11 w-full items-center justify-center gap-1.5 rounded-xl px-2 text-sm font-medium lg:justify-between lg:gap-3 lg:px-3";
    const cls = on
      ? `${base} bg-ink text-paper`
      : `${base} text-mute transition hover:bg-card hover:text-ink`;
    const badge =
      count == null
        ? ""
        : `<span class="rounded-full ${on ? "bg-white/15 text-paper" : "bg-ink/10 text-mute"} px-1.5 py-0.5 text-xs font-medium tabular-nums">${count}</span>`;
    return `<a class="${cls}" href="${href}?view=${id}"><span class="truncate">${escapeHtml(label)}</span>${badge}</a>`;
  };
  const quietLink = "text-sm font-medium text-mute transition hover:text-ink";
  return `<aside class="mb-6 border-b border-line pb-4 lg:mb-0 lg:border-0 lg:pb-0 lg:sticky lg:top-8">
<div class="flex items-center justify-between gap-3">
<div class="flex min-w-0 items-center gap-3">
<a href="/" class="grid size-10 shrink-0 place-items-center overflow-hidden rounded-full bg-ink shadow-lift ring-1 ring-white/10">${photo}</a>
<div class="min-w-0">
<p class="truncate font-serif text-lg font-semibold leading-tight">${name}</p>
<p class="mt-0.5 text-xs text-mute">${escapeHtml(t(locale, "privateInbox"))}</p>
</div>
</div>
<div class="flex shrink-0 items-center gap-4 lg:hidden">
<a class="${quietLink}" href="/">${escapeHtml(t(locale, "viewSite"))}</a>
<form method="post" action="${href}/logout"><button class="${quietLink}" type="submit">${escapeHtml(t(locale, "logOut"))}</button></form>
</div>
</div>
<nav class="mt-4 grid grid-cols-3 gap-1 lg:mt-7 lg:flex lg:flex-col lg:gap-0.5">
${item("inbox", t(locale, "inbox"), s.unanswered)}
${item("answered", t(locale, "answered"), s.answered)}
${item("profile", t(locale, "profile"))}
</nav>
<div class="mt-7 hidden border-t border-line pt-4 lg:flex lg:items-center lg:gap-4 lg:ps-3">
<a class="${quietLink}" href="/">${escapeHtml(t(locale, "viewSite"))}</a>
<form method="post" action="${href}/logout"><button class="${quietLink}" type="submit">${escapeHtml(t(locale, "logOut"))}</button></form>
</div>
</aside>`;
}

function paneHeader(title: string, lead: string): string {
  return `<header class="mb-6 border-b border-line pb-5">
<h1 class="font-serif text-2xl font-semibold tracking-tight">${escapeHtml(title)}</h1>
<p class="mt-1 text-sm text-mute">${escapeHtml(lead)}</p>
</header>`;
}

async function questionsPane(
  env: Env,
  settings: Settings,
  base: string,
  view: "inbox" | "answered",
): Promise<string> {
  const locale = settings.locale;
  const questions = await listAdmin(env.DB, view);
  const items = questions
    .map((q) => questionCard(q, base, settings, view))
    .join("");
  const empty = `<div class="rounded-2xl border border-dashed border-line px-6 py-10 text-center sm:rounded-3xl"><p class="font-serif text-lg font-semibold">${escapeHtml(t(locale, view === "inbox" ? "emptyInbox" : "emptyAnswered"))}</p><p class="mx-auto mt-2 max-w-sm text-sm text-mute">${escapeHtml(t(locale, view === "inbox" ? "emptyInboxHelp" : "emptyAnsweredHelp"))}</p></div>`;
  const lead =
    view === "inbox" ? t(locale, "inboxLead") : t(locale, "answeredLead");
  return `${paneHeader(t(locale, view), lead)}
<div class="grid gap-4">${items || empty}</div>`;
}

function metaItem(inner: string, label: string): string {
  const safe = escapeHtml(label);
  return `<li class="inline-flex items-center gap-1.5" title="${safe}"><span class="sr-only">${safe}</span>${inner}</li>`;
}

function stamp(ts: number, locale: Settings["locale"]): string {
  return `<time datetime="${new Date(ts * 1000).toISOString()}" class="tabular-nums">${escapeHtml(when(ts, locale))}</time>`;
}

function questionMeta(q: Question, locale: Settings["locale"]): string {
  const asker = q.asker_name
    ? `<bdi class="font-medium text-ink">${escapeHtml(q.asker_name)}</bdi>`
    : `<span class="text-ink">${escapeHtml(t(locale, "anonymous"))}</span>`;
  const items = [metaItem(`${icon("user")}${asker}`, t(locale, "askedBy"))];

  if (q.asker_email) {
    const mail = escapeHtml(q.asker_email);
    items.push(
      `<li><a class="inline-flex items-center gap-1.5 transition hover:text-ink" href="mailto:${mail}"><span class="sr-only">${escapeHtml(t(locale, "email"))}</span>${icon("mail")}<bdi>${mail}</bdi></a></li>`,
    );
  }

  const code = countryCode(q.country);
  if (code) {
    const flag = flagUrl(code, 20);
    const badge = flag
      ? `<img class="h-3.5 w-5 shrink-0 rounded-sm object-cover ring-1 ring-line" src="${flag}" srcset="${flag} 1x, ${flagUrl(code, 40)} 2x" width="20" height="14" alt="" loading="lazy" decoding="async" onerror="this.remove()">`
      : icon("globe");
    items.push(
      metaItem(
        `${badge}<bdi>${escapeHtml(countryName(code, locale))}</bdi>`,
        t(locale, "fromCountry"),
      ),
    );
  }

  items.push(
    metaItem(
      `${icon("calendar")}${stamp(q.created_at, locale)}`,
      t(locale, "askedOn"),
    ),
  );
  if (q.answered_at) {
    items.push(
      metaItem(
        `${icon("check")}${stamp(q.answered_at, locale)}`,
        t(locale, "answeredOn"),
      ),
    );
  }
  return `<ul class="mt-3 flex flex-wrap items-center gap-x-4 gap-y-2 text-sm text-mute">${items.join("")}</ul>`;
}

function questionCard(
  q: Question,
  base: string,
  settings: Settings,
  view: "inbox" | "answered",
): string {
  const locale = settings.locale;
  const action = escapeHtml(base);
  const id = escapeHtml(q.public_id);
  const publicLink =
    q.answer != null
      ? `<a class="${btnQuiet}" href="/q/${id}">${icon("external")}${escapeHtml(t(locale, "viewOnSite"))}</a>`
      : "";
  return `<article class="${card}">
<p class="font-serif text-lg font-medium leading-snug sm:text-xl" dir="auto">${escapeHtml(q.body)}</p>
${questionMeta(q, locale)}
<form class="mt-4 border-t border-line pt-5" method="post" action="${action}/answer">
<input type="hidden" name="public_id" value="${id}">
<input type="hidden" name="view" value="${view}">
<label class="sr-only" for="a-${id}">${escapeHtml(t(locale, "writeAnswer"))}</label>
<textarea id="a-${id}" class="${textarea} min-h-28" dir="auto" name="answer" required maxlength="5000" placeholder="${escapeHtml(t(locale, "writeAnswer"))}">${q.answer ? escapeHtml(q.answer) : ""}</textarea>
<div class="mt-3 flex flex-wrap items-center gap-1.5">
<button class="${btn} me-1.5" type="submit">${escapeHtml(t(locale, q.answer ? "save" : "answer"))}</button>
${publicLink}
<button class="${btnDanger} ms-auto" form="del-${id}" type="submit">${icon("trash")}${escapeHtml(t(locale, "delete"))}</button>
</div>
</form>
<form id="del-${id}" method="post" action="${action}/delete" onsubmit="return confirm(${JSON.stringify(t(locale, "confirmDelete"))})">
<input type="hidden" name="public_id" value="${id}">
<input type="hidden" name="view" value="${view}">
</form>
</article>`;
}

function profilePane(
  url: URL,
  env: Env,
  settings: Settings,
  base: string,
): string {
  const locale = settings.locale;
  const href = escapeHtml(base);
  const err =
    url.searchParams.get("err") === "photo"
      ? `<p class="${flashErr}">${escapeHtml(t(locale, "badPhoto"))}</p>`
      : "";
  const saved =
    url.searchParams.get("saved") === "1"
      ? `<p class="${flashOk}">${escapeHtml(t(locale, "profileSaved"))}</p>`
      : "";
  const photo = settings.has_avatar
    ? `<img src="/avatar" alt="" class="size-full object-cover">`
    : `<span class="font-serif text-3xl text-paper">?</span>`;
  const slots = Array.from(
    { length: 5 },
    (_, i) => settings.links[i] ?? { title: "", url: "" },
  );
  const linkRows = slots
    .map(
      (link, i) => `<div class="grid gap-2 sm:grid-cols-[9rem_minmax(0,1fr)]">
<input class="${field}" name="link_title" maxlength="40" placeholder="${escapeHtml(t(locale, "linkTitle"))}" value="${escapeHtml(link.title)}" autocomplete="off" aria-label="${escapeHtml(t(locale, "linkTitle"))} ${i + 1}">
<input class="${field}" dir="ltr" name="link_url" maxlength="240" placeholder="${escapeHtml(t(locale, "linkUrl"))}" value="${escapeHtml(link.url)}" inputmode="url" autocomplete="off" aria-label="${escapeHtml(t(locale, "linkUrl"))} ${i + 1}">
</div>`,
    )
    .join("");
  const section = (title: string, lead: string, body: string) =>
    `<section class="border-t border-line p-5 first:border-0 sm:p-6">
<h2 class="${sectionTitle}">${escapeHtml(title)}</h2>
${lead ? `<p class="mt-1 text-sm text-mute">${escapeHtml(lead)}</p>` : ""}
<div class="mt-4">${body}</div>
</section>`;
  const pill =
    "cursor-pointer rounded-full px-3.5 py-2 text-sm font-medium text-mute transition has-[:checked]:bg-ink has-[:checked]:text-paper";
  return `${err}${saved}
${paneHeader(t(locale, "profile"), t(locale, "profileLead"))}
<form method="post" action="${href}/profile" enctype="multipart/form-data">
<div class="${card} !p-0">
${section(
  t(locale, "siteName"),
  t(locale, "siteNameHelp"),
  `<label class="sr-only" for="site_name">${escapeHtml(t(locale, "siteName"))}</label>
<input id="site_name" class="${field}" dir="auto" name="site_name" maxlength="60" placeholder="${escapeHtml(env.SITE_NAME)}" value="${escapeHtml(settings.site_name)}" autocomplete="off">`,
)}
${section(
  t(locale, "photo"),
  t(locale, "photoHelp"),
  `<div class="flex items-center gap-4">
<div data-avatar-preview class="grid size-16 shrink-0 place-items-center overflow-hidden rounded-full bg-ink shadow-lift ring-1 ring-white/10">${photo}</div>
<div class="flex min-w-0 flex-wrap items-center gap-1">
<label class="${btnQuiet} cursor-pointer text-ink">
<span>${escapeHtml(t(locale, settings.has_avatar ? "photoReplace" : "photo"))}</span>
<input class="sr-only" data-avatar-input type="file" name="avatar" accept="image/jpeg,image/png,image/webp,image/gif">
</label>
${settings.has_avatar ? `<button class="${btnDanger}" type="submit" name="remove_avatar" value="1">${escapeHtml(t(locale, "photoRemove"))}</button>` : ""}
</div>
</div>`,
)}
${section(
  t(locale, "bio"),
  t(locale, "bioHelp"),
  `<label class="sr-only" for="bio">${escapeHtml(t(locale, "bio"))}</label>
<textarea id="bio" dir="auto" class="${textarea} min-h-24" name="bio" maxlength="400" placeholder="${escapeHtml(t(locale, "bioPlaceholder"))}">${escapeHtml(settings.bio)}</textarea>`,
)}
${section(t(locale, "links"), t(locale, "linksHelp"), `<div class="grid gap-2">${linkRows}</div>`)}
${section(
  t(locale, "language"),
  "",
  `<fieldset>
<legend class="sr-only">${escapeHtml(t(locale, "language"))}</legend>
<div class="flex w-fit gap-1 rounded-full bg-paper p-1 ring-1 ring-line">
<label class="${pill}">
<input class="sr-only" type="radio" name="locale" value="en"${locale === "en" ? " checked" : ""}> ${escapeHtml(t(locale, "english"))}
</label>
<label class="${pill}">
<input class="sr-only" type="radio" name="locale" value="ar"${locale === "ar" ? " checked" : ""}> ${escapeHtml(t(locale, "arabic"))}
</label>
</div>
</fieldset>`,
)}
</div>
<div class="mt-5">
<button class="${btn} w-full sm:w-auto" type="submit">${escapeHtml(t(locale, "saveProfile"))}</button>
</div>
</form>`;
}

async function writeAnswer(
  request: Request,
  env: Env,
  base: string,
): Promise<Response> {
  const form = await request.formData();
  const publicId = String(form.get("public_id") ?? "");
  const answer = String(form.get("answer") ?? "").trim();
  const view = parseView(String(form.get("view") ?? ""));
  if (!publicId || answer.length < 1 || answer.length > 5000) {
    return new Response("Invalid answer", { status: 400 });
  }
  await answerQuestion(env.DB, publicId, answer);
  return seeOther(`${base}?view=${view === "profile" ? "inbox" : view}`);
}

async function writeDelete(
  request: Request,
  env: Env,
  base: string,
): Promise<Response> {
  const form = await request.formData();
  const publicId = String(form.get("public_id") ?? "");
  const view = parseView(String(form.get("view") ?? ""));
  if (!publicId) return new Response("Bad request", { status: 400 });
  await deleteQuestion(env.DB, publicId);
  return seeOther(`${base}?view=${view === "profile" ? "inbox" : view}`);
}

async function writeProfile(
  request: Request,
  env: Env,
  settings: Settings,
  base: string,
): Promise<Response> {
  const form = await request.formData();
  const locale = parseLocale(form.get("locale"));
  const siteName = String(form.get("site_name") ?? "")
    .trim()
    .slice(0, 60);
  const bio = String(form.get("bio") ?? "")
    .trim()
    .slice(0, 400);
  const links = readLinksFromForm(form);
  const dest = `${base}?view=profile`;
  if (String(form.get("remove_avatar") ?? "") === "1") {
    await updateProfile(env.DB, {
      locale,
      siteName,
      bio,
      links,
      removeAvatar: true,
    });
    return seeOther(`${dest}&saved=1`);
  }
  const avatar = await readAvatar(form);
  if (avatar === "invalid") return seeOther(`${dest}&err=photo`);
  await updateProfile(env.DB, {
    locale,
    siteName,
    bio,
    links,
    avatar: avatar ?? undefined,
  });
  return seeOther(`${dest}&saved=1`);
}
