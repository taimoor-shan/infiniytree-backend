import type {
  MedusaNextFunction,
  MedusaRequest,
  MedusaResponse,
  MiddlewareRoute,
} from "@medusajs/framework/http"
import { withoutCustomerDetails } from "../../../utils/customer-privacy"

/**
 * Cuts the customer on every cart and order a store route answers with down to
 * their id and email (`withoutCustomerDetails` says why). It wraps `res.json`
 * rather than the query config, so it holds whichever of Medusa's own
 * middlewares runs first and whatever `fields` the caller asks for.
 */
export const hideCustomerDetails = (
  _req: MedusaRequest,
  res: MedusaResponse,
  next: MedusaNextFunction
) => {
  const json = res.json.bind(res)
  res.json = ((body: unknown) =>
    json(withoutCustomerDetails(body))) as typeof res.json
  next()
}

// No method: Medusa mounts these with `app.use`, which matches the path and
// everything under it (`/store/carts/:id/complete`, `/store/orders/:id/transfer/…`).
export const customerPrivacyStoreMiddlewares: MiddlewareRoute[] = [
  { matcher: "/store/carts", middlewares: [hideCustomerDetails] },
  { matcher: "/store/orders", middlewares: [hideCustomerDetails] },
]
