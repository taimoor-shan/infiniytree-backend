import { createStep, StepResponse } from "@medusajs/framework/workflows-sdk"
import { BLOG_MODULE } from "../../modules/blog"
import BlogModuleService from "../../modules/blog/service"

export type DeleteBlogCategoryStepInput = {
  id: string
}

export const deleteBlogCategoryStep = createStep(
  "delete-blog-category",
  async (input: DeleteBlogCategoryStepInput, { container }) => {
    const blogModuleService: BlogModuleService = container.resolve(BLOG_MODULE)

    // Deleting a category only detaches it from its posts (the join rows
    // cascade); the posts themselves stay. Remember which ones, so a rollback
    // can put the category back where it was.
    const previous = await blogModuleService.retrieveBlogCategory(input.id, {
      relations: ["posts"],
    })

    await blogModuleService.deleteBlogCategories(input.id)

    return new StepResponse({ id: input.id }, previous)
  },
  async (previous, { container }) => {
    if (!previous) {
      return
    }

    const blogModuleService: BlogModuleService = container.resolve(BLOG_MODULE)
    const { posts, created_at, updated_at, deleted_at, ...fields } = previous

    await blogModuleService.createBlogCategories({
      ...fields,
      posts: (posts ?? []).map((post) => post.id),
    })
  }
)
