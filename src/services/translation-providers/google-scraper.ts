/**
 * GoogleScraperProvider
 *
 * Wraps the existing google-translate-api-x scraper behind the
 * TranslationProvider interface. This is the migration safety net —
 * deploy with TRANSLATION_PROVIDER=google-scraper to verify the
 * refactored pipeline works, then switch to Gemini or LibreTranslate.
 *
 * @deprecated Use GeminiProvider or LibreTranslateProvider.
 *             This is an unofficial Google Translate web scraper
 *             and may break at any time.
 */

import type { TranslationProvider, TranslatableField } from "./provider"
import { normalizeLocale } from "./normalize-locale"
import translate from "google-translate-api-x"

export class GoogleScraperProvider implements TranslationProvider {
  async translate(
    fields: TranslatableField[],
    sourceLocale: string,
    targetLocale: string
  ): Promise<Record<string, string>> {
    const from = normalizeLocale(sourceLocale || "en")
    const to = normalizeLocale(targetLocale)

    const translations: Record<string, string> = {}

    // Process sequentially to avoid overwhelming the scraper
    for (const field of fields) {
      if (!field.text) continue

      try {
        const res = await translate(field.text, {
          from,
          to,
          forceBatch: false,
        })

        if (res && res.text) {
          translations[field.key] = res.text
        }
      } catch (e: any) {
        // Log and continue — a single field failure shouldn't block
        // the rest. The caller (TranslationService/API route) handles
        // empty translations appropriately.
        console.error(
          `[google-scraper] Error translating field "${field.key}": ${e.message}`
        )
      }
    }

    return translations
  }
}
