interface Env {
  DB: D1Database
  SITE_NAME: string
  SITE_TAGLINE: string
  ADMIN_PATH?: string
  TURNSTILE_SITE_KEY?: string
  TURNSTILE_SECRET_KEY?: string
  WEB_ANALYTICS_TOKEN?: string
}
