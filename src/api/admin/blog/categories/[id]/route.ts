import { MedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { BLOG_MODULE } from "../../../../../modules/blog"
import BlogModuleService from "../../../../../modules/blog/service"
import deleteBlogCategoryWorkflow from "../../../../../workflows/delete-blog-category"
import updateBlogCategoryWorkflow from "../../../../../workflows/update-blog-category"
import { revalidateStorefrontCache } from "../../../../../utils/revalidate-cache"
import { UpdateBlogCategorySchema } from "../../middlewares"

export async function GET(req: MedusaRequest, res: MedusaResponse) {
  const blogModuleService: BlogModuleService = req.scope.resolve(BLOG_MODULE)
  const { id } = req.params

  const category = await blogModuleService.retrieveBlogCategory(id)

  return res.json({ category })
}

export async function POST(
  req: MedusaRequest<UpdateBlogCategorySchema>,
  res: MedusaResponse
) {
  const { id } = req.params

  const { result } = await updateBlogCategoryWorkflow(req.scope).run({
    input: {
      id,
      data: req.validatedBody,
    },
  })

  const logger = req.scope.resolve("logger")
  // Invalidate storefront blog cache
  await revalidateStorefrontCache(["blog"], logger)

  return res.status(200).json({ category: result.category })
}

export async function DELETE(req: MedusaRequest, res: MedusaResponse) {
  const { id } = req.params

  await deleteBlogCategoryWorkflow(req.scope).run({
    input: { id },
  })

  const logger = req.scope.resolve("logger")
  // Invalidate storefront blog cache
  await revalidateStorefrontCache(["blog"], logger)

  return res.status(200).json({ id })
}
