import { ProviderField, planTranslation } from "./plan"

const KEY = "html"

/**
 * One HTML text translated with a provider's `translate` function: cut into
 * pieces when it is long (see `plan.ts`), sent piece by piece, and put back
 * together. Nothing is saved, so a failure half-way leaves no half text.
 *
 * Used for the product's long description, whose editor shows the result for
 * the editor to read before it is saved.
 */
export async function translateHtml(
  html: string,
  translate: (fields: ProviderField[]) => Promise<Record<string, string>>
): Promise<string> {
  const plan = planTranslation([{ key: KEY, text: html, html: true }])
  const answered: Record<string, string> = {}

  for (const request of plan.requests) {
    Object.assign(answered, await translate(request))
  }

  const translated = plan.reassemble(answered)[KEY]

  // A missing piece is left out by `reassemble` rather than put back with a
  // hole in it, so a field that is not there is a failed translation.
  if (typeof translated !== "string" || translated.trim() === "") {
    throw new Error("The translation service did not return the whole text.")
  }

  return translated
}
