import { MedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { BLOG_MODULE } from "../../../../../modules/blog"
import BlogModuleService from "../../../../../modules/blog/service"
import deleteBlogPostWorkflow from "../../../../../workflows/delete-blog-post"
import updateBlogPostWorkflow from "../../../../../workflows/update-blog-post"
import { revalidateStorefrontCache } from "../../../../../utils/revalidate-cache"
import { UpdateBlogPostSchema } from "../../middlewares"

export async function GET(req: MedusaRequest, res: MedusaResponse) {
  const blogModuleService: BlogModuleService = req.scope.resolve(BLOG_MODULE)
  const { id } = req.params

  const post = await blogModuleService.retrieveBlogPost(id, {
    relations: ["categories"],
  })

  return res.json({ post })
}

export async function POST(
  req: MedusaRequest<UpdateBlogPostSchema>,
  res: MedusaResponse
) {
  const { id } = req.params

  await updateBlogPostWorkflow(req.scope).run({
    input: {
      id,
      data: req.validatedBody,
    },
  })

  const blogModuleService: BlogModuleService = req.scope.resolve(BLOG_MODULE)
  const post = await blogModuleService.retrieveBlogPost(id, {
    relations: ["categories"],
  })

  const logger = req.scope.resolve("logger")
  // Invalidate storefront blog cache
  await revalidateStorefrontCache(["blog"], logger)

  return res.status(200).json({ post })
}

export async function DELETE(req: MedusaRequest, res: MedusaResponse) {
  const { id } = req.params

  await deleteBlogPostWorkflow(req.scope).run({
    input: { id },
  })

  const logger = req.scope.resolve("logger")
  // Invalidate storefront blog cache
  await revalidateStorefrontCache(["blog"], logger)

  return res.status(200).json({ id })
}
