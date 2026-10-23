import { MedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import {
  listVisiblePosts,
  retrieveCategory,
} from "../../../../../utils/blog/store-queries"
import { requestLocale } from "../../../../../utils/translations/request-locale"

/**
 * `GET /store/blog/categories/:handle?locale=de-DE`
 *
 * One category in the visitor's language where a translation exists, with how
 * many published articles it holds (the storefront keeps an empty category out
 * of search).
 *
 * An unknown category answers 200 with `category: null`, not 404, for the
 * reason given on `GET /store/blog/posts/:handle`: the storefront's data cache
 * only keeps 200 responses, so a 404 would leave a deleted category online.
 */
export async function GET(req: MedusaRequest, res: MedusaResponse) {
  const { handle } = req.params
  const locale = requestLocale(req)

  const category = await retrieveCategory(req.scope, handle, locale)

  if (!category) {
    return res.json({ category: null })
  }

  const { count } = await listVisiblePosts(req.scope, {
    locale,
    category: handle,
    limit: 1,
    offset: 0,
  })

  return res.json({ category: { ...category, post_count: count } })
}
