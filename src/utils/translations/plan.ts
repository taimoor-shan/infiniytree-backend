import { chunkHtml } from "./chunk-html"

/**
 * How content is sent to a translation provider.
 *
 * Short fields travel together in as few requests as possible. A long HTML
 * field is cut into pieces (see `chunk-html.ts`) so no single answer outgrows
 * the provider's reply limit, and put back together afterwards. Pure, so it is
 * unit-tested; the step that calls the provider just runs the plan.
 */

/** Characters per request. The Gemini reply cap is about 8,000 tokens. */
export const MAX_REQUEST_CHARS = 9000

export type PlanField = { key: string; text: string; html?: boolean }
export type ProviderField = { key: string; text: string }

const PART = "#"

const partKey = (key: string, index: number) => `${key}${PART}${index}`

export function planTranslation(
  fields: PlanField[],
  maxChars: number = MAX_REQUEST_CHARS
) {
  // Each field becomes one item, or several when it is long HTML.
  const items: ProviderField[] = []
  const parts = new Map<string, number>()

  for (const field of fields) {
    if (field.html && field.text.length > maxChars) {
      const chunks = chunkHtml(field.text, maxChars)

      parts.set(field.key, chunks.length)
      chunks.forEach((chunk, index) =>
        items.push({ key: partKey(field.key, index), text: chunk })
      )
    } else {
      items.push({ key: field.key, text: field.text })
    }
  }

  // Items are packed into requests in order, a new one when the next would
  // overflow. An item bigger than the limit goes alone.
  const requests: ProviderField[][] = []
  let current: ProviderField[] = []
  let size = 0

  for (const item of items) {
    if (current.length && size + item.text.length > maxChars) {
      requests.push(current)
      current = []
      size = 0
    }

    current.push(item)
    size += item.text.length
  }

  if (current.length) {
    requests.push(current)
  }

  return {
    requests,

    /** The provider's answers, one entry per sent key, as one per field. */
    reassemble(translated: Record<string, string>): Record<string, string> {
      const result: Record<string, string> = {}

      for (const field of fields) {
        const count = parts.get(field.key)

        if (count === undefined) {
          if (typeof translated[field.key] === "string") {
            result[field.key] = translated[field.key]
          }
          continue
        }

        const pieces = Array.from({ length: count }, (_, index) =>
          translated[partKey(field.key, index)]
        )

        // A missing piece would leave a hole in the article: skip the field.
        if (pieces.every((piece) => typeof piece === "string")) {
          result[field.key] = pieces.join("")
        }
      }

      return result
    },
  }
}
