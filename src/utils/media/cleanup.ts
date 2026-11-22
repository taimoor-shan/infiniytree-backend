import { MediaCleanupMode, MediaSettings } from "./config"
import { moveToTrash, purgeExpiredTrash } from "./files"
import { buildMediaReport } from "./library"
import { RawQueryRunner } from "./scan"

export type CleanupSummary = {
  mode: MediaCleanupMode
  unused_count: number
  unused_bytes: number
  /** Names moved to the trash (only in "trash" mode). */
  trashed: string[]
  /** Trash items deleted for good because they passed the retention period. */
  purged: string[]
}

type Logger = { info: (msg: string) => void; warn: (msg: string) => void }

/**
 * The nightly cleanup, also behind the admin's "Clean up now".
 *
 * - "off": does nothing.
 * - "report": scans and logs what it would move. Touches nothing.
 * - "trash": moves unused uploads older than the grace period to the trash,
 *   then deletes trash older than the retention period.
 */
export async function runMediaCleanup(
  db: RawQueryRunner,
  settings: MediaSettings,
  options: { mode?: MediaCleanupMode; now?: Date; logger?: Logger } = {}
): Promise<CleanupSummary> {
  const mode = options.mode ?? settings.mode
  const now = options.now ?? new Date()
  const log = options.logger

  const summary: CleanupSummary = {
    mode,
    unused_count: 0,
    unused_bytes: 0,
    trashed: [],
    purged: [],
  }
  if (mode === "off") return summary

  const report = await buildMediaReport(db, settings, now)
  const unused = report.files.filter((f) => f.status === "unused")
  summary.unused_count = unused.length
  summary.unused_bytes = unused.reduce((sum, f) => sum + f.size, 0)

  if (mode === "report") {
    log?.info(
      `[media] ${unused.length} unused upload(s), ${summary.unused_bytes} bytes. ` +
        `Report only (MEDIA_CLEANUP_MODE=report), nothing moved.` +
        (unused.length ? ` First: ${unused.slice(0, 20).map((f) => f.name).join(", ")}` : "")
    )
    return summary
  }

  const { moved } = await moveToTrash(
    settings.uploadDir,
    settings.trashDir,
    unused.map((f) => f.name),
    now
  )
  summary.trashed = moved.map((m) => m.name)

  const purged = await purgeExpiredTrash(settings.trashDir, settings.trashRetentionDays, now)
  summary.purged = purged.map((p) => p.id)

  log?.info(
    `[media] moved ${summary.trashed.length} unused upload(s) to the trash, ` +
      `deleted ${summary.purged.length} trash item(s) older than ${settings.trashRetentionDays} days.`
  )
  return summary
}
