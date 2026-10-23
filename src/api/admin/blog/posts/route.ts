import { MedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { BLOG_MODULE } from "../../../../modules/blog"
import BlogModuleService from "../../../../modules/blog/service"
import createBlogPostWorkflow from "../../../../workflows/create-blog-post"
import { revalidateStorefrontCache } from "../../../../utils/revalidate-cache"
import { escapeLike } from "../../../../utils/blog/text"
import {
  loadTranslationRows,
  translatedLocales,
} from "../../../../utils/translations/apply"
import { CreateBlogPostSchema } from "../middlewares"

export async function GET(req: MedusaRequest, res: MedusaResponse) {
  const blogModuleService: BlogModuleService = req.scope.resolve(BLOG_MODULE)
  const { q, status, locale, limit = 20, offset = 0 } = req.validatedQuery as {
    q?: string
    status?: string
    locale?: string
    limit?: number
    offset?: number
  }

  const filters: Record<string, unknown> = {}
  if (q) {
    filters.title = { $ilike: `%${escapeLike(q)}%` }
  }
  if (status) {
    filters.status = status
  }
  if (locale) {
    filters.locale = locale
  }

  const [posts, count] = await blogModuleService.listAndCountBlogPosts(
    filters,
    {
      relations: ["categories"],
      take: limit,
      skip: offset,
      order: { created_at: "DESC" },
    }
  )

  // Which languages each post has been translated into, for the list.
  const translations = await loadTranslationRows(
    req.scope,
    posts.map((post) => post.id)
  )

  return res.json({
    posts: posts.map((post) => ({
      ...post,
      translated_locales: translatedLocales(translations.get(post.id)),
    })),
    count,
    limit,
    offset,
  })
}

export async function POST(
  req: MedusaRequest<CreateBlogPostSchema>,
  res: MedusaResponse
) {
  const { result } = await createBlogPostWorkflow(req.scope).run({
    input: req.validatedBody,
  })

  const blogModuleService: BlogModuleService = req.scope.resolve(BLOG_MODULE)
  const post = await blogModuleService.retrieveBlogPost(result.post.id, {
    relations: ["categories"],
  })

  const logger = req.scope.resolve("logger")
  // Invalidate storefront blog cache
  await revalidateStorefrontCache(["blog"], logger)

  return res.status(200).json({ post })
}
