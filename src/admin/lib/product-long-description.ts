/**
 * The product's long description, written in the rich-text editor of the "Long
 * description" box on the product page. The product's own Description box stays
 * the short text under the title; this is the formatted text of the Description
 * section further down. It lives in the product's metadata, where the
 * storefront reads it (`getLongDescription()` in its `src/lib/util/product-copy.ts`):
 *
 *   long_description  HTML from the editor, as plain text (English only), or
 *                     one text per language as JSON, the shape every translated
 *                     metadata field has (`src/utils/localized-metadata.ts`):
 *                     {"en": "<p>…</p>", "de": "…", "hu": "…"}
 *
 * Medusa applies a translation only to the product's own fields, never to its
 * metadata, so the other languages are kept next to the English text here.
 * German and Hungarian are written once, under the bare language, which the
 * storefront takes for every market of it (`de-AT`, `de-DE`); a value written
 * per market (`"de-AT": …, "de-DE": …`, as the product scripts do) is read and
 * left alone until its language is edited.
 */
export const LONG_DESCRIPTION_KEY = "long_description"

export type LongDescriptionLanguage = "en" | "de" | "hu"

/** One HTML text per language; an empty string is a language with no text. */
export type LongDescriptionForm = Record<LongDescriptionLanguage, string>

export const LONG_DESCRIPTION_LANGUAGES: {
  id: LongDescriptionLanguage
  label: string
  /** The locale the auto-translation is asked for. */
  locale: string
  /** Keys a stored text is read from, the first one that has a text winning. */
  read: string[]
  /** The key a text is saved under, after the keys it was read from are cleared. */
  write: string
}[] = [
  { id: "en", label: "English", locale: "en", read: ["en"], write: "en" },
  {
    id: "de",
    label: "German",
    locale: "de-DE",
    read: ["de-DE", "de-AT", "de"],
    write: "de",
  },
  { id: "hu", label: "Hungarian", locale: "hu-HU", read: ["hu-HU", "hu"], write: "hu" },
]

/** HTML that shows something even without a word of text. */
const VISIBLE_WITHOUT_TEXT = /<(?:img|hr|table|iframe|video)\b/i

/** An empty editor holds `<p></p>`, which is not a text. */
export const isBlankHtml = (html: string): boolean =>
  !VISIBLE_WITHOUT_TEXT.test(html) &&
  html.replace(/<[^>]*>/g, "").replace(/&nbsp;|\s/g, "") === ""

const clean = (html: unknown): string =>
  typeof html === "string" && !isBlankHtml(html) ? html.trim() : ""

const isObject = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null && !Array.isArray(value)

/**
 * The texts a stored value holds by language. A plain text is the English one;
 * JSON that was saved as text (the metadata editor keeps it so) is read.
 */
const languagesOf = (stored: unknown): Record<string, unknown> => {
  let value = stored

  if (typeof value === "string" && value.trim().startsWith("{")) {
    try {
      value = JSON.parse(value)
    } catch {
      // Not JSON after all: a text that happens to start with a brace.
    }
  }

  if (isObject(value)) {
    return { ...value }
  }

  return clean(value) ? { en: value } : {}
}

export const readLongDescription = (
  metadata?: Record<string, unknown> | null
): LongDescriptionForm => {
  const stored = languagesOf(metadata?.[LONG_DESCRIPTION_KEY])
  const form: LongDescriptionForm = { en: "", de: "", hu: "" }

  for (const language of LONG_DESCRIPTION_LANGUAGES) {
    for (const key of language.read) {
      const text = clean(stored[key])
      if (text) {
        form[language.id] = text
        break
      }
    }
  }

  return form
}

export const sameLongDescription = (
  a: LongDescriptionForm,
  b: LongDescriptionForm
): boolean =>
  LONG_DESCRIPTION_LANGUAGES.every(
    ({ id }) => clean(a[id]) === clean(b[id])
  )

/**
 * What is wrong with the texts, in words for the editor. Visitors whose
 * language has no text are shown the English one, so a product with only a
 * German text would show nothing to everybody else.
 */
export const checkLongDescription = (
  form: LongDescriptionForm
): string | null =>
  !clean(form.en) && (clean(form.de) || clean(form.hu))
    ? "Write the English text first: visitors whose language has no text of its own are shown the English one."
    : null

/** The value to store: plain HTML when English is all there is, else JSON. */
const encode = (languages: Record<string, unknown>): string => {
  const kept = Object.entries(languages).filter(
    ([, text]) => !(typeof text === "string" && !clean(text))
  )
  const order = ["en", "de", "de-AT", "de-DE", "hu", "hu-HU"]
  kept.sort(([a], [b]) => {
    const [x, y] = [order.indexOf(a), order.indexOf(b)]
    return (x === -1 ? order.length : x) - (y === -1 ? order.length : y)
  })

  if (!kept.length) {
    return ""
  }
  if (kept.length === 1 && kept[0][0] === "en" && typeof kept[0][1] === "string") {
    return kept[0][1]
  }
  return JSON.stringify(Object.fromEntries(kept))
}

/**
 * The metadata to send. Medusa merges it into the product's other metadata and
 * removes a key whose value is an empty string, which is how the long
 * description is taken away. Nothing else in the metadata is touched.
 *
 * `stored` is the value the product has now. A language whose text was not
 * changed keeps exactly the keys it had (a hand-written Austrian German beside
 * a German one stays), and a language that was changed is written again, under
 * its bare language key.
 */
export const longDescriptionMetadata = (
  stored: unknown,
  form: LongDescriptionForm
): Record<string, string> => {
  const languages = languagesOf(stored)
  const saved = readLongDescription({ [LONG_DESCRIPTION_KEY]: stored })

  for (const language of LONG_DESCRIPTION_LANGUAGES) {
    const text = clean(form[language.id])

    if (text === saved[language.id]) {
      continue
    }

    for (const key of language.read) {
      delete languages[key]
    }
    if (text) {
      languages[language.write] = text
    }
  }

  return { [LONG_DESCRIPTION_KEY]: encode(languages) }
}
