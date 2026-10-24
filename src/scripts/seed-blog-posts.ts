import { ExecArgs } from "@medusajs/framework/types"
import { ContainerRegistrationKeys } from "@medusajs/framework/utils"
import { BLOG_MODULE } from "../modules/blog"
import BlogModuleService from "../modules/blog/service"
import { revalidateStorefrontCache } from "../utils/revalidate-cache"
import { knownLocaleCodes } from "../utils/translations/targets"
import createBlogCategoryWorkflow from "../workflows/create-blog-category"
import createBlogPostWorkflow from "../workflows/create-blog-post"
import saveContentTranslationWorkflow from "../workflows/save-content-translation"
import updateBlogCategoryWorkflow from "../workflows/update-blog-category"
import updateBlogPostWorkflow from "../workflows/update-blog-post"
import { artificialCherryBlossomTree } from "./blog-content/artificial-cherry-blossom-tree"
import { artificialTreesForHotels } from "./blog-content/artificial-trees-for-hotels"
import { artificialVsRealPlantsOffice } from "./blog-content/artificial-vs-real-plants-office"
import { categories } from "./blog-content/categories"
import { howToCleanArtificialPlants } from "./blog-content/how-to-clean-artificial-plants"
import type { SeedPost } from "./blog-content/types"

/** Newest first: the first post gets the latest publishing date. */
const POSTS: SeedPost[] = [
  artificialCherryBlossomTree,
  artificialTreesForHotels,
  howToCleanArtificialPlants,
  artificialVsRealPlantsOffice,
]

const AUTHOR = "Infinytree"

/** German as the storefront serves it: de-AT in Austria, de-DE elsewhere. */
const GERMAN_LOCALES = ["de-AT", "de-DE"]

/**
 * Imports the blog's first articles and categories, in English with German
 * translations, into the database it runs against.
 *
 *   npx medusa exec ./src/scripts/seed-blog-posts.ts             publish
 *   npx medusa exec ./src/scripts/seed-blog-posts.ts draft       as drafts
 *   npx medusa exec ./src/scripts/seed-blog-posts.ts update      overwrite
 *
 * On the server, run it from `.medusa/server` with the built file:
 *   npx medusa exec ./src/scripts/seed-blog-posts.js
 *
 * Safe to run twice: a post or category whose handle exists is left alone,
 * so edits made in the admin are kept, unless `update` is passed. The
 * German text is saved as the de-AT and the de-DE translation, so Austria and
 * Germany both get it. Featured images are the thumbnails of the products named in each post,
 * looked up here, so they exist on this database's storage.
 */
export default async function seedBlogPosts({ container, args }: ExecArgs) {
  const logger = container.resolve(ContainerRegistrationKeys.LOGGER)
  const query = container.resolve(ContainerRegistrationKeys.QUERY)
  const blog: BlogModuleService = container.resolve(BLOG_MODULE)

  const update = args.includes("update")
  const status = args.includes("draft") ? "draft" : "published"

  const known = await knownLocaleCodes(container)
  const germanLocales = GERMAN_LOCALES.filter((code) => known.includes(code))
  if (!germanLocales.length) {
    logger.warn(
      "[seed-blog] The Translation module knows no German locale (de-AT, de-DE): German text is skipped. Add the locales under Settings → Store, then run the script again with update."
    )
  }

  const saveGerman = async (
    reference: "blog_post" | "blog_category",
    id: string,
    values: Record<string, string>
  ) => {
    if (!germanLocales.length) {
      return
    }
    await saveContentTranslationWorkflow(container).run({
      input: { reference, id, locales: germanLocales, values },
    })
  }

  // Categories
  const categoryIds = new Map<string, string>()

  for (const category of categories) {
    const [existing] = await blog.listBlogCategories(
      { handle: category.handle },
      { take: 1 }
    )

    if (existing && !update) {
      categoryIds.set(category.handle, existing.id)
      logger.info(`[seed-blog] Category "${category.handle}" exists, kept`)
      continue
    }

    const data = { ...category.en, handle: category.handle, locale: "en" }
    const { result } = existing
      ? await updateBlogCategoryWorkflow(container).run({
          input: { id: existing.id, data },
        })
      : await createBlogCategoryWorkflow(container).run({ input: data })
    const id = result.category.id

    categoryIds.set(category.handle, id)
    await saveGerman("blog_category", id, { ...category.de })
    logger.info(
      `[seed-blog] Category "${category.handle}" ${existing ? "updated" : "created"}`
    )
  }

  // Posts
  const now = Date.now()

  for (const [index, post] of POSTS.entries()) {
    const [existing] = await blog.listBlogPosts(
      { handle: post.handle },
      { take: 1 }
    )

    if (existing && !update) {
      logger.info(`[seed-blog] Post "${post.handle}" exists, kept`)
      continue
    }

    const { data: products } = await query.graph({
      entity: "product",
      fields: ["thumbnail"],
      filters: { handle: post.image_product },
    })
    const image = products[0]?.thumbnail ?? null
    if (!image) {
      logger.warn(
        `[seed-blog] No thumbnail for product "${post.image_product}": "${post.handle}" has no featured image`
      )
    }

    const data = {
      ...post.en,
      handle: post.handle,
      locale: "en",
      featured_image: image,
      author_name: AUTHOR,
      template: "standard",
      status: status as "draft" | "published",
      // An hour apart, so the list shows them in the order above.
      published_at:
        status === "published"
          ? new Date(now - index * 60 * 60 * 1000).toISOString()
          : null,
      metadata: { keywords: post.keywords, source: "seed-blog-posts" },
      category_ids: post.categories
        .map((handle) => categoryIds.get(handle))
        .filter((id): id is string => !!id),
    }

    const { result } = existing
      ? await updateBlogPostWorkflow(container).run({
          input: {
            id: existing.id,
            // Keep the date a published post already has.
            data: existing.published_at
              ? { ...data, published_at: undefined }
              : data,
          },
        })
      : await createBlogPostWorkflow(container).run({ input: data })

    await saveGerman("blog_post", result.post.id, { ...post.de })
    logger.info(
      `[seed-blog] Post "${post.handle}" ${existing ? "updated" : "created"} (${status})`
    )
  }

  await revalidateStorefrontCache(["blog"], logger)
}
