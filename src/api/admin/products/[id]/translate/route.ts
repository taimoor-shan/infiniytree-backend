import {
  AuthenticatedMedusaRequest,
  MedusaResponse,
} from "@medusajs/framework/http"
import { Modules } from "@medusajs/framework/utils"
import { ITranslationModuleService } from "@medusajs/types"
import { translateProductWorkflow } from "../../../../../workflows/translate-product"

/**
 * Fetch all configured locale codes from Medusa's translation module.
 */
async function getMedusaLocales(container: any): Promise<string[]> {
  try {
    const translationService: ITranslationModuleService =
      container.resolve(Modules.TRANSLATION)
    const locales = await translationService.listLocales()
    return locales
      .map((l: any) => l.locale_code || l.code)
      .filter(Boolean)
  } catch {
    return []
  }
}

/**
 * Map a short locale code to its full Medusa locale code.
 *
 *   "hu"    → "hu-HU"   (prefers country matching language: HU)
 *   "de"    → "de-DE"   (prefers DE over CH/AT)
 *   "de-AT" → "de-AT"   (already full — exact match)
 *   "xyz"   → "xyz"     (no match — passed through as-is)
 */
function resolveFullLocale(shortCode: string, medusaLocales: string[]): string {
  // 1. Exact match (e.g. "de-AT")
  if (medusaLocales.includes(shortCode)) {
    return shortCode
  }

  // 2. Prefer the "canonical" country: "de" → "de-DE", "hu" → "hu-HU"
  const canonicalSuffix = "-" + shortCode.toUpperCase()
  const canonical = shortCode + canonicalSuffix
  if (medusaLocales.includes(canonical)) {
    return canonical
  }

  // 3. Prefix match fallback (e.g. "en" → "en-US" if no "en-EN" exists)
  const prefix = shortCode + "-"
  const match = medusaLocales.find((l) => l.startsWith(prefix))
  if (match) {
    return match
  }

  // 4. No match — return as-is
  return shortCode
}

/**
 * Resolve target locales:
 *  1. If AUTO_TRANSLATE_LOCALES is set, map each code to full Medusa locale code.
 *  2. Otherwise, auto-detect all locales from Medusa's translation module.
 */
async function resolveTargetLocales(container: any): Promise<string[]> {
  const medusaLocales = await getMedusaLocales(container)

  const envLocales = process.env.AUTO_TRANSLATE_LOCALES
  if (envLocales) {
    const raw = envLocales.split(",").map((l) => l.trim()).filter(Boolean)
    return raw.map((code) => resolveFullLocale(code, medusaLocales))
  }

  // No env var — use all Medusa locales
  return medusaLocales
}

export async function POST(
  req: AuthenticatedMedusaRequest,
  res: MedusaResponse
) {
  const { id } = req.params
  const logger = req.scope.resolve("logger")

  const localesToTranslate = await resolveTargetLocales(req.scope)

  if (localesToTranslate.length === 0) {
    res.status(400).json({
      message:
        "No target locales found. Either set AUTO_TRANSLATE_LOCALES in .env " +
        "(e.g. AUTO_TRANSLATE_LOCALES=hu,de) or configure locales in the " +
        "Medusa Translation module (Settings → Translations).",
    })
    return
  }

  logger.info(
    `[translate-route] Translating product ${id} to: ${localesToTranslate.join(", ")}`
  )

  const startTime = Date.now()
  const completed: string[] = []
  const failed: { locale: string; reason: string }[] = []

  for (const locale of localesToTranslate) {
    try {
      logger.info(`[translate-route] Starting translation to "${locale}"...`)
      await translateProductWorkflow(req.scope).run({
        input: {
          product_id: id,
          target_locale: locale,
        },
      })
      completed.push(locale)
      logger.info(`[translate-route] Completed translation to "${locale}"`)
    } catch (err: any) {
      logger.error(
        `[translate-route] Failed translating to "${locale}": ${err.message}`
      )
      failed.push({ locale, reason: err.message })
    }
  }

  const durationMs = Date.now() - startTime

  logger.info(
    `[translate-route] Done. Completed: [${completed.join(", ")}], ` +
    `Failed: [${failed.map((f) => f.locale).join(", ")}], ` +
    `Duration: ${durationMs}ms`
  )

  res.status(200).json({
    completed,
    failed,
    duration_ms: durationMs,
  })
}
