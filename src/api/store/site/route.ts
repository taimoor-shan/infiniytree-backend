import { MedusaRequest, MedusaResponse } from "@medusajs/framework/http"

export async function GET(req: MedusaRequest, res: MedusaResponse) {
  const query = req.scope.resolve("query")

  const { data: stores } = await query.graph({
    entity: "store",
    fields: ["id", "name", "metadata"],
    pagination: {
      take: 1,
      skip: 0,
    },
  })

  const store = stores?.[0] || null

  return res.json({ store })
}
