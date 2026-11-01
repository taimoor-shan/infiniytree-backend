import { MedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { MedusaError } from "@medusajs/framework/utils"
import { TranslationService } from "../../../../../services/translation-providers"
import {
  groupByLanguage,
  providerStatus,
} from "../../../../../utils/translations/targets"
import { translateHtml } from "../../../../../utils/translations/translate-html"
import { TranslateLongDescriptionSchema } from "../../middlewares"

/**
 * `POST /admin/products/:id/translate-long-description`
 *
 * Translates the English HTML in the body (the editor's current text, saved or
 * not) into the given languages with the configured provider
 * (`TRANSLATION_PROVIDER`, the one "Translate Product" uses) and answers with
 * the HTML of each, for the editor to show and the person to read before saving.
 * Nothing is saved here: the long description lives in the product's metadata,
 * which Medusa never lays a translation over (see the "Long description" box,
 * `src/admin/widgets/product-long-description-widget.tsx`).
 *
 * A language is translated once and given to each of its variants (`de-AT`
 * and `de-DE`). Languages run side by side; one failing does not stop the rest.
 */
export async function POST(
  req: MedusaRequest<TranslateLongDescriptionSchema>,
  res: MedusaResponse
) {
  const logger = req.scope.resolve("logger")

  if (!providerStatus().configured) {
    throw new MedusaError(
      MedusaError.Types.NOT_ALLOWED,
      "Auto-translation is not set up. Set TRANSLATION_PROVIDER (gemini, " +
        "libretranslate or google-scraper, plus its key) in the backend .env."
    )
  }

  const { html, locales } = req.validatedBody
  const service = new TranslationService()
  const translations: Record<string, string> = {}
  const failed: { locale: string; reason: string }[] = []

  logger.info(
    `[translate-long-description] product ${req.params.id}: ${html.length} ` +
      `characters to ${locales.join(", ")}`
  )

  await Promise.all(
    groupByLanguage(locales).map(async (group) => {
      try {
        const translated = await translateHtml(html, async (fields) => {
          const { translations: answered } = await service.translate(
            fields,
            "en",
            group[0],
            logger
          )
          return answered
        })

        for (const locale of group) {
          translations[locale] = translated
        }
      } catch (error: any) {
        logger.error(
          `[translate-long-description] ${group.join(", ")} failed: ${error?.message}`
        )
        failed.push(
          ...group.map((locale) => ({
            locale,
            reason: error?.message ?? "Failed",
          }))
        )
      }
    })
  )

  return res.status(200).json({ translations, failed })
}
