import { MedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { MedusaError, Modules } from "@medusajs/framework/utils"
import { PAGE_MODULE } from "../../../../../modules/page"
import PageModuleService from "../../../../../modules/page/service"
import { revalidateStorefrontCache } from "../../../../../utils/revalidate-cache"
import { requireContentType } from "../../../../../utils/translations/content-types"
import {
  knownLocaleCodes,
  providerStatus,
  resolveTargetLocales,
} from "../../../../../utils/translations/targets"
import deleteContentTranslationWorkflow from "../../../../../workflows/delete-content-translation"
import saveContentTranslationWorkflow from "../../../../../workflows/save-content-translation"
import { SaveContentTranslationSchema } from "../../middlewares"

/**
 * Pages written before translations existed are one record per language with
 * the same slug. They are shown instead of a translation (see
 * `resolveLocalizedRecord` in `src/utils/translations/apply.ts`), so the editor
 * is told about them.
 */
async function otherPageVersions(req: MedusaRequest, record: Record<string, any>) {
  const pages: PageModuleService = req.scope.resolve(PAGE_MODULE)
  const same = await pages.listPages({ slug: record.slug }, { take: 50 })

  return same
    .filter((page) => page.id !== record.id)
    .map((page) => ({ id: page.id, locale: page.locale, status: page.status }))
}

/**
 * `GET /admin/content-translations/:reference/:id`
 *
 * Everything the translation editor needs for one page, post or category: the
 * original text, which fields can be translated and how they are edited, the
 * languages to translate into, and the translations that exist.
 */
export async function GET(req: MedusaRequest, res: MedusaResponse) {
  const type = requireContentType(req.params.reference)
  const { id } = req.params

  const record = await type.retrieve(req.scope, id)
  const sourceLocale: string = record.locale || "en"

  const service = req.scope.resolve(Modules.TRANSLATION)
  const rows = await service.listTranslations(
    { reference: type.reference, reference_id: id },
    { take: 200 }
  )

  return res.json({
    reference: type.reference,
    id,
    source: {
      locale: sourceLocale,
      values: Object.fromEntries(
        type.fields.map((field) => [field.key, record[field.key] ?? ""])
      ),
    },
    fields: type.fields,
    target_locales: await resolveTargetLocales(req.scope, sourceLocale),
    translations: Object.fromEntries(
      rows.map((row: any) => [
        row.locale_code,
        {
          id: row.id,
          values: row.translations ?? {},
          updated_at: row.updated_at,
        },
      ])
    ),
    native_versions:
      type.reference === "page" ? await otherPageVersions(req, record) : [],
    provider: providerStatus(),
  })
}

/**
 * `POST /admin/content-translations/:reference/:id`
 *
 * Saves one language, from the editor's own translation or an edit of an
 * automatic one. A blank value removes that field's translation.
 */
export async function POST(
  req: MedusaRequest<SaveContentTranslationSchema>,
  res: MedusaResponse
) {
  const type = requireContentType(req.params.reference)
  const { id } = req.params
  const { locale, values } = req.validatedBody

  const known = await knownLocaleCodes(req.scope)

  if (known.length && !known.includes(locale)) {
    throw new MedusaError(
      MedusaError.Types.INVALID_DATA,
      `"${locale}" is not a locale of this store's translation module`
    )
  }

  await saveContentTranslationWorkflow(req.scope).run({
    input: { reference: type.reference, id, locales: [locale], values },
  })

  await revalidateStorefrontCache(type.cacheTags, req.scope.resolve("logger"))

  return res.status(200).json({ saved: locale })
}

/**
 * `DELETE /admin/content-translations/:reference/:id?locale=de-DE`
 *
 * Removes one language's translation. The original is untouched.
 */
export async function DELETE(req: MedusaRequest, res: MedusaResponse) {
  const type = requireContentType(req.params.reference)
  const { id } = req.params
  const { locale } = req.validatedQuery as { locale: string }

  await deleteContentTranslationWorkflow(req.scope).run({
    input: { reference: type.reference, id, locale },
  })

  await revalidateStorefrontCache(type.cacheTags, req.scope.resolve("logger"))

  return res.status(200).json({ deleted: locale })
}
