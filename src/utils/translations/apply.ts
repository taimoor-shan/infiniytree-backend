import { Modules } from "@medusajs/framework/utils"
import {
  isSameLanguage,
  pickBestRecord,
  pickBestTranslation,
} from "./locale"

/**
 * Applying stored translations to records read for the storefront.
 *
 * Translations live in Medusa's Translation module, one row per record and
 * locale holding `{ field: translated text }` (the same store products use).
 * Medusa can apply them itself (`query.graph(..., { locale })`), but only for
 * the exact locale. Here a visitor falls back from `de-AT` to a `de-DE`
 * translation, and a record already written in the visitor's language is left
 * alone, so this does the choosing and the merging itself.
 */

type Container = { resolve: (key: string) => any }

export type TranslationRow = {
  id?: string
  reference_id: string
  locale_code: string
  translations: Record<string, unknown> | null
}

const BATCH = 200

/**
 * Every translation row for the given records, grouped by record id. Returns
 * an empty map when the Translation module is not enabled, so translated
 * content simply shows in its original language.
 */
export async function loadTranslationRows(
  container: Container,
  referenceIds: string[]
): Promise<Map<string, TranslationRow[]>> {
  const byId = new Map<string, TranslationRow[]>()
  const ids = Array.from(new Set(referenceIds.filter(Boolean)))

  if (!ids.length) {
    return byId
  }

  let service: any

  try {
    service = container.resolve(Modules.TRANSLATION)
  } catch {
    return byId
  }

  for (let start = 0; start < ids.length; start += BATCH) {
    const rows: TranslationRow[] = await service.listTranslations(
      { reference_id: ids.slice(start, start + BATCH) },
      { take: 5000 }
    )

    for (const row of rows) {
      const list = byId.get(row.reference_id)

      if (list) {
        list.push(row)
      } else {
        byId.set(row.reference_id, [row])
      }
    }
  }

  return byId
}

/**
 * `record` with the translated text of `row` laid over it. Only fields the
 * record already has as text are replaced, and a blank translation never
 * erases the original. `locale` becomes the language now being shown.
 */
export function mergeTranslation<T extends Record<string, any>>(
  record: T,
  row: TranslationRow | undefined
): T {
  if (!row?.translations) {
    return record
  }

  const merged: Record<string, any> = { ...record }

  for (const [key, value] of Object.entries(row.translations)) {
    if (
      typeof record[key] === "string" &&
      typeof value === "string" &&
      value.trim() !== ""
    ) {
      merged[key] = value
    }
  }

  merged.locale = row.locale_code

  return merged as T
}

/**
 * The records in the visitor's language. A record written in it (or with no
 * locale to compare) is returned as it is; any other gets the best matching
 * translation, if it has one, and otherwise stays in its own language.
 */
export async function localizeRecords<
  T extends { id: string; locale?: string | null }
>(
  container: Container,
  records: T[],
  requested: string | null | undefined
): Promise<T[]> {
  if (!requested) {
    return records
  }

  const toTranslate = records.filter(
    (record) => record && !isSameLanguage(record.locale, requested)
  )

  if (!toTranslate.length) {
    return records
  }

  const rows = await loadTranslationRows(
    container,
    toTranslate.map((record) => record.id)
  )

  return records.map((record) => {
    if (!record || isSameLanguage(record.locale, requested)) {
      return record
    }

    return mergeTranslation(
      record,
      pickBestTranslation(rows.get(record.id), requested)
    )
  })
}

/**
 * One record out of several that share a slug, in the visitor's language.
 *
 * Content written before translations existed is one record per language, so
 * the visitor's own language wins when a record exists in it, and is shown as
 * it is. Otherwise the best other record is used (English first) with the
 * visitor's translation of it laid over, so a page written once and translated
 * needs no second record and no second slug.
 */
export async function resolveLocalizedRecord<
  T extends { id: string; locale?: string | null }
>(
  container: Container,
  records: T[],
  requested: string | null | undefined
): Promise<T | undefined> {
  const best = pickBestRecord(records, requested)

  if (!best) {
    return undefined
  }

  const [localized] = await localizeRecords(container, [best], requested)

  return localized
}

/** The locale codes a record has at least one non-blank translation in. */
export function translatedLocales(rows: TranslationRow[] | undefined): string[] {
  return (rows ?? [])
    .filter((row) =>
      Object.values(row.translations ?? {}).some(
        (value) => typeof value === "string" && value.trim() !== ""
      )
    )
    .map((row) => row.locale_code)
    .sort()
}
