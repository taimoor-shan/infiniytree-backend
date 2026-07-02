import { MedusaRequest, MedusaResponse } from "@medusajs/framework/http"

export async function GET(req: MedusaRequest, res: MedusaResponse) {
  const query = req.scope.resolve("query")
  const { q } = req.validatedQuery
  const limit = req.validatedQuery.limit ?? 20
  const offset = req.validatedQuery.offset ?? 0

  const filters: Record<string, unknown> = {
    status: "published",
    is_public: true,
  }

  if (q) {
    filters.title = { $like: `%${q}%` }
  }

  const { data: pages, metadata } = await query.graph({
    entity: "page",
    fields: [
      "id",
      "title",
      "slug",
      "excerpt",
      "featured_image",
      "seo_title",
      "seo_description",
      "status",
      "is_public",
      "metadata",
    ],
    filters,
    pagination: {
      take: limit,
      skip: offset,
      order: {
        created_at: "DESC",
      },
    },
  })

  return res.json({
    pages,
    count: metadata?.count ?? 0,
    limit,
    offset,
  })
}
