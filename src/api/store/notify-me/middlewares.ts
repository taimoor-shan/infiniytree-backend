import {
  MiddlewareRoute,
  validateAndTransformBody,
} from "@medusajs/framework/http"
import { NotifyMeSchema } from "./route"

export const notifyMeStoreMiddlewares: MiddlewareRoute[] = [
  {
    matcher: "/store/notify-me",
    method: "POST",
    middlewares: [validateAndTransformBody(NotifyMeSchema)],
  },
]
