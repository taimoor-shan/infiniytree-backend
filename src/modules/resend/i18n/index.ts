import en from "./dictionaries/en.json"
import deAT from "./dictionaries/de-AT.json"
import deDE from "./dictionaries/de-DE.json"
import huHU from "./dictionaries/hu-HU.json"

type Dictionary = Record<string, string>

const dictionaries: Record<string, Dictionary> = {
  en,
  "de-AT": deAT,
  "de-DE": deDE,
  "hu-HU": huHU,
}

/**
 * Resolve a dictionary for the given locale.
 * Fallback chain: exact match → language-only → English.
 */
export const getEmailDictionary = (locale?: string | null): Dictionary => {
  const raw = locale || "en"
  if (dictionaries[raw]) return dictionaries[raw]
  const lang = raw.split("-")[0]
  if (dictionaries[lang]) return dictionaries[lang]
  return dictionaries["en"]
}

/**
 * Resolve a raw locale string to a canonical locale code that
 * `Intl.NumberFormat` / `toLocaleDateString` can consume.
 */
export const resolveLocale = (locale?: string | null): string => {
  const dict = getEmailDictionary(locale)
  return (
    Object.entries(dictionaries).find(([, d]) => d === dict)?.[0] ?? "en"
  )
}

/**
 * Translate a dot-namespaced key for the given locale, optionally
 * interpolating `{placeholder}` tokens with the provided params.
 */
export const translate = (
  key: string,
  locale?: string | null,
  params?: Record<string, string | number>
): string => {
  const dict = getEmailDictionary(locale)
  let value = dict[key] ?? key
  if (params) {
    for (const [k, v] of Object.entries(params)) {
      value = value.replaceAll(`{${k}}`, String(v))
    }
  }
  return value
}

/**
 * Factory that creates a translator function bound to a specific locale.
 * Usage in templates: `const t = createTranslator(locale)`
 */
export const createTranslator =
  (locale?: string | null) =>
  (key: string, params?: Record<string, string | number>) =>
    translate(key, locale, params)
