import { MedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { marketLinks, storefrontUrl } from "../../../utils/storefront-url"

/**
 * `GET /admin/storefront-links`
 *
 * Where the admin's "View page" button sends the editor: the storefront's base
 * address and its English and German market addresses (`markets` is null when
 * the store has no region yet, and the storefront then picks a market itself).
 * The base comes from `STOREFRONT_PUBLIC_URL`, the same setting the cache
 * refresh and the emails use.
 */
export async function GET(req: MedusaRequest, res: MedusaResponse) {
  const query = req.scope.resolve("query")

  const { data: regions } = await query.graph({
    entity: "region",
    fields: ["id", "countries.iso_2"],
  })

  const base = storefrontUrl()

  return res.json({ base, markets: marketLinks(base, regions) })
}
