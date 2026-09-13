import type { Locale } from "./i18n";

/** Cloudflare sends these instead of a country for Tor, anonymous proxies and unknowns. */
const notACountry = new Set(["XX", "T1", "A1", "A2", "O1", "AP"]);

export function countryCode(raw: string | null): string | null {
  const code = (raw ?? "").trim().toUpperCase();
  return /^[A-Z]{2}$/.test(code) ? code : null;
}

export function countryName(code: string, locale: Locale): string {
  try {
    return new Intl.DisplayNames([locale], { type: "region" }).of(code) ?? code;
  } catch {
    return code;
  }
}

/** flagcdn.com serves plain PNGs by ISO code, no key and no script. */
export function flagUrl(code: string, width: 20 | 40): string | null {
  if (notACountry.has(code)) return null;
  return `https://flagcdn.com/w${width}/${code.toLowerCase()}.png`;
}
