import {
  MedusaNextFunction,
  MedusaRequest,
  MedusaResponse,
  MiddlewareRoute,
  validateAndTransformBody,
} from "@medusajs/framework/http"
import { createRateLimiter, visitorKey } from "../../../utils/rate-limit"
import { requireTurnstile } from "../../../utils/turnstile"
import { NewsletterSignupSchema, NewsletterTokenSchema } from "./route"

// Each sign-up emails the address typed, so it is kept from being used to mail
// strangers: Turnstile, and ten a visitor an hour.
const allowSignup = createRateLimiter({ limit: 10, windowMs: 60 * 60 * 1000 })
const allowToken = createRateLimiter({ limit: 30, windowMs: 60 * 60 * 1000 })

const limit =
  (allow: (key: string) => boolean) =>
  (req: MedusaRequest, res: MedusaResponse, next: MedusaNextFunction) =>
    allow(visitorKey(req.headers, req.ip))
      ? next()
      : res
          .status(429)
          .json({ type: "not_allowed", message: "Too many requests, try again later" })

export const newsletterStoreMiddlewares: MiddlewareRoute[] = [
  {
    matcher: "/store/newsletter",
    method: "POST",
    middlewares: [
      requireTurnstile,
      limit(allowSignup),
      validateAndTransformBody(NewsletterSignupSchema),
    ],
  },
  {
    matcher: "/store/newsletter/status",
    method: "POST",
    middlewares: [limit(allowToken), validateAndTransformBody(NewsletterTokenSchema)],
  },
]
