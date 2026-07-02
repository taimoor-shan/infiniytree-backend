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
    const translationService: ITranslationModuleService = container.resolve(Modules.TRANSLATION)
    
    if (!translationService) {
      throw new Error("Translation module not enabled")
    }
    
    if (Object.keys(input.translations).length === 0) {
      return new StepResponse(null)
    }

    // Check if translation already exists for this resource and locale
    const existing = await translationService.listTranslations({
      reference_id: input.productId,
      reference: "product",
      locale_code: input.locale
    })

    let saved;

    if (existing && existing.length > 0) {
      const translation = existing[0]
      // Merge existing translations with new ones
      const mergedData = {
        ...translation.translations,
        ...input.translations
      }
      
      saved = await translationService.updateTranslations({
        id: translation.id,
        translations: mergedData
      })
    } else {
      saved = await translationService.createTranslations({
        reference_id: input.productId,
        reference: "product",
        locale_code: input.locale,
        translations: input.translations as any
      })
    }

    return new StepResponse(saved)
  }
)
