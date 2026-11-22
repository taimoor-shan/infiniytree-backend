import { MedusaContainer } from "@medusajs/framework/types"
import { ContainerRegistrationKeys } from "@medusajs/framework/utils"
import { getMediaSettings } from "../utils/media/config"
import { runMediaCleanup } from "../utils/media/cleanup"

/**
 * Nightly media cleanup (see "Media library" in CLAUDE.md).
 *
 * MEDIA_CLEANUP_MODE decides what it does: "report" (default) only logs the
 * unused uploads, "trash" moves them to the trash and empties trash older
 * than MEDIA_TRASH_RETENTION_DAYS, "off" skips it.
 */
export default async function mediaCleanupJob(container: MedusaContainer) {
  const logger = container.resolve(ContainerRegistrationKeys.LOGGER)
  const db = container.resolve(ContainerRegistrationKeys.PG_CONNECTION)
  try {
    await runMediaCleanup(db, getMediaSettings(), { logger })
  } catch (error: any) {
    logger.error(`[media] nightly cleanup failed: ${error?.message || error}`)
  }
}

export const config = {
  name: "media-cleanup",
  // 03:40 server time, away from the full hour other jobs use
  schedule: "40 3 * * *",
}
