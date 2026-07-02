import {
  MiddlewareRoute,
  validateAndTransformQuery,
} from "@medusajs/framework/http"
import { z } from "zod"

export const GetStorePagesSchema = z.object({
  q: z.string().optional(),
  limit: z.preprocess(
    (val) => (typeof val === "string" ? parseInt(val, 10) : val),
    z.number().min(1).max(100).optional()
  ),
  offset: z.preprocess(
    (val) => (typeof val === "string" ? parseInt(val, 10) : val),
    z.number().min(0).optional()
  ),
})

export const pageStoreMiddlewares: MiddlewareRoute[] = [
  {
    matcher: "/store/pages",
    method: "GET",
    middlewares: [validateAndTransformQuery(GetStorePagesSchema, {})],
  },
]
