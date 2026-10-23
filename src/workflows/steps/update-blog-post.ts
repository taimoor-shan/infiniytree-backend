import { createStep, StepResponse } from "@medusajs/framework/workflows-sdk"
import { BLOG_MODULE } from "../../modules/blog"
import BlogModuleService from "../../modules/blog/service"
import { computeReadingTime } from "../../utils/blog/text"

export type UpdateBlogPostStepInput = {
  id: string
  data: {
    title?: string
    handle?: string
    locale?: string
    excerpt?: string | null
    content?: string | null
    featured_image?: string | null
    featured_image_alt?: string | null
    author_name?: string | null
    template?: string
    status?: "draft" | "published"
    published_at?: string | null
    seo_title?: string | null
    seo_description?: string | null
    metadata?: Record<string, unknown> | null
    category_ids?: string[]
  }
}

export const updateBlogPostStep = createStep(
  "update-blog-post",
  async (input: UpdateBlogPostStepInput, { container }) => {
    const blogModuleService: BlogModuleService = container.resolve(BLOG_MODULE)

    const previous = await blogModuleService.retrieveBlogPost(input.id, {
      relations: ["categories"],
    })

    const { category_ids, published_at, ...fields } = input.data
    const patch: Record<string, unknown> = { ...fields }

    if (fields.content !== undefined) {
      patch.reading_time = computeReadingTime(fields.content)
    }

    if (published_at !== undefined) {
      patch.published_at = published_at ? new Date(published_at) : null
    }

    // Publishing stamps the date once. An article that is edited later, or
    // unpublished and published again, keeps its original date unless the
    // editor sets another one.
    const status = fields.status ?? previous.status
    const effectivePublishedAt =
      "published_at" in patch ? patch.published_at : previous.published_at

    if (status === "published" && !effectivePublishedAt) {
      patch.published_at = new Date()
    }

    if (category_ids) {
      patch.categories = category_ids
    }

    const updated = await blogModuleService.updateBlogPosts({
      id: input.id,
      ...patch,
    })
    const post = Array.isArray(updated) ? updated[0] : updated

    return new StepResponse(post, previous)
  },
  async (previous, { container }) => {
    if (!previous) {
      return
    }

    const blogModuleService: BlogModuleService = container.resolve(BLOG_MODULE)
    const { id, categories, created_at, updated_at, deleted_at, ...fields } =
      previous

    await blogModuleService.updateBlogPosts({
      id,
      ...fields,
      categories: (categories ?? []).map((category) => category.id),
    })
  }
)
