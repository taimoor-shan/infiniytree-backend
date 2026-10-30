import {
  MiddlewareRoute,
  validateAndTransformQuery,
} from "@medusajs/framework/http"
import { z } from "zod"

export const GetAdminNotifyMeSchema = z.object({
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
  // Matches the email or the product's name.
  q: z.string().optional(),
  product_id: z.string().optional(),
})

export type GetAdminNotifyMeSchema = z.infer<typeof GetAdminNotifyMeSchema>

export const notifyMeAdminMiddlewares: MiddlewareRoute[] = [
  {
    matcher: "/admin/notify-me",
    method: "GET",
    middlewares: [validateAndTransformQuery(GetAdminNotifyMeSchema, {})],
  },
]
