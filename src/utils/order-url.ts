import { createHash } from "crypto"
import { Modules } from "@medusajs/framework/utils"

export async function buildOrderAccessUrl(
  order: {
    id: string
    display_id?: string | number
    customer_id?: string
    metadata?: Record<string, any>
  },
  storefrontUrl: string,
  container?: any
): Promise<string> {
  let hasAccount = false

  if (order.customer_id && container) {
    try {
      const customerService = container.resolve(Modules.CUSTOMER)
      const customer = await customerService.retrieveCustomer(order.customer_id)
      hasAccount = !!(customer as any).has_account
    } catch {
      // Can't look up customer — leave hasAccount false
    }
  }

  if (!hasAccount) return ""
  return `${storefrontUrl}/account/orders/details/${order.id}`
}

export function generateAccessToken(): {
  rawToken: string
  tokenHash: string
} {
  const rawToken = crypto.randomUUID()
  const tokenHash = createHash("sha256").update(rawToken).digest("hex")
  return { rawToken, tokenHash }
}

export function hashToken(token: string): string {
  return createHash("sha256").update(token).digest("hex")
}
