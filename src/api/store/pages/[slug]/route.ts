import { MedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { MedusaError } from "@medusajs/framework/utils"

export async function GET(req: MedusaRequest, res: MedusaResponse) {
  const query = req.scope.resolve("query")
  const { slug } = req.params

  // Read locale from the request URL directly (Medusa v2 query parsing is unreliable
  // for dynamic routes without a validated query schema, even with middleware)
  const urlLocale = new URL(req.url, "http://localhost").searchParams.get("locale")
  const requestedLocale = urlLocale || "en"

  const baseFields = [
    "id",
    "title",
    "slug",
    "locale",
    "content",
    "excerpt",
    "featured_image",
    "seo_title",
    "seo_description",
    "status",
    "is_public",
    "metadata",
  ]

  const baseFilters = {
    slug,
    status: "published",
    is_public: true,
  }

  // 1. Try: exact locale match
  const { data: exactPages } = await query.graph({
    entity: "page",
    fields: baseFields,
    filters: {
      ...baseFilters,
      locale: requestedLocale,
    },
    pagination: { take: 1, skip: 0 },
  })

  if (exactPages?.length) {
    return res.json({ page: exactPages[0] })
  }

  // 2. Try: language-only fallback (e.g. "de-AT" → "de")
  const lang = requestedLocale.split("-")[0]
  if (lang !== requestedLocale) {
    const { data: langPages } = await query.graph({
      entity: "page",
      fields: baseFields,
      filters: {
        ...baseFilters,
        locale: lang,
      },
      pagination: { take: 1, skip: 0 },
    })

    if (langPages?.length) {
      return res.json({ page: langPages[0] })
    }
  }

  // 3. Fallback: English
  if (requestedLocale !== "en") {
    const { data: enPages } = await query.graph({
      entity: "page",
      fields: baseFields,
      filters: {
        ...baseFilters,
        locale: "en",
      },
      pagination: { take: 1, skip: 0 },
    })

    if (enPages?.length) {
      return res.json({ page: enPages[0] })
    }
  }

  // 4. Last resort: any page with this slug (regardless of locale)
  const { data: anyPages } = await query.graph({
    entity: "page",
    fields: baseFields,
    filters: baseFilters,
    pagination: { take: 1, skip: 0 },
  })

  if (!anyPages?.length) {
    throw new MedusaError(MedusaError.Types.NOT_FOUND, "Page not found")
  }

  return res.json({ page: anyPages[0] })
}
