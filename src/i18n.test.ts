import assert from "node:assert/strict"
import { test } from "node:test"
import { isRtlText, parseLocale, t } from "./i18n.ts"

test("parseLocale", () => {
  assert.equal(parseLocale("ar"), "ar")
  assert.equal(parseLocale("en"), "en")
  assert.equal(parseLocale("fr"), "en")
})

test("isRtlText detects Arabic", () => {
  assert.equal(isRtlText("Hello"), false)
  assert.equal(isRtlText("ما الذي تبنيه؟"), true)
  assert.equal(isRtlText("Hello مرحبا"), true)
})

test("arabic strings exist", () => {
  assert.equal(t("ar", "sendQuestion"), "أرسل السؤال")
  assert.equal(t("en", "sendQuestion"), "Send question")
})
