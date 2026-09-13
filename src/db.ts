import { parseLinks, type Link } from "./links"

export type Settings = {
  admin_path: string
  password_hash: string
  session_secret: string
  locale: "en" | "ar"
  has_avatar: number
  site_name: string
  bio: string
  links: Link[]
}

export async function getSettings(db: D1Database): Promise<Settings | null> {
  const row = await db
    .prepare(
      `SELECT admin_path, password_hash, session_secret, locale, site_name, bio, links,
              CASE WHEN avatar IS NOT NULL THEN 1 ELSE 0 END AS has_avatar
       FROM settings WHERE id = 1`,
    )
    .first<{
      admin_path: string
      password_hash: string
      session_secret: string
      locale: string | null
      site_name: string | null
      bio: string | null
      links: string | null
      has_avatar: number
    }>()
  if (!row) return null
  return {
    admin_path: row.admin_path,
    password_hash: row.password_hash,
    session_secret: row.session_secret,
    locale: row.locale === "ar" ? "ar" : "en",
    has_avatar: row.has_avatar ? 1 : 0,
    site_name: row.site_name ?? "",
    bio: row.bio ?? "",
    links: parseLinks(row.links),
  }
}

/** The name visitors see. Falls back to the SITE_NAME var until the admin sets one. */
export function siteName(env: Env, settings: Settings | null): string {
  return settings?.site_name.trim() || env.SITE_NAME
}

export async function saveSettings(
  db: D1Database,
  s: {
    admin_path: string
    password_hash: string
    session_secret: string
    locale: "en" | "ar"
    avatar?: { bytes: ArrayBuffer; type: string }
  },
): Promise<boolean> {
  try {
    if (s.avatar) {
      await db
        .prepare(
          `INSERT INTO settings (id, admin_path, password_hash, session_secret, locale, avatar, avatar_type)
           VALUES (1, ?, ?, ?, ?, ?, ?)`,
        )
        .bind(s.admin_path, s.password_hash, s.session_secret, s.locale, new Uint8Array(s.avatar.bytes), s.avatar.type)
        .run()
    } else {
      await db
        .prepare(
          `INSERT INTO settings (id, admin_path, password_hash, session_secret, locale)
           VALUES (1, ?, ?, ?, ?)`,
        )
        .bind(s.admin_path, s.password_hash, s.session_secret, s.locale)
        .run()
    }
    return true
  } catch {
    return false
  }
}

export async function getAvatar(db: D1Database): Promise<{ bytes: Uint8Array; type: string } | null> {
  const row = await db.prepare("SELECT avatar, avatar_type FROM settings WHERE id = 1").first<{
    avatar: ArrayBuffer | Uint8Array | null
    avatar_type: string | null
  }>()
  if (!row?.avatar || !row.avatar_type) return null
  const bytes = row.avatar instanceof Uint8Array ? row.avatar : new Uint8Array(row.avatar)
  return { bytes, type: row.avatar_type }
}

export async function updateProfile(
  db: D1Database,
  patch: {
    locale: "en" | "ar"
    siteName: string
    bio: string
    links: Link[]
    avatar?: { bytes: ArrayBuffer; type: string }
    removeAvatar?: boolean
  },
): Promise<void> {
  const set = "UPDATE settings SET site_name = ?, locale = ?, bio = ?, links = ?"
  const values = [patch.siteName, patch.locale, patch.bio, JSON.stringify(patch.links)]
  if (patch.removeAvatar) {
    await db
      .prepare(`${set}, avatar = NULL, avatar_type = NULL WHERE id = 1`)
      .bind(...values)
      .run()
    return
  }
  if (patch.avatar) {
    await db
      .prepare(`${set}, avatar = ?, avatar_type = ? WHERE id = 1`)
      .bind(...values, new Uint8Array(patch.avatar.bytes), patch.avatar.type)
      .run()
    return
  }
  await db
    .prepare(`${set} WHERE id = 1`)
    .bind(...values)
    .run()
}

export type Question = {
  id: number
  public_id: string
  body: string
  asker_name: string | null
  asker_email: string | null
  is_anonymous: number
  answer: string | null
  is_public: number
  created_at: number
  answered_at: number | null
  country: string | null
}

function unixNow(): number {
  return Math.floor(Date.now() / 1000)
}

export async function insertQuestion(
  db: D1Database,
  q: {
    public_id: string
    body: string
    asker_name: string | null
    asker_email: string | null
    is_anonymous: boolean
    country: string | null
  },
): Promise<void> {
  await db
    .prepare(
      `INSERT INTO questions (public_id, body, asker_name, asker_email, is_anonymous, country, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
    )
    .bind(q.public_id, q.body, q.asker_name, q.asker_email, q.is_anonymous ? 1 : 0, q.country, unixNow())
    .run()
}

export async function listWall(db: D1Database): Promise<Question[]> {
  const { results } = await db
    .prepare(
      `SELECT * FROM questions
       WHERE answer IS NOT NULL
       ORDER BY answered_at DESC
       LIMIT 100`,
    )
    .all<Question>()
  return results ?? []
}

export async function getByPublicId(db: D1Database, publicId: string): Promise<Question | null> {
  return db.prepare("SELECT * FROM questions WHERE public_id = ?").bind(publicId).first<Question>()
}

export async function listAdmin(db: D1Database, filter: "inbox" | "answered"): Promise<Question[]> {
  const where = filter === "inbox" ? "WHERE answer IS NULL" : "WHERE answer IS NOT NULL"
  const { results } = await db
    .prepare(`SELECT * FROM questions ${where} ORDER BY created_at DESC LIMIT 200`)
    .all<Question>()
  return results ?? []
}

export async function answerQuestion(db: D1Database, publicId: string, answer: string): Promise<void> {
  const now = unixNow()
  await db
    .prepare(
      `UPDATE questions
       SET answer = ?, is_public = 1, answered_at = COALESCE(answered_at, ?)
       WHERE public_id = ?`,
    )
    .bind(answer, now, publicId)
    .run()
}

export async function deleteQuestion(db: D1Database, publicId: string): Promise<void> {
  await db.prepare("DELETE FROM questions WHERE public_id = ?").bind(publicId).run()
}

export async function stats(db: D1Database): Promise<{
  total: number
  unanswered: number
  answered: number
}> {
  const row = await db
    .prepare(
      `SELECT COUNT(*) AS total,
              COALESCE(SUM(CASE WHEN answer IS NULL THEN 1 ELSE 0 END), 0) AS unanswered,
              COALESCE(SUM(CASE WHEN answer IS NOT NULL THEN 1 ELSE 0 END), 0) AS answered
       FROM questions`,
    )
    .first<{ total: number; unanswered: number; answered: number }>()
  return {
    total: row?.total ?? 0,
    unanswered: row?.unanswered ?? 0,
    answered: row?.answered ?? 0,
  }
}
