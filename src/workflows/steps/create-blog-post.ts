import { createStep, StepResponse } from "@medusajs/framework/workflows-sdk"
import { BLOG_MODULE } from "../../modules/blog"
import BlogModuleService from "../../modules/blog/service"
import { computeReadingTime } from "../../utils/blog/text"

export type CreateBlogPostStepInput = {
  title: string
  handle: string
  locale?: string
  excerpt?: string | null
  content?: string | null
  featured_image?: string | null
  featured_image_alt?: string | null
  author_name?: string | null
  template?: string
  status?: "draft" | "published"
  /** ISO date. Publishing without one stamps "now"; a future date schedules. */
  published_at?: string | null
  seo_title?: string | null
  seo_description?: string | null
  metadata?: Record<string, unknown> | null
  category_ids?: string[]
}

export const createBlogPostStep = createStep(
  "create-blog-post",
  async (input: CreateBlogPostStepInput, { container }) => {
    const blogModuleService: BlogModuleService = container.resolve(BLOG_MODULE)

    const { category_ids, published_at, ...fields } = input
    const status = input.status ?? "draft"

    const created = await blogModuleService.createBlogPosts({
      ...fields,
      status,
      published_at: published_at
        ? new Date(published_at)
        : status === "published"
          ? new Date()
          : null,
      reading_time: computeReadingTime(input.content),
      ...(category_ids ? { categories: category_ids } : {}),
    })
    const post = Array.isArray(created) ? created[0] : created

    return new StepResponse(post, post.id)
  },
  async (postId, { container }) => {
    if (!postId) {
      return
    }

    const blogModuleService: BlogModuleService = container.resolve(BLOG_MODULE)
    await blogModuleService.deleteBlogPosts(postId)
  }
)
