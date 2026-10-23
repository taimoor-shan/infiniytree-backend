import { MedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { retrieveVisiblePost } from "../../../../../utils/blog/store-queries"
import { requestLocale } from "../../../../../utils/translations/request-locale"

/**
 * `GET /store/blog/posts/:handle?locale=de-DE`
 *
 * One published article with its body, in the visitor's language where a
 * translation exists. `post.locale` is the language the text is in, and
 * `locales` lists every language the article is available in.
 *
 * A post that does not exist, is a draft or is scheduled for later answers
 * 200 with `post: null`, not 404. The storefront caches these responses in
 * Next.js's data cache, which only ever stores 200s: after an editor
 * unpublishes a post, a 404 would never replace the cached copy and the post
 * would stay online. The storefront turns `null` into its own 404 page.
 */
export async function GET(req: MedusaRequest, res: MedusaResponse) {
  const { handle } = req.params

  const found = await retrieveVisiblePost(req.scope, handle, requestLocale(req))

  return res.json(found ?? { post: null, locales: [] })
}
