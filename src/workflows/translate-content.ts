import {
  createWorkflow,
  transform,
  WorkflowResponse,
} from "@medusajs/framework/workflows-sdk"
import { ContentReference } from "../utils/translations/content-types"
import { loadContentForTranslationStep } from "./steps/load-content-for-translation"
import { saveContentTranslationsStep } from "./steps/save-content-translations"
import { translateContentFieldsStep } from "./steps/translate-content-fields"

export type TranslateContentWorkflowInput = {
  reference: ContentReference
  id: string
  /** The variants of one language, e.g. `["de-AT", "de-DE"]`. */
  locales: string[]
  overwrite: boolean
}

/**
 * Translates a page, post or category into one language with the configured
 * provider (the same flow as `translate-product`) and saves the result for
 * each of that language's locales.
 */
const translateContentWorkflow = createWorkflow(
  "translate-content",
  function (input: TranslateContentWorkflowInput) {
    const loaded = loadContentForTranslationStep(input)

    const targetLocale = transform({ input }, ({ input }) => input.locales[0])

    const translated = translateContentFieldsStep({
      fields: loaded.fields,
      sourceLocale: loaded.sourceLocale,
      targetLocale,
    })

    const saved = saveContentTranslationsStep({
      reference: input.reference,
      id: input.id,
      locales: input.locales,
      values: translated.translations,
    })

    return new WorkflowResponse(saved)
  }
)

export default translateContentWorkflow
