import {
  createWorkflow,
  transform,
  when,
  WorkflowResponse,
} from "@medusajs/framework/workflows-sdk"
import {
  transferCartCustomerWorkflow,
  useQueryGraphStep,
} from "@medusajs/medusa/core-flows"
import { findAccountForEmailStep } from "./steps/find-account-for-email"

export type AttachCartToAccountInput = {
  cart_id: string
}

/**
 * Puts a cart on the account its email belongs to, so a returning customer who
 * checks out without signing in still orders under their account: the order
 * shows in their history and their sales rep is credited (the commission
 * plugin matches the order's customer).
 *
 * Medusa does this by itself only for a cart that has no customer yet. Once a
 * cart has one, a corrected email keeps it on a guest record or on the account
 * typed first. A cart already on the right account, one whose email has no
 * account and a completed one are left as they are. Moving it reuses Medusa's
 * transfer, which also sets the account's email and refreshes the prices.
 */
const attachCartToAccountWorkflow = createWorkflow(
  "attach-cart-to-account",
  function (input: AttachCartToAccountInput) {
    const { data: carts } = useQueryGraphStep({
      entity: "cart",
      fields: ["id", "email", "customer_id", "completed_at"],
      filters: { id: input.cart_id },
      options: { throwIfKeyNotFound: true },
    }).config({ name: "get-cart-to-attach" })

    const email = transform({ carts }, ({ carts }) => ({ email: carts[0].email }))
    const accountId = findAccountForEmailStep(email)

    const move = transform({ carts, accountId }, ({ carts, accountId }) => {
      const [cart] = carts
      return !!accountId && !cart.completed_at && cart.customer_id !== accountId
    })

    when("cart-is-on-another-record", { move }, ({ move }) => move).then(() => {
      const transfer = transform({ input, accountId }, ({ input, accountId }) => ({
        id: input.cart_id,
        customer_id: accountId as string,
      }))
      transferCartCustomerWorkflow.runAsStep({ input: transfer })
    })

    return new WorkflowResponse(move)
  }
)

export default attachCartToAccountWorkflow
