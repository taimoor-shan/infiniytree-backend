import { MiddlewareRoute, validateAndTransformQuery } from "@medusajs/framework/http"
import { z } from "zod"

export const GetGuestOrderSchema = z.object({
  token: z.string().min(1),
})

export const guestOrderMiddlewares: MiddlewareRoute[] = [
  {
    matcher: "/store/orders/guest/:displayId",
    method: "GET",
    middlewares: [validateAndTransformQuery(GetGuestOrderSchema, {})],
  },
]
