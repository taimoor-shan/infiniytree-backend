import {
  AuthenticatedMedusaRequest,
  MedusaResponse,
} from "@medusajs/framework/http"
import { translateProductWorkflow } from "../../../../../workflows/translate-product"

export async function POST(
  req: AuthenticatedMedusaRequest,
  res: MedusaResponse
) {
  const { id } = req.params

  const envLocales = process.env.AUTO_TRANSLATE_LOCALES 
    ? process.env.AUTO_TRANSLATE_LOCALES.split(",").map(l => l.trim()) 
    : []
  
  const localesToTranslate = envLocales

  if (localesToTranslate.length === 0) {
    res.status(400).json({
      message: "No target locales configured. Please set AUTO_TRANSLATE_LOCALES in your .env file."
    })
    return
  }

  const results: any[] = []

  // Execute workflow once per locale
  for (const locale of localesToTranslate) {
    try {
      const { result } = await translateProductWorkflow(req.scope).run({
        input: {
          product_id: id,
          target_locale: locale,
        },
      })
      results.push({ locale, status: "success", data: result })
    } catch (err: any) {
      req.scope.resolve("logger").error(`Failed to translate product ${id} to ${locale}: ${err.message}`)
      results.push({ locale, status: "error", error: err.message })
    }
  }

  res.status(200).json({
    message: "Translation completed",
    results,
  })
}
