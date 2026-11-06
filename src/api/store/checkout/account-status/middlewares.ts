import {
  MedusaNextFunction,
  MedusaRequest,
  MedusaResponse,
  MiddlewareRoute,
  validateAndTransformBody,
} from "@medusajs/framework/http"
import { createRateLimiter, visitorKey } from "../../../../utils/rate-limit"
import { AccountStatusSchema } from "./route"

// A visitor leaves the email field a few times per checkout. Twenty checks in
// ten minutes is room for an office behind one address, not for trying a list
// of emails.
const allowCheck = createRateLimiter({ limit: 20, windowMs: 10 * 60 * 1000 })

const limitPerVisitor = (
  req: MedusaRequest,
  res: MedusaResponse,
  next: MedusaNextFunction
) => {
  if (allowCheck(visitorKey(req.headers, req.ip))) {
    return next()
  }
  return res
    .status(429)
    .json({ type: "not_allowed", message: "Too many requests, try again later" })
}

export const accountStatusStoreMiddlewares: MiddlewareRoute[] = [
  {
    matcher: "/store/checkout/account-status",
    method: "POST",
    middlewares: [limitPerVisitor, validateAndTransformBody(AccountStatusSchema)],
  },
]
