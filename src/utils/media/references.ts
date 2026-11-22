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
 * Stops at characters that cannot be part of a stored file URL: quotes and
 * angle brackets (HTML attributes, JSON strings), a backslash (escaped JSON),
 * whitespace, and the query or fragment of a URL.
 */
const STATIC_REF = /\/static\/([^\s"'<>\\?#`]+)/g

/** Characters a URL can be followed by in prose, CSS or Markdown. */
const TRAILING_PUNCTUATION = /[),.;:!\]]+$/

function safeDecode(value: string): string {
  try {
    return decodeURIComponent(value)
  } catch {
    return value
  }
}

/**
 * Every file path that `text` refers to under `/static/`, in each spelling it
 * might have on disk: as written, URL-decoded (`%20` → space), and without
 * punctuation that may follow a URL (`url(/static/a.jpg)`). Comparing these
 * against the real file names means an extra spelling can never mark a file
 * that does not exist, and a file is kept if any spelling matches.
 */
export function extractStaticReferences(text: string): Set<string> {
  const found = new Set<string>()
  if (!text || text.indexOf("/static/") === -1) return found

  for (const match of text.matchAll(STATIC_REF)) {
    const raw = match[1]
    const trimmed = raw.replace(TRAILING_PUNCTUATION, "")
    for (const candidate of [raw, trimmed]) {
      if (!candidate) continue
      found.add(candidate)
      found.add(safeDecode(candidate))
    }
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
