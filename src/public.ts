import {
  insertQuestion,
  listWall,
  getByPublicId,
  siteName,
  type Question,
  type Settings,
} from "./db";
import {
  escapeHtml,
  clientIp,
  checkOrigin,
  rateLimit,
  verifyTurnstile,
} from "./security";
import { layout, publicFrame } from "./html";
import { icon } from "./icons";
import { t, type Locale } from "./i18n";
import { btnBlock, btnQuiet, card, flashOk, help, input, label } from "./ui";

export function handlePublic(
  request: Request,
  env: Env,
  settings: Settings,
): Promise<Response> {
  const url = new URL(request.url);
  const { pathname } = url;
  const locale = settings.locale;

  if (request.method === "GET" && pathname === "/")
    return home(url, env, settings);
  if (request.method === "POST" && pathname === "/ask")
    return ask(request, env, settings);

  if (request.method === "GET" && pathname.startsWith("/q/")) {
    const uuid = pathname.slice(3);
    if (uuid && !uuid.includes("/")) return permalink(url, env, settings, uuid);
  }

  return page(
    404,
    env,
    settings,
    `<p class="text-mute">${escapeHtml(t(locale, "notFound"))}</p>`,
  );
}

function page(
  status: number,
  env: Env,
  settings: Settings,
  body: string,
  extraHead?: string,
): Promise<Response> {
  return Promise.resolve(
    new Response(
      layout({
        title: siteName(env, settings),
        body: publicFrame(env, settings, body),
        env,
        extraHead,
        chrome: "public",
        locale: settings.locale,
        hasAvatar: settings.has_avatar === 1,
      }),
      { status, headers: { "content-type": "text/html; charset=utf-8" } },
    ),
  );
}

function askForm(env: Env, locale: Locale): string {
  const turnstile = env.TURNSTILE_SITE_KEY
    ? `<div class="cf-turnstile mt-4" data-sitekey="${escapeHtml(env.TURNSTILE_SITE_KEY)}"></div>
<script src="https://challenges.cloudflare.com/turnstile/v0/api.js" async defer></script>`
    : "";
  return `<form class="${card} !p-0 transition has-[textarea:focus]:ring-2 has-[textarea:focus]:ring-ember/40" method="post" action="/ask">
<div class="px-5 pt-5 sm:px-6 sm:pt-6">
<label class="sr-only" for="body">${escapeHtml(t(locale, "question"))}</label>
<textarea id="body" dir="auto" class="autogrow min-h-24 max-h-[50vh] w-full bg-transparent font-serif text-xl leading-snug text-ink caret-ember outline-none selection:bg-ember/20 placeholder:text-mute/55 sm:min-h-28 sm:text-[1.5rem]" name="body" required maxlength="1000" placeholder="${escapeHtml(t(locale, "askPlaceholder"))}"></textarea>
</div>
<div class="mt-2 border-t border-line px-5 py-4 sm:px-6 sm:py-5">
<details>
<summary class="inline-flex cursor-pointer items-center text-sm font-medium text-mute transition hover:text-ink">${escapeHtml(t(locale, "signName"))} <span class="ms-1 font-normal">${escapeHtml(t(locale, "optional"))}</span></summary>
<div class="mt-3 grid gap-3 sm:grid-cols-2">
<label class="${label}">${escapeHtml(t(locale, "name"))} <input class="${input}" name="name" maxlength="80" autocomplete="name"></label>
<label class="${label}">${escapeHtml(t(locale, "email"))} <input class="${input}" type="email" name="email" maxlength="120" autocomplete="email"></label>
</div>
<p class="${help}">${escapeHtml(t(locale, "anonymousHelp"))}</p>
</details>
${turnstile}
<div class="mt-4 sm:flex sm:justify-end">
<button class="${btnBlock} sm:w-auto" type="submit">${escapeHtml(t(locale, "sendQuestion"))}</button>
</div>
</div>
</form>`;
}

function when(ts: number, locale: Locale): string {
  return new Date(ts * 1000).toLocaleDateString(
    locale === "ar" ? "ar" : "en-GB",
    {
      day: "numeric",
      month: "short",
      year: "numeric",
    },
  );
}

