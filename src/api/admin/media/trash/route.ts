import { MedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { ContainerRegistrationKeys } from "@medusajs/framework/utils"
import { getMediaSettings } from "../../../../utils/media/config"
import { MediaPathError, listTrash, moveToTrash } from "../../../../utils/media/files"
import { clearMediaReport, getMediaReport } from "../../../../utils/media/report-cache"
import { PostAdminMediaTrashSchema } from "../middlewares"

/** What is in the trash, newest first, and when each item will be deleted. */
export async function GET(req: MedusaRequest, res: MedusaResponse) {
  const settings = getMediaSettings()
  const items = await listTrash(settings.trashDir)
  const dayMs = 24 * 60 * 60 * 1000
  return res.json({
    items: items.map((item) => ({
      ...item,
      deletes_at: new Date(item.trashed_at.getTime() + settings.trashRetentionDays * dayMs),
    })),
    count: items.length,
    retention_days: settings.trashRetentionDays,
    mode: settings.mode,
  })
}

/**
 * Moves files to the trash. Checked against a fresh scan: a file that
 * something uses, or that is not an upload (the invoice logo, a private
 * import file), is refused and stays where it is.
 */
export async function POST(
  req: MedusaRequest<PostAdminMediaTrashSchema>,
  res: MedusaResponse
) {
  const { names } = req.validatedBody
  const settings = getMediaSettings()
  const db = req.scope.resolve(ContainerRegistrationKeys.PG_CONNECTION)
  const report = await getMediaReport(db, { refresh: true })
  const byName = new Map(report.files.map((f) => [f.name, f]))

  const refused: { name: string; reason: string }[] = []
  const allowed: string[] = []
  for (const name of names) {
    const file = byName.get(name)
    if (!file) refused.push({ name, reason: "not_found" })
    else if (file.status === "used") refused.push({ name, reason: "in_use" })
    else if (file.status === "protected") refused.push({ name, reason: "protected" })
    else allowed.push(name)
  }

  try {
    const { moved, missing } = await moveToTrash(settings.uploadDir, settings.trashDir, allowed)
    for (const name of missing) refused.push({ name, reason: "not_found" })
    clearMediaReport()
    return res.json({ moved, refused })
  } catch (error) {
    if (error instanceof MediaPathError) {
      return res.status(400).json({ type: "invalid_data", message: error.message })
    }
    throw error
  }
}
