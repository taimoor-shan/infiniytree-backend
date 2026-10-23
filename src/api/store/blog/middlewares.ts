import {
  MiddlewareRoute,
  validateAndTransformQuery,
} from "@medusajs/framework/http"
import { z } from "zod"

// `locale` is not in these schemas on purpose: Medusa resolves it onto
// `req.locale` before validation and removes it from the query. See
// `src/utils/translations/request-locale.ts`.

export const GetStoreBlogPostsSchema = z.object({
  category: z.string().optional(),
  limit: z.preprocess(
    (val) => (typeof val === "string" ? parseInt(val, 10) : val),
    z.number().min(1).max(100).optional()
  ),
  offset: z.preprocess(
    (val) => (typeof val === "string" ? parseInt(val, 10) : val),
    z.number().min(0).optional()
  ),
})

export const blogStoreMiddlewares: MiddlewareRoute[] = [
  {
    matcher: "/store/blog/posts",
    method: "GET",
    middlewares: [validateAndTransformQuery(GetStoreBlogPostsSchema, {})],
  },
]
