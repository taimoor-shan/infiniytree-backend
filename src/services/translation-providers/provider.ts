/**
 * Translation Provider Interface
 *
 * All translation providers implement this single-method interface.
 * Providers are thin — they only translate. Cross-cutting concerns
 * (selection, timing, logging, retries) live in TranslationService.
 */

export type TranslatableField = {
  /** Field key, e.g. "title", "description", "metadata.care_instructions" */
  key: string
  /** The text content to translate */
  text: string
}

export interface TranslationProvider {
  /**
   * Translate an array of fields from sourceLocale to targetLocale.
   *
   * @param fields  - Array of { key, text } pairs to translate
   * @param sourceLocale - Source language code, e.g. "en"
   * @param targetLocale - Target language code, e.g. "de" or "de-AT"
   * @returns Record mapping field keys to translated text
   */
  translate(
    fields: TranslatableField[],
    sourceLocale: string,
    targetLocale: string
  ): Promise<Record<string, string>>
}
