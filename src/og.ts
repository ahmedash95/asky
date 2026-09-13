// dep: @cf-wasm/resvg
import { Resvg } from "@cf-wasm/resvg/workerd"
import { getByPublicId, siteName, type Settings } from "./db"
import { font } from "./fonts/serif"
import arabicFont from "./fonts/NotoNaskhArabic-Regular.ttf"
import { isRtlText } from "./i18n"

const W = 1200
const H = 630
const LINE = 36
const MAX_LINES = 6
const arabicBytes = new Uint8Array(arabicFont)

export async function handleOg(
  _request: Request,
  env: Env,
  uuid: string,
  settings: Settings,
): Promise<Response> {
  const q = await getByPublicId(env.DB, uuid)
  if (!q || !q.answer) return new Response("Not found", { status: 404 })

  const resvg = await Resvg.async(svg(siteName(env, settings), q.body), {
    fitTo: { mode: "original" },
    font: {
      fontBuffers: [font, arabicBytes],
      defaultFontFamily: isRtlText(q.body) ? "Noto Naskh Arabic" : "IBM Plex Serif",
    },
  })
  return new Response(resvg.render().asPng(), {
    headers: {
      "Content-Type": "image/png",
      "Cache-Control": "public, max-age=3600",
    },
  })
}

function svg(site: string, question: string): string {
  const rtl = isRtlText(question)
  const family = rtl ? "Noto Naskh Arabic" : "IBM Plex Serif"
  const x = rtl ? 1120 : 80
  const anchor = rtl ? "end" : "start"
  const lines = wrap(question, LINE, MAX_LINES)
  const texts = lines
    .map((line, i) => `<text x="${x}" y="${200 + i * 62}" text-anchor="${anchor}" fill="#f4efe6" font-size="48" font-family="${family}">${esc(line)}</text>`)
    .join("")
  const barX = rtl ? 1184 : 0
  const ruleX = rtl ? 1048 : 80
  const markX = rtl ? 90 : 1110
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}">
<rect width="${W}" height="${H}" fill="#1a1510"/>
<rect x="${barX}" y="0" width="16" height="${H}" fill="#c45c26"/>
<rect x="${ruleX}" y="112" width="72" height="4" fill="#c45c26"/>
<text x="${x}" y="88" text-anchor="${anchor}" fill="#c45c26" font-size="22" font-family="${family}">${esc(site)}</text>
${texts}
<circle cx="${markX}" cy="78" r="26" fill="none" stroke="#c45c26" stroke-width="2.5"/>
<text x="${markX}" y="90" text-anchor="middle" fill="#c45c26" font-size="32" font-family="${family}">?</text>
</svg>`
}

function wrap(text: string, width: number, maxLines: number): string[] {
  let rest = text.replace(/\s+/g, " ").trim()
  const lines: string[] = []
  while (rest && lines.length < maxLines) {
    if (rest.length <= width) {
      lines.push(rest)
      rest = ""
      break
    }
    const cut = rest.lastIndexOf(" ", width)
    const at = cut > 0 ? cut : width
    lines.push(rest.slice(0, at).trimEnd())
    rest = rest.slice(at).trimStart()
  }
  if (rest && lines.length) {
    const last = lines[lines.length - 1]
    lines[lines.length - 1] = `${last.slice(0, Math.max(1, width - 1)).trimEnd()}…`
  }
  return lines
}

function esc(s: string): string {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;")
}
