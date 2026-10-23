import { Modules } from "@medusajs/framework/utils"
import { languageOf } from "./locale"

/**
 * Which languages content is translated into.
 *
 * Mirrors the product translation route (`/admin/products/:id/translate`):
 * `AUTO_TRANSLATE_LOCALES` (for example `hu,de`) names them, each short code
 * resolved to a full Medusa locale (`hu` to `hu-HU`); without it, the languages
 * the store offers are used. The content's own language is never a target.
 */

type Container = { resolve: (key: string) => any }

/** Every locale code the Translation module knows. */
export async function knownLocaleCodes(container: Container): Promise<string[]> {
  try {
    const service = container.resolve(Modules.TRANSLATION)
    const locales = await service.listLocales({}, { take: 1000 })

    return locales.map((locale: { code: string }) => locale.code).filter(Boolean)
  } catch {
    return []
  }
}

/**
 * A short code as the full Medusa locale:
 *
 *   "de-AT" → "de-AT"   (already full)
 *   "hu"    → "hu-HU"   (the language's own country)
 *   "de"    → "de-DE"
 *   "en"    → "en-US"   (first variant, when there is no "en-EN")
 *   "xyz"   → "xyz"     (unknown, passed through)
 */
export function resolveFullLocale(shortCode: string, known: string[]): string {
  if (known.includes(shortCode)) {
    return shortCode
  }

  const canonical = `${shortCode}-${shortCode.toUpperCase()}`

  if (known.includes(canonical)) {
    return canonical
  }

  return known.find((code) => code.startsWith(`${shortCode}-`)) ?? shortCode
}

async function storeLocaleCodes(container: Container): Promise<string[]> {
  try {
    const service = container.resolve(Modules.STORE)
    const [store] = await service.listStores(
      {},
      { relations: ["supported_locales"], take: 1 }
    )

    return (store?.supported_locales ?? [])
      .map((locale: { locale_code: string }) => locale.locale_code)
      .filter(Boolean)
  } catch {
    return []
  }
}

/** The locales content written in `sourceLocale` should be translated into. */
export async function resolveTargetLocales(
  container: Container,
  sourceLocale: string
): Promise<string[]> {
  const env = process.env.AUTO_TRANSLATE_LOCALES
  let configured: string[]

  if (env) {
    const known = await knownLocaleCodes(container)

    configured = env
      .split(",")
      .map((code) => code.trim())
      .filter(Boolean)
      .map((code) => resolveFullLocale(code, known))
  } else {
    configured = await storeLocaleCodes(container)
  }

  return Array.from(new Set(configured)).filter(
    (code) => languageOf(code) !== languageOf(sourceLocale)
  )
}

/**
 * Locales grouped by language, so a language is translated once and the result
 * saved for each of its variants: `de-AT` and `de-DE` share one translation.
 */
export function groupByLanguage(locales: string[]): string[][] {
  const groups = new Map<string, string[]>()

  for (const locale of locales) {
    const language = languageOf(locale)
    const group = groups.get(language)

    if (group) {
      group.push(locale)
    } else {
      groups.set(language, [locale])
    }
  }

  return Array.from(groups.values())
}

/** Whether auto-translation is set up, and with what, for the admin to show. */
export function providerStatus(): { name: string | null; configured: boolean } {
  const name = process.env.TRANSLATION_PROVIDER || null

  if (!name) {
    return { name, configured: false }
  }

  if (name === "gemini") {
    return { name, configured: !!process.env.GEMINI_API_KEY }
  }

  if (name === "libretranslate") {
    return { name, configured: !!process.env.LIBRETRANSLATE_URL }
  }

  return { name, configured: true }
}
