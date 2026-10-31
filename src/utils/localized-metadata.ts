/**
 * Product metadata written once per language, the way the storefront reads it
 * (`getLocalizedMetadata()` in `src/lib/i18n/metadata.ts` there): a text is
 * stored as
 *
 *   {"en": "…", "de-AT": "…", "de-DE": "…", "hu-HU": "…"}
 *
 * and a list of texts, such as `key_features`, as a list of those. The admin's
 * metadata editor keeps such values as JSON text, so that is what these
 * functions return.
 *
 * They only ever add. A language the value already has is kept, and a value
 * whose English is not the English being translated is left alone, so a text
 * edited in the admin is never paired with the translation of its old wording.
 */

/** One text in several languages; `en` is the one the others translate. */
export type Texts = { en: string } & Record<string, string>

const isObject = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null && !Array.isArray(value)

const hasText = (value: unknown): value is string =>
  typeof value === "string" && value.trim() !== ""

/** A JSON object or list stored as text is read; any other value is returned as it is. */
const parse = (value: unknown): unknown => {
  if (typeof value !== "string") {
    return value
  }

  const trimmed = value.trim()
  if (!trimmed.startsWith("{") && !trimmed.startsWith("[")) {
    return value
  }

  try {
    return JSON.parse(trimmed)
  } catch {
    return value
  }
}

/** The text of every language a stored value has, or null when it is not a text. */
function languagesOf(stored: unknown): Record<string, unknown> | null {
  const value = parse(stored)

  if (isObject(value)) {
    return { ...value }
  }

  // A plain text is the English one.
  return hasText(value) ? { en: value } : null
}

function withLanguages(
  stored: unknown,
  texts: Texts
): Record<string, unknown> | null {
  const languages = languagesOf(stored)

  if (
    !languages ||
    !hasText(languages.en) ||
    languages.en.trim() !== texts.en.trim()
  ) {
    return null
  }

  let added = false
  for (const [language, text] of Object.entries(texts)) {
    if (!hasText(languages[language])) {
      languages[language] = text
      added = true
    }
  }

  return added ? languages : null
}

/**
 * A text with the languages in `texts` added: `"Maintenance-free"` or
 * `{"en": "Maintenance-free"}` becomes `{"en": …, "de-DE": …}`. Returns the
 * JSON to store, or null when there is nothing to add.
 */
export function addLanguages(stored: unknown, texts: Texts): string | null {
  const languages = withLanguages(stored, texts)

  return languages ? JSON.stringify(languages) : null
}

/**
 * A list of texts with the languages added to each one, found by its English
 * (so a list that was reordered, or has other entries, is still matched).
 * Returns the JSON to store, or null when no entry got anything.
 */
export function addLanguagesToList(
  stored: unknown,
  items: Texts[]
): string | null {
  const list = parse(stored)
  if (!Array.isArray(list)) {
    return null
  }

  let changed = false
  const next = list.map((entry) => {
    const english = languagesOf(entry)?.en
    const texts = hasText(english)
      ? items.find((item) => item.en.trim() === english.trim())
      : undefined
    const languages = texts ? withLanguages(entry, texts) : null

    if (!languages) {
      return entry
    }
    changed = true
    return languages
  })

  return changed ? JSON.stringify(next) : null
}
