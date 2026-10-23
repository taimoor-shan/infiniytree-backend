import { MedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { resolveLocalizedRecord } from "../../../../utils/translations/apply"
import { requestLocale } from "../../../../utils/translations/request-locale"

const PAGE_FIELDS = [
  "id",
  "title",
  "slug",
  "locale",
  "content",
  "excerpt",
  "featured_image",
  "hero_video_url",
  "template",
  "seo_title",
  "seo_description",
  "status",
  "is_public",
  "metadata",
]

/**
 * `GET /store/pages/:slug?locale=de-DE`
 *
 * A published page in the visitor's language:
 *
 *  - A page is written once and translated (Translations box in the admin,
 *    stored by Medusa's Translation module like products' translations): the
 *    original comes back with the visitor's translation laid over it, and any
 *    field with no translation stays in the original language.
 *  - Pages created before that are one record per language with the same slug.
 *    A record in the visitor's own language (`de-AT` serves a `de-DE` visitor)
 *    is returned as it is, so existing content does not change until an editor
 *    deletes the duplicate in favour of a translation.
 *  - With neither, English, then whatever language the page has.
 *
 * (`src/utils/translations/apply.ts`.)
 *
 * No such page: 200 with `page: null`, not 404. The storefront caches this
 * response in Next.js's data cache, which only ever stores 200s, so after an
 * editor unpublishes or deletes a page a 404 would never replace the cached
 * copy and the page would stay online. `retrievePageBySlug` already returns
 * null for a missing page, so the storefront needs no change.
 */
export async function GET(req: MedusaRequest, res: MedusaResponse) {
  const query = req.scope.resolve("query")
  const { slug } = req.params

  // `req.locale`, not `req.query.locale`: Medusa's `applyLocale` middleware
  // moves it there and deletes it from the query (see `request-locale.ts`).
  const locale = requestLocale(req) || "en"

  const { data: records } = await query.graph({
    entity: "page",
    fields: PAGE_FIELDS,
    filters: {
      slug,
      status: "published",
      is_public: true,
    },
  })

  const page = await resolveLocalizedRecord(req.scope, records, locale)

  return res.json({ page: page ?? null })
}
