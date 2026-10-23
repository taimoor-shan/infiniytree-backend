import {
  MiddlewareRoute,
  validateAndTransformBody,
  validateAndTransformQuery,
} from "@medusajs/framework/http"
import { z } from "zod"

const localeSchema = z
  .string()
  .regex(/^[a-z]{2,3}(?:-[A-Za-z0-9]{2,4})?$/, "Use a locale such as de-DE")

/** Save one language: field → text (blank removes that field's translation). */
export const SaveContentTranslationSchema = z.object({
  locale: localeSchema,
  values: z.record(z.string(), z.string()),
})

export type SaveContentTranslationSchema = z.infer<
  typeof SaveContentTranslationSchema
>

/** Auto-translate: into these languages, or the configured ones when omitted. */
export const TranslateContentSchema = z.object({
  locales: z.array(localeSchema).optional(),
  overwrite: z.boolean().optional(),
})

export type TranslateContentSchema = z.infer<typeof TranslateContentSchema>

export const DeleteContentTranslationSchema = z.object({
  locale: localeSchema,
})

export const contentTranslationsAdminMiddlewares: MiddlewareRoute[] = [
  {
    matcher: "/admin/content-translations/:reference/:id",
    method: "POST",
    middlewares: [validateAndTransformBody(SaveContentTranslationSchema)],
  },
  {
    matcher: "/admin/content-translations/:reference/:id",
    method: "DELETE",
    middlewares: [validateAndTransformQuery(DeleteContentTranslationSchema, {})],
  },
  {
    matcher: "/admin/content-translations/:reference/:id/translate",
    method: "POST",
    middlewares: [validateAndTransformBody(TranslateContentSchema)],
  },
]
