/**
 * Translation Provider Index
 *
 * Exports:
 * - TranslationService  — public API for workflow steps
 * - createProvider       — factory (internal, exported for testing)
 *
 * Usage from a workflow step:
 *   const service = new TranslationService()
 *   const { translations, durationMs } = await service.translate(fields, "en", "de", logger)
 */

import type { TranslationProvider } from "./provider"
import { GoogleScraperProvider } from "./google-scraper"
import { LibreTranslateProvider } from "./libretranslate"
import { GeminiProvider } from "./gemini"

// ── Factory (internal) ──────────────────────────────────────────

export function createProvider(name: string): TranslationProvider {
  switch (name) {
    case "gemini":
      return new GeminiProvider()
    case "libretranslate":
      return new LibreTranslateProvider()
    case "google-scraper":
      return new GoogleScraperProvider()
    default:
      throw new Error(
        `Unknown translation provider: "${name}". ` +
        `Set TRANSLATION_PROVIDER to one of: gemini, libretranslate, google-scraper`
      )
  }
}

// ── Service (public) ────────────────────────────────────────────

export class TranslationService {
  private provider: TranslationProvider

  constructor() {
    const name = process.env.TRANSLATION_PROVIDER
    if (!name) {
      throw new Error(
        "TRANSLATION_PROVIDER is not set. " +
        "Set it to one of: gemini, libretranslate, google-scraper"
      )
    }
    this.provider = createProvider(name)
  }

  /**
   * Translate fields from sourceLocale to targetLocale.
   *
   * @param fields       - Array of { key, text } to translate
   * @param sourceLocale - Source language, e.g. "en"
   * @param targetLocale - Target language, e.g. "de" or "de-AT"
   * @param logger       - Optional Medusa logger for structured output
   * @returns Translated fields + timing info
   */
  async translate(
    fields: import("./provider").TranslatableField[],
    sourceLocale: string,
    targetLocale: string,
    logger?: any
  ): Promise<{ translations: Record<string, string>; durationMs: number }> {
    const start = Date.now()
    const translations = await this.provider.translate(fields, sourceLocale, targetLocale)
    const durationMs = Date.now() - start

    logger?.info?.(`Translated ${fields.length} fields`, {
      locale: targetLocale,
      provider: process.env.TRANSLATION_PROVIDER,
      duration_ms: durationMs,
    })

    return { translations, durationMs }
  }
}
