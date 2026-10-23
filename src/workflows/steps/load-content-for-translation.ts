import { createStep, StepResponse } from "@medusajs/framework/workflows-sdk"
import { Modules } from "@medusajs/framework/utils"
import {
  CONTENT_TYPES,
  ContentReference,
} from "../../utils/translations/content-types"
import type { PlanField } from "../../utils/translations/plan"

export type LoadContentForTranslationInput = {
  reference: ContentReference
  id: string
  /** The locales one translation is saved for; the first names the language. */
  locales: string[]
  /** Translate fields that already have a translation too. */
  overwrite: boolean
}

export type LoadContentForTranslationOutput = {
  sourceLocale: string
  fields: PlanField[]
}

const isFilled = (value: unknown): value is string =>
  typeof value === "string" && value.trim() !== ""

/**
 * What there is to translate: the record's text fields that have text, and
 * (unless `overwrite`) no translation yet, so an article someone has already
 * proofread in German is not overwritten when English is edited.
 */
export const loadContentForTranslationStep = createStep(
  "load-content-for-translation",
  async (input: LoadContentForTranslationInput, { container }) => {
    const type = CONTENT_TYPES[input.reference]
    const record = await type.retrieve(container, input.id)

    let existing: Record<string, unknown> = {}

    if (!input.overwrite) {
      const service = container.resolve(Modules.TRANSLATION)
      const [row] = await service.listTranslations(
        {
          reference: input.reference,
          reference_id: input.id,
          locale_code: input.locales[0],
        },
        { take: 1 }
      )

      existing = row?.translations ?? {}
    }

    const fields: PlanField[] = type.fields
      .filter(
        (field) => isFilled(record[field.key]) && !isFilled(existing[field.key])
      )
      .map((field) => ({
        key: field.key,
        text: record[field.key] as string,
        html: field.kind === "html",
      }))

    return new StepResponse<LoadContentForTranslationOutput>({
      sourceLocale: record.locale || "en",
      fields,
    })
  }
)
