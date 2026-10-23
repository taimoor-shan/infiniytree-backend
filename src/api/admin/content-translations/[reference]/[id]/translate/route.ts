import { MedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { MedusaError } from "@medusajs/framework/utils"
import { revalidateStorefrontCache } from "../../../../../../utils/revalidate-cache"
import { requireContentType } from "../../../../../../utils/translations/content-types"
import { languageOf } from "../../../../../../utils/translations/locale"
import {
  groupByLanguage,
  knownLocaleCodes,
  providerStatus,
  resolveTargetLocales,
} from "../../../../../../utils/translations/targets"
import translateContentWorkflow from "../../../../../../workflows/translate-content"
import { TranslateContentSchema } from "../../../middlewares"

/**
 * `POST /admin/content-translations/:reference/:id/translate`
 *
 * Auto-translates a page, post or category with the configured provider
 * (`TRANSLATION_PROVIDER`), the way "Translate Product" does for products.
 * Body (all optional): `locales` to translate into (default: the configured
 * languages) and `overwrite` to redo fields that already have a translation
 * (default: only missing ones are translated, so a proofread translation
 * survives an edit of the original).
 *
 * A language is translated once and saved for each of its variants (`de-AT`
 * and `de-DE`). Languages run side by side; one failing does not stop the rest.
 */
export async function POST(
  req: MedusaRequest<TranslateContentSchema>,
  res: MedusaResponse
) {
  const type = requireContentType(req.params.reference)
  const { id } = req.params
  const logger = req.scope.resolve("logger")

  const record = await type.retrieve(req.scope, id)
  const sourceLocale: string = record.locale || "en"

  const status = providerStatus()

  if (!status.configured) {
    throw new MedusaError(
      MedusaError.Types.NOT_ALLOWED,
      "Auto-translation is not set up. Set TRANSLATION_PROVIDER (gemini, " +
        "libretranslate or google-scraper, plus its key) in the backend .env."
    )
  }

  const requested = req.validatedBody.locales
  let locales: string[]

  if (requested?.length) {
    const known = await knownLocaleCodes(req.scope)
    const unknown = requested.filter((code) => known.length && !known.includes(code))

    if (unknown.length) {
      throw new MedusaError(
        MedusaError.Types.INVALID_DATA,
        `Unknown locale: ${unknown.join(", ")}`
      )
    }

    locales = requested.filter(
      (code) => languageOf(code) !== languageOf(sourceLocale)
    )
  } else {
    locales = await resolveTargetLocales(req.scope, sourceLocale)
  }

  if (!locales.length) {
    throw new MedusaError(
      MedusaError.Types.INVALID_DATA,
      "No language to translate into. Set AUTO_TRANSLATE_LOCALES in the " +
        "backend .env (for example hu,de), or add languages to the store."
    )
  }

  const startedAt = Date.now()
  const completed: string[] = []
  const failed: { locale: string; reason: string }[] = []

  logger.info(
    `[translate-content] ${type.reference} ${id} (${sourceLocale}) to: ${locales.join(", ")}`
  )

  await Promise.all(
    groupByLanguage(locales).map(async (group) => {
      try {
        await translateContentWorkflow(req.scope).run({
          input: {
            reference: type.reference,
            id,
            locales: group,
            overwrite: !!req.validatedBody.overwrite,
          },
        })

        completed.push(...group)
      } catch (error: any) {
        logger.error(
          `[translate-content] ${group.join(", ")} failed: ${error?.message}`
        )
        failed.push(
          ...group.map((locale) => ({ locale, reason: error?.message ?? "Failed" }))
        )
      }
    })
  )

  if (completed.length) {
    await revalidateStorefrontCache(type.cacheTags, logger)
  }

  return res.status(200).json({
    completed: completed.sort(),
    failed,
    duration_ms: Date.now() - startedAt,
  })
}
