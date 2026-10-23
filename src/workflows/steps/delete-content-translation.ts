import { createStep, StepResponse } from "@medusajs/framework/workflows-sdk"
import { Modules } from "@medusajs/framework/utils"
import { ITranslationModuleService } from "@medusajs/types"
import { ContentReference } from "../../utils/translations/content-types"

export type DeleteContentTranslationInput = {
  reference: ContentReference
  id: string
  locale: string
}

/** Removes one language's translation of a page, post or category. */
export const deleteContentTranslationStep = createStep(
  "delete-content-translation",
  async (input: DeleteContentTranslationInput, { container }) => {
    const service: ITranslationModuleService = container.resolve(
      Modules.TRANSLATION
    )

    const [row] = await service.listTranslations(
      {
        reference: input.reference,
        reference_id: input.id,
        locale_code: input.locale,
      },
      { take: 1 }
    )

    if (!row) {
      return new StepResponse({ deleted: false }, null)
    }

    await service.deleteTranslations(row.id)

    return new StepResponse(
      { deleted: true },
      { ...input, translations: (row.translations ?? {}) as Record<string, string> }
    )
  },
  async (previous, { container }) => {
    if (!previous) {
      return
    }

    const service: ITranslationModuleService = container.resolve(
      Modules.TRANSLATION
    )

    await service.createTranslations({
      reference: previous.reference,
      reference_id: previous.id,
      locale_code: previous.locale,
      translations: previous.translations as any,
    })
  }
)
