import { createStep, StepResponse } from "@medusajs/framework/workflows-sdk"
import { BLOG_MODULE } from "../../modules/blog"
import BlogModuleService from "../../modules/blog/service"

export type CreateBlogCategoryStepInput = {
  name: string
  handle: string
  locale?: string
  description?: string | null
  seo_title?: string | null
  seo_description?: string | null
  metadata?: Record<string, unknown> | null
}

export const createBlogCategoryStep = createStep(
  "create-blog-category",
  async (input: CreateBlogCategoryStepInput, { container }) => {
    const blogModuleService: BlogModuleService = container.resolve(BLOG_MODULE)

    const created = await blogModuleService.createBlogCategories({ ...input })
    const category = Array.isArray(created) ? created[0] : created

    return new StepResponse(category, category.id)
  },
  async (categoryId, { container }) => {
    if (!categoryId) {
      return
    }

    const blogModuleService: BlogModuleService = container.resolve(BLOG_MODULE)
    await blogModuleService.deleteBlogCategories(categoryId)
  }
)
