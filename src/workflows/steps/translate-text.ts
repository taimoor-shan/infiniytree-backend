import { createStep, StepResponse } from "@medusajs/framework/workflows-sdk"
import translate from "google-translate-api-x"

export type TranslatableField = {
  key: string // e.g., "title", "description", "metadata.care_instructions"
  text: string
}

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
    
    // Extract base locale codes (e.g. en-US -> en)
    const sourceLocale = (input.sourceLocale || "en").split("-")[0]
    let targetLocale = input.targetLocale.split("-")[0]
    
    if (sourceLocale === targetLocale) {
      return new StepResponse<TranslateTextOutput>({
        translations: {},
        targetLocale: input.targetLocale
      })
    }
    
    logger.info(`Translating ${input.fields.length} fields to ${targetLocale} via Google Translate`)
    
    const translations: Record<string, string> = {}
    
    // Process translations sequentially to avoid overwhelming the scraper
    for (const field of input.fields) {
      if (!field.text) continue;
      
      try {
        const res = await translate(field.text, {
          from: sourceLocale,
          to: targetLocale,
          forceBatch: false,
        })
        
        if (res && res.text) {
          translations[field.key] = res.text
        }
      } catch (e: any) {
        logger.error(`Error translating field '${field.key}': ${e.message}`)
      }
    }
    
    return new StepResponse<TranslateTextOutput>({
      translations,
      targetLocale: input.targetLocale
    })
  }
)
