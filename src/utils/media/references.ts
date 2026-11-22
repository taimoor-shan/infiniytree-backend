/**
 * Finding uploaded files in text.
 *
 * Every upload is served at `/static/<file>` and that address (usually with the
 * backend's origin in front) is what the database stores: a product image's
 * `url`, a page's `featured_image`, a picture inside a blog post's HTML, a
 * metadata JSON value, an order line's thumbnail. So "is this file used?" is
 * "does `/static/<file>` appear anywhere in the database?".
 *
 * The functions here are pure, so they are unit tested without a database.
 */

/**
 * The file part after `/static/`. It stops at characters that cannot be part
 * of a stored file URL: double quotes and angle brackets (HTML attributes,
 * JSON strings), a backslash (escaped JSON), whitespace, and the query or
 * fragment of a URL. An apostrophe does not stop it, because an upload can be
 * named `kid's.jpg` and `encodeURIComponent` leaves `'` as it is; the spellings
 * cut at each apostrophe are added as candidates instead, which covers a URL
 * in a single-quoted attribute.
 */
const FILE_PART = /^[^\s"<>\\?#`]+/

/** Characters a URL can be followed by in prose, CSS or Markdown. */
const TRAILING_PUNCTUATION = /[),.;:!\]']+$/

function safeDecode(value: string): string {
  try {
    return decodeURIComponent(value)
  } catch {
    return value
  }
}

/**
 * Every file path that `text` refers to under `/static/`, in each spelling it
 * might have on disk: as written, URL-decoded (`%20` → space), cut at an
 * apostrophe, and without punctuation that may follow a URL
 * (`url(/static/a.jpg)`). Comparing these against the real file names means
 * an extra spelling can never mark a file that does not exist, and a file is
 * kept if any spelling matches. Each `/static/` is read on its own, so two
 * URLs that run together (`'/static/a.jpg','/static/b.jpg'`) are both found.
 */
export function extractStaticReferences(text: string): Set<string> {
  const found = new Set<string>()
  if (!text) return found

  const marker = "/static/"
  let at = text.indexOf(marker)
  while (at !== -1) {
    const match = FILE_PART.exec(text.slice(at + marker.length, at + marker.length + 2048))
    if (match) {
      const raw = match[0]
      const candidates = new Set<string>([raw, raw.replace(TRAILING_PUNCTUATION, "")])
      let quote = raw.indexOf("'")
      while (quote > 0) {
        const cut = raw.slice(0, quote)
        candidates.add(cut)
        candidates.add(cut.replace(TRAILING_PUNCTUATION, ""))
        quote = raw.indexOf("'", quote + 1)
      }
      for (const candidate of candidates) {
        if (!candidate) continue
        found.add(candidate)
        found.add(safeDecode(candidate))
      }
    }
    at = text.indexOf(marker, at + marker.length)
  }
  return found
}

/**
 * Medusa's local file provider names every upload `<Date.now()>-<original
 * name>`. The cleanup only ever touches files named like that, so a file
 * someone put in the folder by hand (the invoice logo, a seed picture) is never
 * moved, whatever the database says.
 */
const UPLOAD_NAME = /^\d{13}-.+/

export function isManagedUpload(relativePath: string): boolean {
  const base = relativePath.split("/").pop() || ""
  return UPLOAD_NAME.test(base)
}

/** The upload time encoded in the file name, when it has one. */
export function uploadTimeFromName(relativePath: string): Date | null {
  const base = relativePath.split("/").pop() || ""
  const match = /^(\d{13})-/.exec(base)
  if (!match) return null
  const ms = Number(match[1])
  return Number.isFinite(ms) ? new Date(ms) : null
}

export type CleanupCandidate = {
  name: string
  size: number
  modified_at: Date
}

/**
 * Which files the cleanup may move to the trash: a managed upload, used by
 * nothing, and older than `minAgeDays` by both its name and its modification
 * time (so a picture uploaded for a draft that is not saved yet is safe for a
 * week).
 */
export function selectOrphans<T extends CleanupCandidate>(
  files: T[],
  isUsed: (name: string) => boolean,
  now: Date,
  minAgeDays: number
): T[] {
  const cutoff = now.getTime() - minAgeDays * 24 * 60 * 60 * 1000
  return files.filter((file) => {
    if (!isManagedUpload(file.name)) return false
    if (isUsed(file.name)) return false
    if (file.modified_at.getTime() > cutoff) return false
    const uploaded = uploadTimeFromName(file.name)
    if (uploaded && uploaded.getTime() > cutoff) return false
    return true
  })
}
