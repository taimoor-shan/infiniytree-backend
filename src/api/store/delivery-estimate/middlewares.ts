import {
  MiddlewareRoute,
  validateAndTransformQuery,
} from "@medusajs/framework/http"
import { z } from "zod"

export const GetStoreDeliveryEstimateSchema = z.object({
  product_id: z.string().min(1),
  country_code: z.string().length(2),
  currency_code: z.string().length(3).optional(),
})

export type GetStoreDeliveryEstimateSchema = z.infer<
  typeof GetStoreDeliveryEstimateSchema
>

export const deliveryEstimateStoreMiddlewares: MiddlewareRoute[] = [
  {
    matcher: "/store/delivery-estimate",
    method: "GET",
    middlewares: [
      validateAndTransformQuery(GetStoreDeliveryEstimateSchema, {}),
    ],
  },
]
