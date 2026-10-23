import { MedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { listVisibleCategories } from "../../../../utils/blog/store-queries"
import { requestLocale } from "../../../../utils/translations/request-locale"

/**
 * `GET /store/blog/categories?locale=de-DE`
 *
 * Categories that have at least one published article, with that count and
 * their name in the visitor's language, for the filter bar on the blog page.
 */
export async function GET(req: MedusaRequest, res: MedusaResponse) {
  const categories = await listVisibleCategories(req.scope, requestLocale(req))

  return res.json({ categories })
}
