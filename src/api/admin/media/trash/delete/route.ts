import { MedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { getMediaSettings } from "../../../../../utils/media/config"
import { MediaPathError, deleteFromTrash } from "../../../../../utils/media/files"
import { PostAdminMediaTrashIdsSchema } from "../../middlewares"

/** Deletes trash items for good (the off-site backup may still hold them). */
export async function POST(
  req: MedusaRequest<PostAdminMediaTrashIdsSchema>,
  res: MedusaResponse
) {
  const settings = getMediaSettings()
  try {
    return res.json(await deleteFromTrash(settings.trashDir, req.validatedBody.ids))
  } catch (error) {
    if (error instanceof MediaPathError) {
      return res.status(400).json({ type: "invalid_data", message: error.message })
    }
    throw error
  }
}
