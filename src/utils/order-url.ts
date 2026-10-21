import { createHash } from "crypto"
import { Modules } from "@medusajs/framework/utils"

// The storefront serves each market as <language>-<country> (en-hu, de-at), in these
// languages only. Mirrors marketPrefix() in infinytree-storefront/src/lib/i18n/market.ts.
const URL_LANGUAGES = ["en", "de"]
const COUNTRY_DEFAULT_LANGUAGE: Record<string, string> = { at: "de", de: "de" }

function marketPrefix(country: string, locale?: string | null): string {
  const code = country.toLowerCase()
  // No language is English, like the order's emails
  const language = (locale || "en").split("-")[0].toLowerCase()
  const fallback = COUNTRY_DEFAULT_LANGUAGE[code] ?? "en"

  return `${URL_LANGUAGES.includes(language) ? language : fallback}-${code}`
}

export function buildOrderAccessUrl(
  order: {
    id: string
    display_id?: string | number
    metadata?: Record<string, any>
    // The customer signed up (a guest checkout has a customer record too, without an account)
    has_account?: boolean
    locale?: string | null
    shipping_address?: { country_code?: string | null } | null
  },
  storefrontUrl: string
): string {
  // A customer with an account sees the order where they manage it, in the market it was placed in
  if (order.has_account) {
    const country = order.shipping_address?.country_code
    const market = country ? `/${marketPrefix(country, order.locale)}` : ""

    return `${storefrontUrl}${market}/account/orders/details/${order.id}`
  }

  const rawToken = order.metadata?.order_access_token
  const displayId = order.display_id || order.id?.slice(-8) || "—"

  if (!rawToken) return ""

  // Public guest URL — the storefront's country-code middleware handles
  // redirecting to the correct /:countryCode prefix automatically.
  return `${storefrontUrl}/order/guest/${displayId}?token=${encodeURIComponent(rawToken)}`
}

/**
 * Whether the order's customer signed up. Every order has a customer record, and a
 * guest checkout's has no account. A failed lookup counts as no account, so it never
 * stops an order email.
 */
export async function orderHasAccount(
  container: any,
  order: { customer_id?: string | null }
): Promise<boolean> {
  if (!order.customer_id) return false

  try {
    const customer = await container
      .resolve(Modules.CUSTOMER)
      .retrieveCustomer(order.customer_id, { select: ["id", "has_account"] })

    return Boolean(customer.has_account)
  } catch (err: any) {
    container
      .resolve("logger")
      .warn(`[order-url] Could not load customer ${order.customer_id}: ${err.message}`)
    return false
  }
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
