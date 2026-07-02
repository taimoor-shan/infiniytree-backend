/**
 * LibreTranslateProvider
 *
 * Uses the LibreTranslate REST API (no SDK needed).
 * Configure via .env:
 *   LIBRETRANSLATE_URL=https://libretranslate.com
 *   LIBRETRANSLATE_API_KEY=your-key-here
 *
 * Translates fields sequentially — LibreTranslate's /translate
 * endpoint handles one text at a time.
 */

import type { TranslationProvider, TranslatableField } from "./provider"
import { normalizeLocale } from "./normalize-locale"

export class LibreTranslateProvider implements TranslationProvider {
  private readonly baseUrl: string
  private readonly apiKey: string

  constructor() {
    this.baseUrl = process.env.LIBRETRANSLATE_URL || "https://libretranslate.com"
    this.apiKey = process.env.LIBRETRANSLATE_API_KEY || ""

    if (!this.apiKey) {
      console.warn(
        "[libretranslate] LIBRETRANSLATE_API_KEY is not set. " +
        "Requests may be rate-limited or rejected."
      )
    }
  }

  async translate(
    fields: TranslatableField[],
    sourceLocale: string,
    targetLocale: string
  ): Promise<Record<string, string>> {
    const from = normalizeLocale(sourceLocale || "en")
    const to = normalizeLocale(targetLocale)

    const translations: Record<string, string> = {}

    for (const field of fields) {
      if (!field.text) continue

      try {
        const body: Record<string, unknown> = {
          q: field.text,
          source: from,
          target: to,
          format: "html",
        }

        if (this.apiKey) {
          body.api_key = this.apiKey
        }

        const response = await fetch(`${this.baseUrl}/translate`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(body),
        })

        if (!response.ok) {
          const errorText = await response.text()
          throw new Error(`HTTP ${response.status}: ${errorText}`)
        }

        const data = (await response.json()) as { translatedText?: string }
        if (data.translatedText) {
          translations[field.key] = data.translatedText
        }
      } catch (e: any) {
        console.error(
          `[libretranslate] Error translating field "${field.key}": ${e.message}`
        )
      }
    }

    return translations
  }
}
