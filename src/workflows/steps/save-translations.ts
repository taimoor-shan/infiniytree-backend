import { createStep, StepResponse } from "@medusajs/framework/workflows-sdk"
import { Modules } from "@medusajs/framework/utils"
import { ITranslationModuleService } from "@medusajs/types"

export type SaveTranslationsInput = {
  productId: string
  translations: Record<string, string>
  locale: string
}

export const saveTranslationsStep = createStep(
  "save-translations",
  async (input: SaveTranslationsInput, { container }) => {
    const logger = container.resolve("logger")
    const translationService: ITranslationModuleService = container.resolve(Modules.TRANSLATION)

    if (!translationService) {
      throw new Error("Translation module not enabled")
    }

    if (Object.keys(input.translations).length === 0) {
      logger.warn(`[save-translations] No translations to save for locale "${input.locale}"`)
      return new StepResponse(null)
    }

    logger.info(
      `[save-translations] Saving ${Object.keys(input.translations).length} fields ` +
      `for product ${input.productId} to locale "${input.locale}"`
    )
    logger.debug(
      `[save-translations] Keys: ${Object.keys(input.translations).join(", ")}`
    )

    // Check if translation already exists for this resource and locale
    const existing = await translationService.listTranslations({
      reference_id: input.productId,
      reference: "product",
      locale_code: input.locale,
    })

    let saved

    if (existing && existing.length > 0) {
      const translation = existing[0]
      logger.info(
        `[save-translations] Updating existing translation ${translation.id} ` +
        `for locale "${input.locale}"`
      )

      // Merge existing translations with new ones (new keys take precedence)
      const mergedData = {
        ...(translation.translations || {}),
        ...input.translations,
      }

      saved = await translationService.updateTranslations({
        id: translation.id,
        translations: mergedData,
      })

      logger.info(
        `[save-translations] Updated translation ${translation.id} ` +
        `(${Object.keys(mergedData).length} total fields)`
      )
    } else {
      logger.info(
        `[save-translations] Creating new translation for locale "${input.locale}"`
      )

      saved = await translationService.createTranslations({
        reference_id: input.productId,
        reference: "product",
        locale_code: input.locale,
        translations: input.translations as any,
      })

      logger.info(
        `[save-translations] Created translation for locale "${input.locale}"`
      )
    }

    return new StepResponse(saved)
  }
)
