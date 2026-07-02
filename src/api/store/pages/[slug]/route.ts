import { MedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { MedusaError } from "@medusajs/framework/utils"

export async function GET(req: MedusaRequest, res: MedusaResponse) {
  const query = req.scope.resolve("query")
  const { slug } = req.params

  const { data: pages } = await query.graph({
    entity: "page",
    fields: [
      "id",
      "title",
      "slug",
      "content",
      "excerpt",
      "featured_image",
      "seo_title",
      "seo_description",
      "status",
      "is_public",
      "metadata",
    ],
    filters: {
      slug,
      status: "published",
      is_public: true,
    },
    pagination: {
      take: 1,
      skip: 0,
    },
  })

  if (!pages?.length) {
    throw new MedusaError(MedusaError.Types.NOT_FOUND, "Page not found")
  }

  return res.json({ page: pages[0] })
}
