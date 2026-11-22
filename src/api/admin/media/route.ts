import { MedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { ContainerRegistrationKeys } from "@medusajs/framework/utils"
import { getMediaReport } from "../../../utils/media/report-cache"
import { GetAdminMediaSchema } from "./middlewares"

/**
 * The Media library: every file in the upload folder, where it is used, and
 * totals for the folder, the trash and the disk.
 */
export async function GET(
  req: MedusaRequest<unknown, GetAdminMediaSchema>,
  res: MedusaResponse
) {
  const { q, status = "all", refresh } = req.validatedQuery as GetAdminMediaSchema
  const limit = (req.validatedQuery as GetAdminMediaSchema).limit ?? 50
  const offset = (req.validatedQuery as GetAdminMediaSchema).offset ?? 0

  const db = req.scope.resolve(ContainerRegistrationKeys.PG_CONNECTION)
  const report = await getMediaReport(db, { refresh })

  const needle = q?.trim().toLowerCase()
  const filtered = report.files.filter(
    (file) =>
      (status === "all" || file.status === status) &&
      (!needle || file.name.toLowerCase().includes(needle))
  )

  return res.json({
    files: filtered.slice(offset, offset + limit),
    count: filtered.length,
    limit,
    offset,
    stats: report.stats,
    settings: report.settings,
    scanned_at: report.scanned_at,
  })
}
