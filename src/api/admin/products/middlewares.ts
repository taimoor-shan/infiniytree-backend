import {
  MiddlewareRoute,
  validateAndTransformBody,
} from "@medusajs/framework/http"
import { z } from "zod"

const localeSchema = z
  .string()
  .regex(/^[a-z]{2,3}(?:-[A-Za-z0-9]{2,4})?$/, "Use a locale such as de-DE")

/** The long description's English HTML, and the languages to put it into. */
export const TranslateLongDescriptionSchema = z.object({
  html: z.string().min(1, "There is no text to translate").max(200_000),
  locales: z.array(localeSchema).min(1).max(6),
})

export type TranslateLongDescriptionSchema = z.infer<
  typeof TranslateLongDescriptionSchema
>

export const productAdminMiddlewares: MiddlewareRoute[] = [
  {
    matcher: "/admin/products/:id/translate-long-description",
    method: "POST",
    middlewares: [validateAndTransformBody(TranslateLongDescriptionSchema)],
  },
]
