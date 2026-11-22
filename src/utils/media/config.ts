import path from "path"

/**
 * Where uploads live and how the cleanup behaves. Read from the environment so
 * the API, the nightly job and the tests agree on one place.
 *
 * UPLOAD_DIR is the same variable `medusa-config.ts` hands to Medusa's local
 * file provider (required in production). Without it Medusa writes to
 * `<cwd>/static`, which is what `medusa-config.ts` resolves to as well.
 */
export type MediaCleanupMode = "off" | "report" | "trash"

export type MediaSettings = {
  uploadDir: string
  trashDir: string
  /** A file must be at least this old before the cleanup may move it. */
  minAgeDays: number
  /** Trash older than this is deleted for good. */
  trashRetentionDays: number
  mode: MediaCleanupMode
}

const DEFAULT_MIN_AGE_DAYS = 7
const DEFAULT_TRASH_RETENTION_DAYS = 30

function positiveNumber(value: string | undefined, fallback: number): number {
  if (value === undefined || value.trim() === "") return fallback
  const n = Number(value)
  return Number.isFinite(n) && n >= 0 ? n : fallback
}

export function parseCleanupMode(value: string | undefined): MediaCleanupMode {
  const v = (value || "").trim().toLowerCase()
  if (v === "off" || v === "trash") return v
  // Anything else, including nothing, only reports: moving files is opt-in.
  return "report"
}

export function resolveUploadDir(env: NodeJS.ProcessEnv = process.env): string {
  return env.UPLOAD_DIR
    ? path.resolve(env.UPLOAD_DIR)
    : path.resolve(process.cwd(), "static")
}

/**
 * The trash sits next to the upload folder, not inside it, so a trashed file
 * is no longer served under /static and the scan of the upload folder never
 * sees it. Override with MEDIA_TRASH_DIR (keep it on the same disk so a move
 * is a rename).
 */
export function resolveTrashDir(
  uploadDir: string,
  env: NodeJS.ProcessEnv = process.env
): string {
  if (env.MEDIA_TRASH_DIR) return path.resolve(env.MEDIA_TRASH_DIR)
  return path.join(path.dirname(uploadDir), `${path.basename(uploadDir)}-trash`)
}

export function getMediaSettings(
  env: NodeJS.ProcessEnv = process.env
): MediaSettings {
  const uploadDir = resolveUploadDir(env)
  return {
    uploadDir,
    trashDir: resolveTrashDir(uploadDir, env),
    minAgeDays: positiveNumber(env.MEDIA_ORPHAN_MIN_AGE_DAYS, DEFAULT_MIN_AGE_DAYS),
    trashRetentionDays: positiveNumber(
      env.MEDIA_TRASH_RETENTION_DAYS,
      DEFAULT_TRASH_RETENTION_DAYS
    ),
    mode: parseCleanupMode(env.MEDIA_CLEANUP_MODE),
  }
}
