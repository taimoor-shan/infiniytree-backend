/**
 * Splitting a long article so it can be machine-translated.
 *
 * A translation provider answers in one response, and the Gemini provider's
 * reply is capped at 8,192 tokens, so a long article cannot be sent whole: its
 * answer would be cut off mid-JSON and fail. The body is split at the
 * boundaries between top-level blocks (paragraphs, headings, lists, tables),
 * the pieces are translated one request at a time and joined again, so no tag
 * is ever torn apart. Pure, so it is unit-tested.
 */

const VOID_TAGS = new Set(["br", "hr", "img", "input", "meta", "link", "source", "col", "wbr"])

/** Top-level blocks of an HTML string, in order, with nothing lost. */
export function splitHtmlBlocks(html: string): string[] {
  const blocks: string[] = []
  const tag = /<(\/?)([a-zA-Z][a-zA-Z0-9-]*)\b[^>]*?(\/?)>/g

  let depth = 0
  let blockStart = 0
  let match: RegExpExecArray | null

  while ((match = tag.exec(html))) {
    const [, closing, name, selfClosing] = match
    const isVoid = VOID_TAGS.has(name.toLowerCase()) || selfClosing === "/"
    const end = match.index + match[0].length

    if (closing) {
      depth = Math.max(0, depth - 1)
    } else if (!isVoid) {
      depth += 1
    }

    // A block ends where the nesting returns to the top level.
    if (depth === 0 && (closing || isVoid)) {
      blocks.push(html.slice(blockStart, end))
      blockStart = end
    }
  }

  // Text after the last tag, or a body with no tags at all.
  if (blockStart < html.length) {
    blocks.push(html.slice(blockStart))
  }

  return blocks.filter((block) => block !== "")
}

/**
 * `html` as pieces of at most about `maxChars` characters, cut only between
 * top-level blocks. A single block longer than the limit stays whole (it
 * cannot be cut safely). Joining the pieces gives back exactly `html`.
 */
export function chunkHtml(html: string, maxChars: number): string[] {
  if (html.length <= maxChars) {
    return [html]
  }

  const chunks: string[] = []
  let current = ""

  for (const block of splitHtmlBlocks(html)) {
    if (current && current.length + block.length > maxChars) {
      chunks.push(current)
      current = ""
    }

    current += block
  }

  if (current) {
    chunks.push(current)
  }

  return chunks
}
