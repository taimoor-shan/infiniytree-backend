import { createWorkflow, transform, WorkflowResponse, when } from "@medusajs/framework/workflows-sdk"
import { useQueryGraphStep } from "@medusajs/medusa/core-flows"
import { translateTextStep } from "./steps/translate-text"
import { saveTranslationsStep } from "./steps/save-translations"

export type TranslateProductWorkflowInput = {
  product_id: string
  target_locale: string
}

export const translateProductWorkflow = createWorkflow(
  "translate-product",
  function (input: TranslateProductWorkflowInput) {
    // 1. Fetch the product using Query
    const { data: products } = useQueryGraphStep({
      entity: "product",
      fields: ["id", "title", "description", "subtitle", "metadata"],
      filters: { id: input.product_id }
    })

    // 2. Extract fields to translate
    const translatableFields = transform({ product: products[0] }, ({ product }) => {
      if (!product) return []
      
      const fields: { key: string; text: string }[] = []
      if (product.title) fields.push({ key: "title", text: product.title })
      if (product.description) fields.push({ key: "description", text: product.description })
      if (product.subtitle) fields.push({ key: "subtitle", text: product.subtitle })
      
      // Metadata fields (only string values)
      if (product.metadata) {
        for (const [k, v] of Object.entries(product.metadata)) {
          if (typeof v === "string" && v.trim() !== "") {
            fields.push({ key: `metadata.${k}`, text: v })
          }
        }
      }
      
      return fields
    })

    // 3. Translate the fields
    const translated = translateTextStep({
      fields: translatableFields,
      targetLocale: input.target_locale
    })

    // 4. Save translations
    const saved = saveTranslationsStep({
      productId: input.product_id,
      translations: translated.translations,
      locale: translated.targetLocale
    })

    return new WorkflowResponse(saved)
  }
)
