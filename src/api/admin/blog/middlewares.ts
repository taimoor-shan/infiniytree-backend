import {
  MiddlewareRoute,
  validateAndTransformBody,
  validateAndTransformQuery,
} from "@medusajs/framework/http"
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
 * `/blog/category/<handle>` is the category archive, so an article with the
 * handle "category" would be unreachable.
 */
const RESERVED_POST_HANDLES = ["category"]

const handleSchema = z
  .string()
  .min(1)
  .max(120)
  .regex(
    /^[a-z0-9]+(?:-[a-z0-9]+)*$/,
    "Use lowercase letters, numbers and single hyphens, e.g. caring-for-olive-trees"
  )

const postHandleSchema = handleSchema.refine(
  (handle) => !RESERVED_POST_HANDLES.includes(handle),
  "This handle is reserved"
)

const localeSchema = z
  .string()
  .regex(/^[a-z]{2,3}(?:-[A-Z]{2})?$/, "Use a locale such as en or de-AT")

const metadataSchema = z.record(z.string(), z.unknown()).optional().nullable()

export const GetAdminBlogPostsSchema = paginationSchema.extend({
  q: z.string().optional(),
  status: z.enum(["draft", "published"]).optional(),
  locale: z.string().optional(),
})

export const CreateBlogPostSchema = z.object({
  title: z.string().min(1).max(200),
  handle: postHandleSchema,
  locale: localeSchema.optional(),
  excerpt: z.string().max(1000).optional().nullable(),
  content: z.string().optional().nullable(),
  featured_image: z.string().max(2000).optional().nullable(),
  featured_image_alt: z.string().max(300).optional().nullable(),
  author_name: z.string().max(120).optional().nullable(),
  template: z.string().min(1).max(40).optional(),
  status: z.enum(["draft", "published"]).optional(),
  published_at: z.iso.datetime({ offset: true }).optional().nullable(),
  seo_title: z.string().max(200).optional().nullable(),
  seo_description: z.string().max(500).optional().nullable(),
  metadata: metadataSchema,
  category_ids: z.array(z.string()).optional(),
})

export type CreateBlogPostSchema = z.infer<typeof CreateBlogPostSchema>

export const UpdateBlogPostSchema = CreateBlogPostSchema.partial()

export type UpdateBlogPostSchema = z.infer<typeof UpdateBlogPostSchema>

export const GetAdminBlogCategoriesSchema = z.object({
  q: z.string().optional(),
  locale: z.string().optional(),
})

export const CreateBlogCategorySchema = z.object({
  name: z.string().min(1).max(120),
  handle: handleSchema,
  locale: localeSchema.optional(),
  description: z.string().max(2000).optional().nullable(),
  seo_title: z.string().max(200).optional().nullable(),
  seo_description: z.string().max(500).optional().nullable(),
  metadata: metadataSchema,
})

export type CreateBlogCategorySchema = z.infer<typeof CreateBlogCategorySchema>

export const UpdateBlogCategorySchema = CreateBlogCategorySchema.partial()

export type UpdateBlogCategorySchema = z.infer<typeof UpdateBlogCategorySchema>

export const blogAdminMiddlewares: MiddlewareRoute[] = [
  {
    matcher: "/admin/blog/posts",
    method: "GET",
    middlewares: [validateAndTransformQuery(GetAdminBlogPostsSchema, {})],
  },
  {
    matcher: "/admin/blog/posts",
    method: "POST",
    middlewares: [validateAndTransformBody(CreateBlogPostSchema)],
  },
  {
    matcher: "/admin/blog/posts/:id",
    method: "POST",
    middlewares: [validateAndTransformBody(UpdateBlogPostSchema)],
  },
  {
    matcher: "/admin/blog/categories",
    method: "GET",
    middlewares: [validateAndTransformQuery(GetAdminBlogCategoriesSchema, {})],
  },
  {
    matcher: "/admin/blog/categories",
    method: "POST",
    middlewares: [validateAndTransformBody(CreateBlogCategorySchema)],
  },
  {
    matcher: "/admin/blog/categories/:id",
    method: "POST",
    middlewares: [validateAndTransformBody(UpdateBlogCategorySchema)],
  },
]
