import assert from "node:assert/strict"
import { test } from "node:test"
import { checkOrigin, escapeHtml, hashPassword, normalizeAdminPath, timingSafeEqual, verifyPassword } from "./security.ts"

test("escapeHtml encodes & < > \" '", () => {
  assert.equal(escapeHtml(`&<>"'`), "&amp;&lt;&gt;&quot;&#39;")
})

test("timingSafeEqual matches equal strings", () => {
  assert.equal(timingSafeEqual("abc", "abc"), true)
  assert.equal(timingSafeEqual("abc", "abd"), false)
  assert.equal(timingSafeEqual("abc", "ab"), false)
})

test("checkOrigin allows same-host Origin POST", () => {
  const req = new Request("https://example.com/ask", {
    method: "POST",
    headers: { Origin: "https://example.com" },
  })
  assert.equal(checkOrigin(req), true)
})

test("checkOrigin denies cross-site POST", () => {
  const req = new Request("https://example.com/ask", {
    method: "POST",
    headers: { Origin: "https://evil.test" },
  })
  assert.equal(checkOrigin(req), false)
})

test("checkOrigin allows missing Origin on GET", () => {
  assert.equal(checkOrigin(new Request("https://example.com/")), true)
})

test("checkOrigin allows same-origin Sec-Fetch-Site without Origin", () => {
  const req = new Request("https://example.com/ask", {
    method: "POST",
    headers: { "Sec-Fetch-Site": "same-origin" },
  })
  assert.equal(checkOrigin(req), true)
})

test("normalizeAdminPath accepts a hidden path", () => {
  assert.equal(normalizeAdminPath("orange-notebook"), "/orange-notebook")
  assert.equal(normalizeAdminPath("/ask"), null)
  assert.equal(normalizeAdminPath("/"), null)
})

test("hashPassword verifies", async () => {
  const stored = await hashPassword("correct horse")
  assert.equal(await verifyPassword("correct horse", stored), true)
  assert.equal(await verifyPassword("wrong", stored), false)
})
