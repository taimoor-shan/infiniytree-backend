import { createStep, StepResponse } from "@medusajs/framework/workflows-sdk"
import { BLOG_MODULE } from "../../modules/blog"
import BlogModuleService from "../../modules/blog/service"

export type DeleteBlogPostStepInput = {
  id: string
}

export const deleteBlogPostStep = createStep(
  "delete-blog-post",
  async (input: DeleteBlogPostStepInput, { container }) => {
    const blogModuleService: BlogModuleService = container.resolve(BLOG_MODULE)

    const previous = await blogModuleService.retrieveBlogPost(input.id, {
      relations: ["categories"],
    })

    await blogModuleService.deleteBlogPosts(input.id)

    return new StepResponse({ id: input.id }, previous)
  },
  async (previous, { container }) => {
    if (!previous) {
      return
    }

    const blogModuleService: BlogModuleService = container.resolve(BLOG_MODULE)
    const { categories, created_at, updated_at, deleted_at, ...fields } =
      previous

    await blogModuleService.createBlogPosts({
      ...fields,
      categories: (categories ?? []).map((category) => category.id),
    })
  }
)
