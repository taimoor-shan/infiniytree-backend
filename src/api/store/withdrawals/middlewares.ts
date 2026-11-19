import {
  MedusaNextFunction,
  MedusaRequest,
  MedusaResponse,
  MiddlewareRoute,
  validateAndTransformBody,
} from "@medusajs/framework/http"
import { createRateLimiter, visitorKey } from "../../../utils/rate-limit"
import { requireTurnstile } from "../../../utils/turnstile"
import { WithdrawalSchema } from "./route"

// The form emails whatever address is typed, so it is kept from being used to
// send our email to a list of strangers: Turnstile, and five a visitor an hour.
const allowDeclaration = createRateLimiter({ limit: 5, windowMs: 60 * 60 * 1000 })

const limitPerVisitor = (
  req: MedusaRequest,
  res: MedusaResponse,
  next: MedusaNextFunction
) => {
  if (allowDeclaration(visitorKey(req.headers, req.ip))) {
    return next()
  }
  return res
    .status(429)
    .json({ type: "not_allowed", message: "Too many requests, try again later" })
}

export const withdrawalStoreMiddlewares: MiddlewareRoute[] = [
  {
    matcher: "/store/withdrawals",
    method: "POST",
    middlewares: [
      requireTurnstile,
      limitPerVisitor,
      validateAndTransformBody(WithdrawalSchema),
    ],
  },
]
