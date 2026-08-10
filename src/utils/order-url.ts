import { createHash } from "crypto"

export function buildOrderAccessUrl(
  order: {
    id: string
    display_id?: string | number
    metadata?: Record<string, any>
  },
  storefrontUrl: string
): string {
  const rawToken = order.metadata?.order_access_token
  const displayId = order.display_id || order.id?.slice(-8) || "—"

  if (!rawToken) return ""

  // Public guest URL — the storefront's country-code middleware handles
  // redirecting to the correct /:countryCode prefix automatically.
  return `${storefrontUrl}/order/guest/${displayId}?token=${encodeURIComponent(rawToken)}`
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
