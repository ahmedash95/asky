const MAX = 512 * 1024
const TYPES = new Set(["image/jpeg", "image/png", "image/webp", "image/gif"])

export type AvatarFile = { bytes: ArrayBuffer; type: string }

export async function readAvatar(form: FormData): Promise<AvatarFile | null | "invalid"> {
  const file = form.get("avatar")
  if (!(file instanceof File) || file.size === 0) return null
  if (file.size > MAX || !TYPES.has(file.type)) return "invalid"
  return { bytes: await file.arrayBuffer(), type: file.type }
}
