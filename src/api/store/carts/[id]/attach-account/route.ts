import { MedusaResponse, MedusaStoreRequest } from "@medusajs/framework/http"
import attachCartToAccountWorkflow from "../../../../../workflows/attach-cart-to-account"

/**
 * Puts a signed-out visitor's cart on the account its email belongs to, before
 * the order is placed (`attachCartToAccountWorkflow` says why). The checkout
 * calls it after saving the address. A signed-in customer's cart is theirs,
 * whatever email it carries, and is never moved.
 *
 * The answer says nothing about whether the cart moved, so this route can't be
 * used to find out which emails have an account.
 */
export async function POST(req: MedusaStoreRequest, res: MedusaResponse) {
  if (!req.auth_context?.actor_id) {
    await attachCartToAccountWorkflow(req.scope).run({
      input: { cart_id: req.params.id },
    })
  }

  return res.status(200).json({ success: true })
}
