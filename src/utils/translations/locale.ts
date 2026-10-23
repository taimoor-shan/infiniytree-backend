/**
 * Which language to show a visitor.
 *
 * `rankLocale` orders a candidate language by how well it suits the visitor's:
 *
 *   0  the exact locale              de-AT  for a de-AT visitor
 *   1  the bare language             de
 *   2  another variant of it         de-DE  for a de-AT visitor, so German
 *                                    written once serves every German market
 *   3  English
 *   4  any other language
 *
 * Ranks 0 to 2 are "the visitor's own language". A record written in it is
 * shown as it is; any other record is shown in its own language unless a
 * translation of it into the visitor's language exists (see `apply.ts`).
 */

export const SAME_LANGUAGE_MAX_RANK = 2
export const ENGLISH_RANK = 3
export const FOREIGN_RANK = 4

/** Lower is better. */
export function rankLocale(
  candidate: string | null | undefined,
  requested: string | null | undefined
): number {
  const want = (requested || "en").toLowerCase()
  const have = (candidate || "en").toLowerCase()
  const language = want.split("-")[0]

  if (have === want) return 0
  if (have === language) return 1
  if (have.startsWith(`${language}-`)) return 2
  if (have === "en" || have.startsWith("en-")) return ENGLISH_RANK

  return FOREIGN_RANK
}

/** True when `candidate` is the visitor's own language, in any variant. */
export function isSameLanguage(
  candidate: string | null | undefined,
  requested: string | null | undefined
): boolean {
  return rankLocale(candidate, requested) <= SAME_LANGUAGE_MAX_RANK
}

const compareText = (a: string, b: string): number =>
  a < b ? -1 : a > b ? 1 : 0

/**
 * The best record for the visitor among records that share a slug: one written
 * in their language if there is one, else English, else any. Ties go to the
 * lowest locale code, then to the oldest record (ids sort by creation time), so
 * the answer does not depend on the order records come back in.
 *
 * Two records with the same slug *and* language are a mistake in the data,
 * usually a copy meant for another language that was saved as English. The
 * original is the one that has been serving visitors, so it keeps doing so.
 */
export function pickBestRecord<
  T extends { id?: string; locale?: string | null },
>(records: T[], requested: string | null | undefined): T | undefined {
  let best: { record: T; rank: number } | undefined

  for (const record of records) {
    const rank = rankLocale(record.locale, requested)

    if (
      !best ||
      (rank - best.rank ||
        compareText(record.locale ?? "en", best.record.locale ?? "en") ||
        compareText(record.id ?? "", best.record.id ?? "")) < 0
    ) {
      best = { record, rank }
    }
  }

  return best?.record
}

/**
 * The translation that suits the visitor best: the exact locale, then the
 * bare language, then another variant of it. Rows in other languages are never
 * chosen (a Hungarian translation does not serve a German visitor). Ties
 * between variants go to the lowest locale code, so the answer is stable.
 */
export function pickBestTranslation<T extends { locale_code: string }>(
  rows: T[] | undefined,
  requested: string | null | undefined
): T | undefined {
  let best: { row: T; rank: number } | undefined

  for (const row of rows ?? []) {
    const rank = rankLocale(row.locale_code, requested)

    if (rank > SAME_LANGUAGE_MAX_RANK) {
      continue
    }

    if (
      !best ||
      rank < best.rank ||
      (rank === best.rank && row.locale_code < best.row.locale_code)
    ) {
      best = { row, rank }
    }
  }

  return best?.row
}

/** The language part of a locale code: `de-AT` is `de`. */
export const languageOf = (locale: string): string =>
  locale.split("-")[0].toLowerCase()
