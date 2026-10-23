import { createStep, StepResponse } from "@medusajs/framework/workflows-sdk"
import { Modules } from "@medusajs/framework/utils"
import { ITranslationModuleService } from "@medusajs/types"
import { ContentReference } from "../../utils/translations/content-types"

export type DeleteRecordTranslationsInput = {
  reference: ContentReference
  id: string
}

/**
 * Removes every language's translation of a page, post or category that is
 * being deleted. The Translation module keeps no link to the record, so
 * without this the rows would stay behind for good, and still be counted under
 * Settings → Translations.
 */
export const deleteRecordTranslationsStep = createStep(
  "delete-record-translations",
  async (input: DeleteRecordTranslationsInput, { container }) => {
    let service: ITranslationModuleService

    try {
      service = container.resolve(Modules.TRANSLATION)
    } catch {
      // Translation feature off: nothing was ever stored.
      return new StepResponse({ deleted: 0 }, null)
    }

    const rows = await service.listTranslations(
      { reference: input.reference, reference_id: input.id },
      { take: 1000 }
    )

    if (!rows.length) {
      return new StepResponse({ deleted: 0 }, null)
    }

    await service.deleteTranslations(rows.map((row) => row.id))

    return new StepResponse(
      { deleted: rows.length },
      {
        ...input,
        rows: rows.map((row) => ({
          locale_code: row.locale_code,
          translations: (row.translations ?? {}) as Record<string, string>,
        })),
      }
    )
  },
  async (previous, { container }) => {
    if (!previous) {
      return
    }

    const service: ITranslationModuleService = container.resolve(
      Modules.TRANSLATION
    )

    await service.createTranslations(
      previous.rows.map((row) => ({
        reference: previous.reference,
        reference_id: previous.id,
        locale_code: row.locale_code,
        translations: row.translations as any,
      }))
    )
  }
)
