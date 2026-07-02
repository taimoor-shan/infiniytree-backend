import { MiddlewareRoute, validateAndTransformBody, validateAndTransformQuery } from "@medusajs/framework/http"
import { z } from "zod"

const paginationSchema = z.object({
  limit: z
    .preprocess(
      (val) => (typeof val === "string" ? parseInt(val, 10) : val),
      z.number().min(1).max(100).optional()
    )
    .optional(),
  offset: z
    .preprocess(
      (val) => (typeof val === "string" ? parseInt(val, 10) : val),
      z.number().min(0).optional()
    )
    .optional(),
})

export const GetAdminPagesSchema = paginationSchema.merge(
  z.object({
    q: z.string().optional(),
    status: z.enum(["draft", "published"]).optional(),
  })
)

export const CreatePageSchema = z.object({
  title: z.string().min(1),
  slug: z.string().min(1),
  content: z.string().optional().nullable(),
  excerpt: z.string().optional().nullable(),
  featured_image: z.string().optional().nullable(),
  seo_title: z.string().optional().nullable(),
  seo_description: z.string().optional().nullable(),
  status: z.enum(["draft", "published"]).optional(),
  is_public: z.boolean().optional(),
  metadata: z.record(z.unknown()).optional().nullable(),
})

export type CreatePageSchema = z.infer<typeof CreatePageSchema>

export const UpdatePageSchema = z.object({
  title: z.string().min(1).optional(),
  slug: z.string().min(1).optional(),
  content: z.string().optional().nullable(),
  excerpt: z.string().optional().nullable(),
  featured_image: z.string().optional().nullable(),
  seo_title: z.string().optional().nullable(),
  seo_description: z.string().optional().nullable(),
  status: z.enum(["draft", "published"]).optional(),
  is_public: z.boolean().optional(),
  metadata: z.record(z.unknown()).optional().nullable(),
})

export type UpdatePageSchema = z.infer<typeof UpdatePageSchema>

export const pageAdminMiddlewares: MiddlewareRoute[] = [
  {
    matcher: "/admin/pages",
    method: "GET",
    middlewares: [validateAndTransformQuery(GetAdminPagesSchema, {})],
  },
  {
    matcher: "/admin/pages",
    method: "POST",
    middlewares: [validateAndTransformBody(CreatePageSchema)],
  },
  {
    matcher: "/admin/pages/:id",
    method: "POST",
    middlewares: [validateAndTransformBody(UpdatePageSchema)],
  },
]
