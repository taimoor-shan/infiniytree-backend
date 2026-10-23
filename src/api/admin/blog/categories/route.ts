import { MedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { BLOG_MODULE } from "../../../../modules/blog"
import BlogModuleService from "../../../../modules/blog/service"
import createBlogCategoryWorkflow from "../../../../workflows/create-blog-category"
import { revalidateStorefrontCache } from "../../../../utils/revalidate-cache"
import { escapeLike } from "../../../../utils/blog/text"
import {
  loadTranslationRows,
  translatedLocales,
} from "../../../../utils/translations/apply"
import { CreateBlogCategorySchema } from "../middlewares"

export async function GET(req: MedusaRequest, res: MedusaResponse) {
  const blogModuleService: BlogModuleService = req.scope.resolve(BLOG_MODULE)
  const { q, locale } = req.validatedQuery as { q?: string; locale?: string }

  const filters: Record<string, unknown> = {}
  if (q) {
    filters.name = { $ilike: `%${escapeLike(q)}%` }
  }
  if (locale) {
    filters.locale = locale
  }

  // The list is short (a handful of topics), so it is returned whole: the post
  // editor needs every category to offer as a choice.
  const [categories, count] = await blogModuleService.listAndCountBlogCategories(
    filters,
    {
      take: 500,
      order: { name: "ASC" },
    }
  )

  // Which languages each category has been translated into, for the list.
  const translations = await loadTranslationRows(
    req.scope,
    categories.map((category) => category.id)
  )

  return res.json({
    categories: categories.map((category) => ({
      ...category,
      translated_locales: translatedLocales(translations.get(category.id)),
    })),
    count,
  })
}

export async function POST(
  req: MedusaRequest<CreateBlogCategorySchema>,
  res: MedusaResponse
) {
  const { result } = await createBlogCategoryWorkflow(req.scope).run({
    input: req.validatedBody,
  })

  const logger = req.scope.resolve("logger")
  // Invalidate storefront blog cache
  await revalidateStorefrontCache(["blog"], logger)

  return res.status(200).json({ category: result.category })
}
