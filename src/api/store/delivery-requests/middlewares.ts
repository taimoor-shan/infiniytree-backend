import {
  MiddlewareRoute,
  validateAndTransformBody,
} from "@medusajs/framework/http"
import { DeliveryRequestSchema } from "./route"

export const deliveryRequestStoreMiddlewares: MiddlewareRoute[] = [
  {
    matcher: "/store/delivery-requests",
    method: "POST",
    // No Turnstile check: it is sent from the checkout, which has no widget,
    // and the request needs a real cart with products in it.
    middlewares: [validateAndTransformBody(DeliveryRequestSchema)],
  },
]
