/**
 * Small text helpers for the blog module. Pure, so they are unit-tested
 * (`src/utils/__tests__/blog-text.unit.spec.ts`).
 */

/** Words per minute used for the "N min read" estimate. */
const READING_SPEED_WPM = 200

/** Editor HTML as plain text: tags become spaces, common entities are decoded. */
export function stripHtml(html: string): string {
  return html
    .replace(/<[^>]*>/g, " ")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&(?:lt|gt|quot|#39);/g, " ")
    .replace(/\s+/g, " ")
    .trim()
}

/**
 * Whole minutes needed to read an article, never less than one. Returns null
 * for an empty body so the storefront shows no reading time at all rather than
 * "1 min read" on a blank article.
 */
export function computeReadingTime(
  html: string | null | undefined
): number | null {
  if (!html) {
    return null
  }

  const words = stripHtml(html).split(" ").filter(Boolean).length

  if (!words) {
    return null
  }

  return Math.max(1, Math.ceil(words / READING_SPEED_WPM))
}

/**
 * Escapes `%`, `_` and `\` so a search term is matched literally inside a
 * `LIKE` / `ILIKE` pattern instead of acting as a wildcard.
 */
export function escapeLike(value: string): string {
  return value.replace(/[\\%_]/g, "\\$&")
}
