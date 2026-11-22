import { MediaSettings } from "./config"
import { MediaFile, diskSpace, listFiles, listTrash } from "./files"
import { isManagedUpload, selectOrphans } from "./references"
import { MediaUsage, RawQueryRunner, scanDatabaseReferences } from "./scan"

/**
 * One file as the Media library and the cleanup see it.
 *
 * - `used`: something in the database points at it.
 * - `unused`: nothing does, and the cleanup may move it to the trash.
 * - `recent`: nothing does yet, but it is younger than the grace period (a
 *   picture uploaded for something not saved yet).
 * - `protected`: not named like an upload (the invoice logo, a file put there
 *   by hand, a private import file). Never moved automatically.
 */
export type MediaStatus = "used" | "unused" | "recent" | "protected"

export type MediaEntry = {
  name: string
  /** Same-origin address, as the storefront serves it. */
  path: string
  /** The address Medusa's file provider gives the file (BACKEND_PUBLIC_URL + path). */
  url: string
  size: number
  modified_at: Date
  status: MediaStatus
  usage_count: number
  usages: MediaUsage[]
}

export type MediaReport = {
  files: MediaEntry[]
  stats: {
    file_count: number
    total_bytes: number
    used_count: number
    unused_count: number
    unused_bytes: number
    recent_count: number
    protected_count: number
    trash_count: number
    trash_bytes: number
    disk: { total_bytes: number; free_bytes: number } | null
  }
  settings: {
    mode: MediaSettings["mode"]
    min_age_days: number
    trash_retention_days: number
  }
  scanned_at: Date
}

export function staticPath(name: string): string {
  return `/static/${name.split("/").map(encodeURIComponent).join("/")}`
}

/** The origin medusa-config.ts gives the local file provider. */
export function publicOrigin(env: NodeJS.ProcessEnv = process.env): string {
  return (env.BACKEND_PUBLIC_URL || "http://localhost:9000").replace(/\/+$/, "")
}

export function classifyFiles(
  files: MediaFile[],
  references: Map<string, MediaUsage[]>,
  now: Date,
  minAgeDays: number
): MediaEntry[] {
  const isUsed = (name: string) => references.has(name)
  const orphans = new Set(selectOrphans(files, isUsed, now, minAgeDays).map((f) => f.name))

  return files.map((file) => {
    const usages = references.get(file.name) || []
    let status: MediaStatus
    if (usages.length) status = "used"
    else if (orphans.has(file.name)) status = "unused"
    else if (!isManagedUpload(file.name)) status = "protected"
    else status = "recent"
    return {
      name: file.name,
      path: staticPath(file.name),
      url: `${publicOrigin()}${staticPath(file.name)}`,
      size: file.size,
      modified_at: file.modified_at,
      status,
      usage_count: usages.length,
      usages,
    }
  })
}

export async function buildMediaReport(
  db: RawQueryRunner,
  settings: MediaSettings,
  now: Date = new Date()
): Promise<MediaReport> {
  const [files, references, trash, disk] = await Promise.all([
    listFiles(settings.uploadDir),
    scanDatabaseReferences(db),
    listTrash(settings.trashDir),
    diskSpace(settings.uploadDir),
  ])

  const entries = classifyFiles(files, references, now, settings.minAgeDays).sort(
    (a, b) => b.modified_at.getTime() - a.modified_at.getTime()
  )

  const count = (status: MediaStatus) => entries.filter((e) => e.status === status)
  const unused = count("unused")

  return {
    files: entries,
    stats: {
      file_count: entries.length,
      total_bytes: entries.reduce((sum, e) => sum + e.size, 0),
      used_count: count("used").length,
      unused_count: unused.length,
      unused_bytes: unused.reduce((sum, e) => sum + e.size, 0),
      recent_count: count("recent").length,
      protected_count: count("protected").length,
      trash_count: trash.length,
      trash_bytes: trash.reduce((sum, t) => sum + t.size, 0),
      disk,
    },
    settings: {
      mode: settings.mode,
      min_age_days: settings.minAgeDays,
      trash_retention_days: settings.trashRetentionDays,
    },
    scanned_at: now,
  }
}
