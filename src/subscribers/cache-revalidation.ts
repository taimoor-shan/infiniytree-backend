/**
 * Cache Revalidation Subscriber
 *
 * Listens for Medusa entity lifecycle events and notifies the storefront
 * to invalidate its Next.js fetch cache for the corresponding data.
 *
 * The storefront's `/api/revalidate` endpoint accepts a JSON body of
 * `{ tags: string[] }` and requires an `x-revalidate-secret` header
 * that matches the `REVALIDATION_SECRET` env var (shared between backend
 * and storefront).
 */

const STOREFRONT_URL =
  process.env.NEXT_PUBLIC_STOREFRONT_URL ||
  process.env.STOREFRONT_PUBLIC_URL ||
  "http://localhost:8000"

const REVALIDATION_SECRET = process.env.REVALIDATION_SECRET || ""

/**
 * Map of Medusa event name prefixes to the cache tags they should
 * invalidate in the storefront.
 */
const EVENT_TAG_MAP: Record<string, string[]> = {
  "product.": ["products", "variants"],
  "product-category.": ["categories"],
  "collection.": ["collections"],
  "region.": ["regions"],
  "locale.": ["locales"],
  "store.": ["store", "locales"],
}

async function notifyStorefront(
  tags: string[],
  logger: any
): Promise<void> {
  if (!REVALIDATION_SECRET) {
    logger.warn(
      "[cache-revalidation] REVALIDATION_SECRET not set — skipping storefront notification"
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
      logger.warn(
        `[cache-revalidation] Storefront returned ${res.status} for tags: ${tags.join(", ")}`
      )
      return
    }

    const body = await res.json()
    logger.info(
      `[cache-revalidation] Revalidated tags: ${(body.revalidated || []).join(", ") || "none"}`
    )
  } catch (err: any) {
    logger.warn(
      `[cache-revalidation] Failed to notify storefront: ${err.message}`
    )
  }
}

export default async function cacheRevalidationHandler({
  event,
  container,
}: {
  event: { name: string; data: Record<string, unknown> }
  container: any
}) {
  const logger = container.resolve("logger") as any

  const matchedTags: string[] = []

  for (const [prefix, tags] of Object.entries(EVENT_TAG_MAP)) {
    if (event.name.startsWith(prefix)) {
      matchedTags.push(...tags)
    }
  }

  if (matchedTags.length === 0) {
    return
  }

  // Deduplicate
  const unique = [...new Set(matchedTags)]

  logger.info(
    `[cache-revalidation] Event "${event.name}" → invalidating: ${unique.join(", ")}`
  )

  await notifyStorefront(unique, logger)
}

/**
 * Subscribe to all relevant Medusa entity events.
 *
 * The wildcard `*` pattern is supported by Medusa's event system.
 * If it's not supported by your version, replace with individual events:
 *   - "product.created"   → products, variants
 *   - "product.updated"   → products, variants
 *   - "product.deleted"   → products, variants
 *   - "product-category.created" → categories
 *   - "product-category.updated" → categories
 *   - "product-category.deleted" → categories
 *   - "collection.created" → collections
 *   - "collection.updated" → collections
 *   - "collection.deleted" → collections
 *   - "region.created"    → regions
 *   - "region.updated"    → regions
 *   - "region.deleted"    → regions
 */
export const config = {
  event: [
    "product.*",
    "product-variant.*",
    "product-category.*",
    "collection.*",
    "region.*",
    "locale.*",
    "store.*",
  ],
}