import { createStep, StepResponse } from "@medusajs/framework/workflows-sdk"
import { TranslationService } from "../../services/translation-providers"
import { languageOf } from "../../utils/translations/locale"
import { PlanField, planTranslation } from "../../utils/translations/plan"

export type TranslateContentFieldsInput = {
  fields: PlanField[]
  sourceLocale: string
  targetLocale: string
}

export type TranslateContentFieldsOutput = {
  translations: Record<string, string>
}

/**
 * Translates CMS fields with the configured provider (`TRANSLATION_PROVIDER`,
 * the one products use). A long article is sent in pieces, see `plan.ts`.
 * Nothing is saved here, so a failure half-way leaves no half translation.
 */
export const translateContentFieldsStep = createStep(
  "translate-content-fields",
  async (input: TranslateContentFieldsInput, { container }) => {
    const logger = container.resolve("logger")

    if (
      !input.fields.length ||
      languageOf(input.sourceLocale) === languageOf(input.targetLocale)
    ) {
      return new StepResponse<TranslateContentFieldsOutput>({ translations: {} })
    }

    const plan = planTranslation(input.fields)
    const service = new TranslationService()
    const answered: Record<string, string> = {}

    for (const request of plan.requests) {
      const { translations } = await service.translate(
        request,
        input.sourceLocale,
        input.targetLocale,
        logger
      )

      Object.assign(answered, translations)
    }

    const translations = plan.reassemble(answered)

    logger.info(
      `[translate-content] ${Object.keys(translations).length}/${
        input.fields.length
      } fields to ${input.targetLocale} in ${plan.requests.length} request(s)`
    )

    return new StepResponse<TranslateContentFieldsOutput>({ translations })
  }
)
