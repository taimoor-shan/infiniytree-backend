import {
  MiddlewareRoute,
  validateAndTransformBody,
} from "@medusajs/framework/http"
import { requireTurnstile } from "../../../utils/turnstile"
import { NotifyMeSchema } from "./route"

export const notifyMeStoreMiddlewares: MiddlewareRoute[] = [
  {
    matcher: "/store/notify-me",
    method: "POST",
    // The Turnstile check runs first so bots are turned away before any other work.
    middlewares: [requireTurnstile, validateAndTransformBody(NotifyMeSchema)],
  },
]
