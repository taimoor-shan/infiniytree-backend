/**
 * Cache Revalidation Utility
 *
 * Notifies the storefront's `/api/revalidate` endpoint when
 * CMS-managed content changes so Next.js fetch caches are invalidated.
 *
 * Used by admin API routes (pages, translations, etc.) that don't
 * emit standard Medusa entity events.
 */

const STOREFRONT_URL =
  process.env.NEXT_PUBLIC_STOREFRONT_URL ||
  process.env.STOREFRONT_PUBLIC_URL ||
  "http://localhost:8000"

const REVALIDATION_SECRET = process.env.REVALIDATION_SECRET || ""

/**
 * Notify the storefront to invalidate specific cache tags.
 * Silently degrades if the storefront is unreachable or the
 * secret is not configured.
 */
export async function revalidateStorefrontCache(
  tags: string[],
  logger?: any
): Promise<void> {
  if (!REVALIDATION_SECRET) {
    logger?.warn(
      "[revalidate-cache] REVALIDATION_SECRET not set — skipping notification"
    )
    return
  }

  try {
    const res = await fetch(`${STOREFRONT_URL}/api/revalidate`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-revalidate-secret": REVALIDATION_SECRET,
      },
      body: JSON.stringify({ tags }),
    })

    if (!res.ok) {
      logger?.warn(
        `[revalidate-cache] Storefront returned ${res.status} for tags: ${tags.join(", ")}`
      )
      return
    }

    const body = await res.json()
    logger?.info(
      `[revalidate-cache] Revalidated tags: ${(body.revalidated || []).join(", ") || "none"}`
    )
  } catch (err: any) {
    logger?.warn(`[revalidate-cache] Failed to notify storefront: ${err.message}`)
  }
}