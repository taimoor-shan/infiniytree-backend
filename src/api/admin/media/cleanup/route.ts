import { MedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { ContainerRegistrationKeys } from "@medusajs/framework/utils"
import { getMediaSettings } from "../../../../utils/media/config"
import { runMediaCleanup } from "../../../../utils/media/cleanup"
import { clearMediaReport } from "../../../../utils/media/report-cache"

/**
 * "Clean up now": what the nightly job does in "trash" mode, started by hand,
 * whatever MEDIA_CLEANUP_MODE says. Moves every unused upload past the grace
 * period to the trash and deletes expired trash.
 */
export async function POST(req: MedusaRequest, res: MedusaResponse) {
  const db = req.scope.resolve(ContainerRegistrationKeys.PG_CONNECTION)
  const logger = req.scope.resolve(ContainerRegistrationKeys.LOGGER)
  const summary = await runMediaCleanup(db, getMediaSettings(), { mode: "trash", logger })
  clearMediaReport()
  return res.json(summary)
}
