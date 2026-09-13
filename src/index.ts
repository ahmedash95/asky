import { handleAdmin, isAdminPath } from "./admin"
import { getAvatar, getSettings } from "./db"
import { handleOg } from "./og"
import { handlePublic } from "./public"
import { handleSetup } from "./setup"

function withSecurityHeaders(response: Response): Response {
  const headers = new Headers(response.headers)
  headers.set("Referrer-Policy", "no-referrer")
  headers.set("X-Content-Type-Options", "nosniff")
  return new Response(response.body, {
    status: response.status,
    statusText: response.statusText,
    headers,
  })
}

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const settings = await getSettings(env.DB)
    const { pathname } = new URL(request.url)

    if (pathname === "/avatar") {
      if (!settings?.has_avatar) return new Response("Not found", { status: 404 })
      const file = await getAvatar(env.DB)
      if (!file) return new Response("Not found", { status: 404 })
      return withSecurityHeaders(
        new Response(file.bytes, {
          headers: {
            "Content-Type": file.type,
            "Cache-Control": "private, max-age=60",
          },
        }),
      )
    }

    if (!settings) return withSecurityHeaders(await handleSetup(request, env))

    const og = pathname.match(/^\/q\/([^/]+)\/og\.png$/)
    if (og) {
      return withSecurityHeaders(await handleOg(request, env, og[1], settings))
    }

    if (isAdminPath(pathname, settings.admin_path)) {
      return withSecurityHeaders(await handleAdmin(request, env, settings))
    }

    return withSecurityHeaders(await handlePublic(request, env, settings))
  },
}
