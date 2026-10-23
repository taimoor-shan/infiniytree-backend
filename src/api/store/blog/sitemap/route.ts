import { MedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { listSitemapEntries } from "../../../../utils/blog/store-queries"

/**
 * `GET /store/blog/sitemap`
 *
 * Every published article and category handle with the last change time. The
 * handles are the same in every language, so the storefront's sitemap lists
 * each one once per market.
 */
export async function GET(req: MedusaRequest, res: MedusaResponse) {
  return res.json(await listSitemapEntries(req.scope))
}
