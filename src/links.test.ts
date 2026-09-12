import assert from "node:assert/strict"
import { test } from "node:test"
import { parseLinks, readLinksFromForm, safeHttpUrl } from "./links.ts"

test("safeHttpUrl accepts http(s) and fills https", () => {
  assert.equal(safeHttpUrl("https://x.com/asky"), "https://x.com/asky")
  assert.equal(safeHttpUrl("example.com"), "https://example.com/")
  assert.equal(safeHttpUrl("javascript:alert(1)"), null)
  assert.equal(safeHttpUrl(""), null)
})

test("parseLinks keeps titled http links only", () => {
  assert.deepEqual(parseLinks(`[{"title":"X","url":"https://x.com/a"},{"title":"","url":"https://x.com"}]`), [
    { title: "X", url: "https://x.com/a" },
  ])
  assert.deepEqual(parseLinks("not-json"), [])
})

test("readLinksFromForm pairs title and url fields", () => {
  const form = new FormData()
  form.append("link_title", "Site")
  form.append("link_url", "https://asky.example")
  form.append("link_title", "")
  form.append("link_url", "https://ignored.example")
  assert.deepEqual(readLinksFromForm(form), [{ title: "Site", url: "https://asky.example/" }])
})
