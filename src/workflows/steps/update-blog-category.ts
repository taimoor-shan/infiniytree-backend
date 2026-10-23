import { createStep, StepResponse } from "@medusajs/framework/workflows-sdk"
import { BLOG_MODULE } from "../../modules/blog"
import BlogModuleService from "../../modules/blog/service"

export type UpdateBlogCategoryStepInput = {
  id: string
  data: {
    name?: string
    handle?: string
    locale?: string
    description?: string | null
    seo_title?: string | null
    seo_description?: string | null
    metadata?: Record<string, unknown> | null
  }
}

export const updateBlogCategoryStep = createStep(
  "update-blog-category",
  async (input: UpdateBlogCategoryStepInput, { container }) => {
    const blogModuleService: BlogModuleService = container.resolve(BLOG_MODULE)

    const previous = await blogModuleService.retrieveBlogCategory(input.id)

    const updated = await blogModuleService.updateBlogCategories({
      id: input.id,
      ...input.data,
    })
    const category = Array.isArray(updated) ? updated[0] : updated

    return new StepResponse(category, previous)
  },
  async (previous, { container }) => {
    if (!previous) {
      return
    }

    const blogModuleService: BlogModuleService = container.resolve(BLOG_MODULE)
    // Posts are left out on purpose: this step never touches them.
    const { id, posts, created_at, updated_at, deleted_at, ...fields } =
      previous

    await blogModuleService.updateBlogCategories({ id, ...fields })
  }
)
