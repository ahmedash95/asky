export type Link = { title: string; url: string }

export function parseLinks(raw: unknown): Link[] {
  let arr: unknown = raw
  if (typeof raw === "string") {
    try {
      arr = JSON.parse(raw)
    } catch {
      return []
    }
  }
  if (!Array.isArray(arr)) return []
  const out: Link[] = []
  for (const item of arr) {
    if (!item || typeof item !== "object") continue
    const title = String((item as Link).title ?? "").trim().slice(0, 40)
    const url = safeHttpUrl(String((item as Link).url ?? ""))
    if (title && url) out.push({ title, url })
    if (out.length >= 8) break
  }
  return out
}

export function readLinksFromForm(form: FormData): Link[] {
  const titles = form.getAll("link_title").map(String)
  const urls = form.getAll("link_url").map(String)
  const out: Link[] = []
  for (let i = 0; i < Math.max(titles.length, urls.length); i++) {
    const title = (titles[i] ?? "").trim().slice(0, 40)
    const url = safeHttpUrl(urls[i] ?? "")
    if (title && url) out.push({ title, url })
    if (out.length >= 8) break
  }
  return out
}

export function safeHttpUrl(s: string): string | null {
  const raw = s.trim()
  if (!raw) return null
  try {
    const u = new URL(raw.includes("://") ? raw : `https://${raw}`)
    if (u.protocol !== "http:" && u.protocol !== "https:") return null
    return u.toString()
  } catch {
    return null
  }
}
