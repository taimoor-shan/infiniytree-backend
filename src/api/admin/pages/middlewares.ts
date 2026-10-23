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

/**
 * The storefront serves a page at `/<slug>` (`/guides/plant-care` for the slug
 * `guides/plant-care`), through a catch-all route. A real route always wins over
 * the catch-all, so a slug that starts with one of these names would save fine
 * and then never be reachable. Rejecting it here tells the editor straight away.
 */
const RESERVED_FIRST_SEGMENTS = [
  "account",
  "api",
  "blog",
  "cart",
  "categories",
  "checkout",
  "collections",
  "order",
  "pages",
  "products",
  "sales-portal",
  "store",
  "team",
]

const slugSchema = z
  .string()
  .min(1)
  .refine(
    (slug) =>
      !RESERVED_FIRST_SEGMENTS.includes(
        slug.replace(/^\/+/, "").split("/")[0].toLowerCase()
      ),
    "This slug starts with the name of a built-in storefront page and cannot be used"
  )

export const GetAdminPagesSchema = paginationSchema.merge(
  z.object({
    q: z.string().optional(),
    status: z.enum(["draft", "published"]).optional(),
  })
)

export const CreatePageSchema = z.object({
  title: z.string().min(1),
  slug: slugSchema,
  locale: z.string().optional(),
  content: z.string().optional().nullable(),
  excerpt: z.string().optional().nullable(),
  featured_image: z.string().optional().nullable(),
  hero_video_url: z.string().optional().nullable(),
  template: z.string().min(1).max(40).optional(),
  seo_title: z.string().optional().nullable(),
  seo_description: z.string().optional().nullable(),
  status: z.enum(["draft", "published"]).optional(),
  is_public: z.boolean().optional(),
  metadata: z.record(z.string(), z.unknown()).optional().nullable(),
})

export type CreatePageSchema = z.infer<typeof CreatePageSchema>

export const UpdatePageSchema = z.object({
  title: z.string().min(1).optional(),
  slug: slugSchema.optional(),
  locale: z.string().optional(),
  content: z.string().optional().nullable(),
  excerpt: z.string().optional().nullable(),
  featured_image: z.string().optional().nullable(),
  hero_video_url: z.string().optional().nullable(),
  template: z.string().min(1).max(40).optional(),
  seo_title: z.string().optional().nullable(),
  seo_description: z.string().optional().nullable(),
  status: z.enum(["draft", "published"]).optional(),
  is_public: z.boolean().optional(),
  metadata: z.record(z.string(), z.unknown()).optional().nullable(),
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