function meta(q: Question, locale: Locale): string {
  const bits: string[] = [];
  if (q.is_anonymous === 0 && q.asker_name) {
    bits.push(
      `${escapeHtml(t(locale, "askedBy"))} <bdi>${escapeHtml(q.asker_name)}</bdi>`,
    );
  }
  if (q.answered_at) {
    const iso = new Date(q.answered_at * 1000).toISOString();
    bits.push(
      `${escapeHtml(t(locale, "answeredOn"))} <time datetime="${iso}">${escapeHtml(when(q.answered_at, locale))}</time>`,
    );
  }
  if (!bits.length) return "";
  return `<p class="mt-6 text-sm text-mute">${bits.join(" · ")}</p>`;
}

function shares(
  origin: string,
  q: Question,
  locale: Locale,
  onPage: boolean,
): string {
  const path = `/q/${q.public_id}`;
  const permalink = `${origin}${path}`;
  const tweet = `https://x.com/intent/tweet?url=${encodeURIComponent(permalink)}&text=${encodeURIComponent(q.body.slice(0, 120))}`;
  const open = onPage
    ? ""
    : `<a class="${btnQuiet} me-auto text-ink" href="${escapeHtml(path)}">${escapeHtml(t(locale, "viewQuestion"))}</a>`;
  const download = onPage
    ? `<a class="${btnQuiet}" href="${escapeHtml(`${path}/og.png`)}">${icon("download")}${escapeHtml(t(locale, "downloadCard"))}</a>`
    : "";
  return `<footer class="flex flex-wrap items-center gap-1 border-t border-line bg-paper/60 px-3 py-2 dark:bg-paper/30">
${open}
<a class="${btnQuiet}" href="${escapeHtml(tweet)}" rel="noopener noreferrer" target="_blank">${icon("x", "size-3.5 shrink-0")}${escapeHtml(t(locale, "shareX"))}</a>
<button type="button" class="${btnQuiet}" data-copy="${escapeHtml(permalink)}">${icon("copy")}<span data-copy-label>${escapeHtml(t(locale, "copyLink"))}</span></button>
${download}
</footer>`;
}

function qa(
  origin: string,
  q: Question,
  locale: Locale,
  onPage = false,
): string {
  if (q.answer == null) return "";
  const path = `/q/${q.public_id}`;
  const size = onPage
    ? "text-[1.5rem] sm:text-[1.75rem]"
    : "text-[1.3rem] sm:text-[1.45rem]";
  const heading = `font-serif ${size} font-medium leading-snug tracking-tight text-balance`;
  const title = onPage
    ? `<h2 class="${heading}" dir="auto">${escapeHtml(q.body)}</h2>`
    : `<h3 class="${heading}"><a class="transition hover:text-ember" href="${escapeHtml(path)}" dir="auto">${escapeHtml(q.body)}</a></h3>`;
  return `<article class="overflow-hidden rounded-2xl bg-card shadow-lift ring-1 ring-line/80 sm:rounded-3xl">
<div class="px-5 pt-6 pb-7 sm:px-7 sm:pt-7 sm:pb-8">
${title}
<p class="mt-4 text-[1.02rem] leading-[1.75] text-ink/85 sm:mt-5" dir="auto">${escapeHtml(q.answer)}</p>
${meta(q, locale)}
</div>
${shares(origin, q, locale, onPage)}
</article>`;
}

async function home(url: URL, env: Env, settings: Settings): Promise<Response> {
  const locale = settings.locale;
  const thanks =
    url.searchParams.get("asked") === "1"
      ? `<p class="${flashOk}">${escapeHtml(t(locale, "thanks"))}</p>`
      : "";
  const wall = await listWall(env.DB);
  const items = wall.map((q) => qa(url.origin, q, locale)).join("");
  const list =
    wall.length === 0
      ? `<p class="mt-10 border-t border-line pt-8 text-sm text-mute">${escapeHtml(t(locale, "emptyWall"))}</p>`
      : `<div class="mt-10 mb-4 flex items-baseline gap-2 border-t border-line pt-8 sm:mt-12 sm:mb-5">
<h2 class="font-serif text-lg font-semibold sm:text-xl">${escapeHtml(t(locale, "answered"))}</h2>
<span class="text-sm text-mute tabular-nums">${wall.length}</span>
</div>
<div class="grid gap-4 sm:gap-6">${items}</div>`;
  return page(200, env, settings, `${thanks}${askForm(env, locale)}${list}`);
}

