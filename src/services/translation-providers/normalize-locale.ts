/**
 * Strip region code from a locale string.
 *
 *   "de-AT" → "de"
 *   "en-US" → "en"
 *   "hu"    → "hu"
 *
 * Each provider decides for itself whether to call this.
 * Providers that support regional variants (e.g. a future provider
 * that distinguishes "de" from "de-AT") skip it and pass the full
 * locale through unchanged.
 */
export function normalizeLocale(locale: string): string {
  return locale.split("-")[0]
}
