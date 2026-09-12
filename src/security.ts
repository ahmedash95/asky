const SESSION_SECS = 30 * 24 * 60 * 60
const enc = new TextEncoder()

export function escapeHtml(s: string): string {
  return s
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;")
}

export function clientIp(request: Request): string {
  return request.headers.get("CF-Connecting-IP") ?? "0.0.0.0"
}

export function checkOrigin(request: Request): boolean {
  const host = new URL(request.url).host
  const origin = request.headers.get("Origin")
  if (origin && origin !== "null") {
    try {
      return new URL(origin).host === host
    } catch {
      return false
    }
  }
  const site = request.headers.get("Sec-Fetch-Site")
  if (site === "same-origin" || site === "same-site") return true
  const method = request.method.toUpperCase()
  if (method === "GET" || method === "HEAD" || method === "OPTIONS") return true
  const referer = request.headers.get("Referer")
  if (!referer) return false
  try {
    return new URL(referer).host === host
  } catch {
    return false
  }
}

export function cookieHeader(value: string, request?: Request): string {
  const secure = request ? new URL(request.url).protocol === "https:" : true
  return `asky=${value}; Path=/; HttpOnly; SameSite=Lax; Max-Age=${SESSION_SECS}${secure ? "; Secure" : ""}`
}

export async function readSession(request: Request, secret: string): Promise<boolean> {
  const value = cookieValue(request, "asky")
  if (!value) return false
  const dot = value.indexOf(".")
  if (dot < 1) return false
  const expiry = value.slice(0, dot)
  const sig = value.slice(dot + 1)
  if (!sig) return false
  const exp = Number(expiry)
  if (!Number.isFinite(exp) || exp < Date.now() / 1000) return false
  return timingSafeEqual(sig, await hmacHex(secret, expiry))
}

export async function makeSession(secret: string): Promise<string> {
  const expiry = String(Math.floor(Date.now() / 1000) + SESSION_SECS)
  return `${expiry}.${await hmacHex(secret, expiry)}`
}

export function timingSafeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false
  let diff = 0
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i)
  return diff === 0
}

export function normalizeAdminPath(path: string): string | null {
  let p = path.trim()
  if (!p.startsWith("/")) p = `/${p}`
  p = p.replace(/\/+$/, "") || "/"
  if (p === "/" || p === "/ask" || p === "/setup" || p === "/q" || p.startsWith("/q/")) return null
  if (!/^\/[A-Za-z0-9][A-Za-z0-9_-]{0,62}$/.test(p)) return null
  return p
}

const PBKDF2_ITERS = 100_000

export async function hashPassword(password: string): Promise<string> {
  const salt = crypto.getRandomValues(new Uint8Array(16))
  const hash = await pbkdf2(password, salt, PBKDF2_ITERS)
  return `pbkdf2:${PBKDF2_ITERS}:${b64(salt)}:${b64(hash)}`
}

export async function verifyPassword(password: string, stored: string): Promise<boolean> {
  const [scheme, iterStr, saltB64, hashB64] = stored.split(":")
  if (scheme !== "pbkdf2" || !iterStr || !saltB64 || !hashB64) return false
  const iterations = Number(iterStr)
  if (!Number.isFinite(iterations) || iterations < 1) return false
  const salt = fromB64(saltB64)
  const expected = fromB64(hashB64)
  if (!salt || !expected) return false
  const actual = await pbkdf2(password, salt, iterations)
  return timingSafeEqual(b64(actual), b64(expected))
}

async function pbkdf2(password: string, salt: Uint8Array, iterations: number): Promise<Uint8Array> {
  const key = await crypto.subtle.importKey("raw", enc.encode(password), "PBKDF2", false, ["deriveBits"])
  const bits = await crypto.subtle.deriveBits({ name: "PBKDF2", hash: "SHA-256", salt, iterations }, key, 256)
  return new Uint8Array(bits)
}

function b64(bytes: Uint8Array): string {
  return btoa(String.fromCharCode(...bytes))
}

function fromB64(s: string): Uint8Array | null {
  try {
    return Uint8Array.from(atob(s), (c) => c.charCodeAt(0))
  } catch {
    return null
  }
}

export async function rateLimit(
  db: D1Database,
  key: string,
  limit: number,
  windowSecs: number,
): Promise<boolean> {
  const now = Math.floor(Date.now() / 1000)
  const resetAt = now + windowSecs
  const row = await db
    .prepare(
      `INSERT INTO rate_limits (key, count, reset_at) VALUES (?, 1, ?)
       ON CONFLICT(key) DO UPDATE SET
         count = CASE WHEN rate_limits.reset_at < ? THEN 1 ELSE rate_limits.count + 1 END,
         reset_at = CASE WHEN rate_limits.reset_at < ? THEN excluded.reset_at ELSE rate_limits.reset_at END
       RETURNING count`,
    )
    .bind(key, resetAt, now, now)
    .first<{ count: number }>()
  return (row?.count ?? 1) <= limit
}

export async function verifyTurnstile(token: string | null, ip: string, secret: string): Promise<boolean> {
  if (!secret) return true
  if (!token) return false
  try {
    const res = await fetch("https://challenges.cloudflare.com/turnstile/v0/siteverify", {
      method: "POST",
      body: new URLSearchParams({ secret, response: token, remoteip: ip }),
    })
    const data = (await res.json()) as { success?: boolean }
    return data.success === true
  } catch {
    return false
  }
}

function cookieValue(request: Request, name: string): string | null {
  const header = request.headers.get("Cookie")
  if (!header) return null
  for (const part of header.split(";")) {
    const eq = part.indexOf("=")
    if (eq === -1) continue
    if (part.slice(0, eq).trim() === name) return part.slice(eq + 1).trim()
  }
  return null
}

async function hmacHex(secret: string, msg: string): Promise<string> {
  const key = await crypto.subtle.importKey(
    "raw",
    enc.encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  )
  const sig = await crypto.subtle.sign("HMAC", key, enc.encode(msg))
  return [...new Uint8Array(sig)].map((b) => b.toString(16).padStart(2, "0")).join("")
}
