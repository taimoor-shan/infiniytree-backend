import { Modules } from "@medusajs/framework/utils"
import { revalidateStorefrontCache } from "../utils/revalidate-cache"

/**
 * Translation Revalidation Subscriber
 *
 * A translation of a page, post or category changes what the storefront shows,
 * so its cache has to be refreshed. The admin routes that save or generate
 * translations do that themselves; this covers a translation edited anywhere
 * else, such as Medusa's own Settings → Translations screen.
 */

const TAGS_BY_REFERENCE: Record<string, string[]> = {
  page: ["pages"],
  blog_post: ["blog"],
  blog_category: ["blog"],
}

export default async function translationRevalidationHandler({
  event,
  container,
}: {
  event: { name: string; data: Record<string, unknown> }
  container: any
}) {
  const logger = container.resolve("logger") as any
  const id = event.data?.id as string | undefined

  if (!id) {
    return
  }

  let tags: string[] | undefined

  try {
    const service = container.resolve(Modules.TRANSLATION)
    const translation = await service.retrieveTranslation(id)

    tags = TAGS_BY_REFERENCE[translation.reference]

    // Not ours (a product's, say): products refresh through their own events.
    if (!tags) {
      return
    }
  } catch {
    // A deleted translation can no longer be read, so its type is unknown.
    tags = Array.from(new Set(Object.values(TAGS_BY_REFERENCE).flat()))
  }

  logger.info(`[translation-revalidation] ${event.name} → ${tags.join(", ")}`)

  await revalidateStorefrontCache(tags, logger)
}

export const config = {
  event: ["translation.created", "translation.updated", "translation.deleted"],
}
