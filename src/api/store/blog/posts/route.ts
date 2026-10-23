import { MedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { listVisiblePosts } from "../../../../utils/blog/store-queries"
import { requestLocale } from "../../../../utils/translations/request-locale"

/**
 * `GET /store/blog/posts?locale=de-DE&category=plant-care&limit=12&offset=0`
 *
 * Published articles, newest first, with their text in the visitor's language
 * where a translation exists (the original otherwise). Cards only: no body.
 */
export async function GET(req: MedusaRequest, res: MedusaResponse) {
  const {
    category,
    limit = 12,
    offset = 0,
  } = req.validatedQuery as {
    category?: string
    limit?: number
    offset?: number
  }

  const { posts, count } = await listVisiblePosts(req.scope, {
    locale: requestLocale(req),
    category,
    limit,
    offset,
  })

  return res.json({
    posts,
    count,
    limit,
    offset,
  })
}
