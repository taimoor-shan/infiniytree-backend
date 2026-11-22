import { MedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { getMediaSettings } from "../../../../../utils/media/config"
import { MediaPathError, deleteFromTrash } from "../../../../../utils/media/files"
import { clearMediaReport } from "../../../../../utils/media/report-cache"
import { PostAdminMediaTrashIdsSchema } from "../../middlewares"

/** Deletes trash items for good (the off-site backup may still hold them). */
export async function POST(
  req: MedusaRequest<PostAdminMediaTrashIdsSchema>,
  res: MedusaResponse
) {
  const settings = getMediaSettings()
  try {
    const result = await deleteFromTrash(settings.trashDir, req.validatedBody.ids)
    clearMediaReport()
    return res.json(result)
  } catch (error) {
    if (error instanceof MediaPathError) {
      return res.status(400).json({ type: "invalid_data", message: error.message })
    }
    throw error
  }
}