async function ask(
  request: Request,
  env: Env,
  settings: Settings,
): Promise<Response> {
  const locale = settings.locale;
  if (!checkOrigin(request))
    return page(
      403,
      env,
      settings,
      `<p class="text-mute">${escapeHtml(t(locale, "forbidden"))}</p>`,
    );

  const ip = clientIp(request);
  if (!(await rateLimit(env.DB, `ask:${ip}`, 5, 600))) {
    return page(
      429,
      env,
      settings,
      `<p class="text-mute">${escapeHtml(t(locale, "tooManyAsks"))}</p>`,
    );
  }

  const form = await request.formData();
  const body = String(form.get("body") ?? "").trim();
  const name = String(form.get("name") ?? "").trim();
  const email = String(form.get("email") ?? "").trim();

  if (body.length < 1 || body.length > 1000)
    return page(
      400,
      env,
      settings,
      `<p class="text-mute">${escapeHtml(t(locale, "invalidQuestion"))}</p>`,
    );
  if (name.length > 80)
    return page(
      400,
      env,
      settings,
      `<p class="text-mute">${escapeHtml(t(locale, "invalidName"))}</p>`,
    );
  if (email.length > 120)
    return page(
      400,
      env,
      settings,
      `<p class="text-mute">${escapeHtml(t(locale, "invalidEmailLen"))}</p>`,
    );
  if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email))
    return page(
      400,
      env,
      settings,
      `<p class="text-mute">${escapeHtml(t(locale, "invalidEmail"))}</p>`,
    );

  if (env.TURNSTILE_SECRET_KEY) {
    const token = String(form.get("cf-turnstile-response") ?? "") || null;
    if (!(await verifyTurnstile(token, ip, env.TURNSTILE_SECRET_KEY))) {
      return page(
        400,
        env,
        settings,
        `<p class="text-mute">${escapeHtml(t(locale, "botCheck"))}</p>`,
      );
    }
  }

  await insertQuestion(env.DB, {
    public_id: crypto.randomUUID(),
    body,
    asker_name: name || null,
    asker_email: email || null,
    is_anonymous: !name && !email,
    country: request.headers.get("CF-IPCountry") || null,
  });

  return new Response(null, {
    status: 303,
    headers: { Location: "/?asked=1" },
  });
}

async function permalink(
  url: URL,
  env: Env,
  settings: Settings,
  uuid: string,
): Promise<Response> {
  const q = await getByPublicId(env.DB, uuid);
  if (!q || q.answer == null) {
    return page(
      404,
      env,
      settings,
      `<p class="text-mute">${escapeHtml(t(settings.locale, "notAnswered"))}</p>`,
    );
  }

  const image = `${url.origin}/q/${q.public_id}/og.png`;
  const extraHead = `<meta property="og:title" content="${escapeHtml(siteName(env, settings))}">
<meta property="og:description" content="${escapeHtml(q.body)}">
<meta property="og:image" content="${escapeHtml(image)}">
<meta name="twitter:card" content="summary_large_image">`;

  const back = `<p class="mb-3"><a class="-ms-3 inline-flex min-h-11 items-center gap-2 rounded-xl px-3 text-sm font-medium text-mute transition hover:text-ink" href="/">${icon("arrowLeft", "size-4 shrink-0 rtl:rotate-180")}${escapeHtml(t(settings.locale, "backToQuestions"))}</a></p>`;
  return page(
    200,
    env,
    settings,
    `${back}${qa(url.origin, q, settings.locale, true)}`,
    extraHead,
  );
}
