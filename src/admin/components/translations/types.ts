/** What `GET /admin/content-translations/:reference/:id` returns. */

export type ContentReference = "page" | "blog_post" | "blog_category"

export type ContentField = {
  key: string
  label: string
  /** `html` is edited with the rich-text editor. */
  kind: "text" | "textarea" | "html"
}

export type TranslationState = {
  reference: ContentReference
  id: string
  /** The original: the language it is written in and its text. */
  source: { locale: string; values: Record<string, string> }
  fields: ContentField[]
  /** The languages to translate into (from AUTO_TRANSLATE_LOCALES). */
  target_locales: string[]
  translations: Record<
    string,
    { id: string; values: Record<string, string>; updated_at: string }
  >
  /**
   * Pages written before translations existed are one record per language
   * with the same slug. One in a visitor's language is shown instead of a
   * translation.
   */
  native_versions: { id: string; locale: string; status: string }[]
  provider: { name: string | null; configured: boolean }
}

export type TranslateResult = {
  completed: string[]
  failed: { locale: string; reason: string }[]
  duration_ms: number
}

export const TRANSLATION_QUERY_KEY = "content-translations"

/** How many of the original's fields a language has a translation for. */
export const translatedFieldCount = (
  state: TranslationState,
  locale: string
): number =>
  state.fields.filter(
    (field) =>
      !!state.source.values[field.key]?.trim() &&
      !!state.translations[locale]?.values[field.key]?.trim()
  ).length

/** How many of the original's fields have text, so can be translated. */
export const translatableFieldCount = (state: TranslationState): number =>
  state.fields.filter((field) => !!state.source.values[field.key]?.trim()).length
