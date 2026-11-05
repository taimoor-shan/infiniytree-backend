import {
  MiddlewareRoute,
  validateAndTransformBody,
  validateAndTransformQuery,
} from "@medusajs/framework/http"
import { z } from "zod"

const toInt = (val: unknown) =>
  typeof val === "string" ? parseInt(val, 10) : val

export const GetAdminDeliveryRequestsSchema = z.object({
  limit: z.preprocess(toInt, z.number().min(1).max(100).optional()).optional(),
  offset: z.preprocess(toInt, z.number().min(0).optional()).optional(),
  // Matches the email, company, last name, city or country code.
  q: z.string().optional(),
  status: z.enum(["new", "handled"]).optional(),
})

export const UpdateAdminDeliveryRequestSchema = z.object({
  status: z.enum(["new", "handled"]),
})

export const deliveryRequestAdminMiddlewares: MiddlewareRoute[] = [
  {
    matcher: "/admin/delivery-requests",
    method: "GET",
    middlewares: [validateAndTransformQuery(GetAdminDeliveryRequestsSchema, {})],
  },
  {
    matcher: "/admin/delivery-requests/:id",
    method: "POST",
    middlewares: [validateAndTransformBody(UpdateAdminDeliveryRequestSchema)],
  },
]
