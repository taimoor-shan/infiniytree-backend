/**
 * A URL-safe handle from free text, the way WordPress makes a permalink from a
 * title: "Caring for Olive Trees!" becomes "caring-for-olive-trees".
 *
 * Accents are dropped (Büro becomes buro, Pflanzenpflege für Büro becomes
 * pflanzenpflege-fur-buro) and ß becomes ss, so German and Hungarian titles
 * give a clean handle too.
 */
export const slugify = (value: string): string =>
  value
    .normalize("NFKD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/ß/g, "ss")
    .replace(/&/g, " and ")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
