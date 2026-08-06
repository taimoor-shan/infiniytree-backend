import { MiddlewareRoute, validateAndTransformQuery } from "@medusajs/framework/http"
import { z } from "zod"

export const GetGuestInvoiceSchema = z.object({
  token: z.string().min(1),
})

export const guestInvoiceMiddlewares: MiddlewareRoute[] = [
  {
    matcher: "/invoice/guest/:displayId",
    method: "GET",
    middlewares: [validateAndTransformQuery(GetGuestInvoiceSchema, {})],
  },
]
