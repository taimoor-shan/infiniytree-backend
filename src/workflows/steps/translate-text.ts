import { createStep, StepResponse } from "@medusajs/framework/workflows-sdk"
import { TranslationService } from "../../services/translation-providers"
import type { TranslatableField } from "../../services/translation-providers/provider"

// Re-export for consumers (translate-product workflow)
export type { TranslatableField }

export type TranslateTextInput = {
  fields: TranslatableField[]
  targetLocale: string
  sourceLocale?: string
}

export type TranslateTextOutput = {
  translations: Record<string, string>
  targetLocale: string
}

export const translateTextStep = createStep(
  "translate-text",
  async (input: TranslateTextInput, { container }) => {
    const logger = container.resolve("logger")

    const sourceLocale = input.sourceLocale || "en"
    const targetLocale = input.targetLocale

    // Skip if source and target are the same
    if (sourceLocale === targetLocale) {
      return new StepResponse<TranslateTextOutput>({
        translations: {},
        targetLocale: input.targetLocale,
      })
    }

    logger.info(
      `Translating ${input.fields.length} fields from ${sourceLocale} to ${targetLocale}`
    )

    try {
      const service = new TranslationService()
      const { translations, durationMs } = await service.translate(
        input.fields,
        sourceLocale,
        targetLocale,
        logger
      )

      logger.info(
        `Translated ${Object.keys(translations).length}/${input.fields.length} fields ` +
        `to ${targetLocale} in ${durationMs}ms`
      )

      return new StepResponse<TranslateTextOutput>({
        translations,
        targetLocale: input.targetLocale,
      })
    } catch (e: any) {
      logger.error(
        `Translation to ${targetLocale} failed: ${e.message}`
      )
      throw e
    }
  }
)
