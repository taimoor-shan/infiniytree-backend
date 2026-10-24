import fs from "fs"
import path from "path"
import { ExecArgs } from "@medusajs/framework/types"
import { ContainerRegistrationKeys } from "@medusajs/framework/utils"
import { uploadFilesWorkflow } from "@medusajs/medusa/core-flows"
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
import { orchidsThatLookReal } from "./blog-content/orchids-that-look-real"
import { plantsForDarkRooms } from "./blog-content/plants-for-dark-rooms"
import type { SeedPost } from "./blog-content/types"

/** Newest first: the first post gets the latest publishing date. */
const POSTS: SeedPost[] = [
  artificialCherryBlossomTree,
  orchidsThatLookReal,
  artificialTreesForHotels,
  plantsForDarkRooms,
  howToCleanArtificialPlants,
  artificialVsRealPlantsOffice,
]

const AUTHOR = "Infinytree"

/** The posts' photos; postBuild.js copies them beside the built script. */
const IMAGE_DIR = path.join(__dirname, "blog-content", "images")

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
 * Germany both get it. Featured images are the photos in
 * `blog-content/images`, uploaded to this database's storage: once per post,
 * so a run with `update` keeps the copy a post already shows.
 */
export default async function seedBlogPosts({ container, args }: ExecArgs) {
  const logger = container.resolve(ContainerRegistrationKeys.LOGGER)
  const blog: BlogModuleService = container.resolve(BLOG_MODULE)

  const update = args.includes("update")
  const status = args.includes("draft") ? "draft" : "published"

  // Checked before anything is written: a missing photo is a packaging
  // mistake (on the server: postBuild.js did not run), not a post without one.
  const missing = POSTS.filter(
    (post) => !fs.existsSync(path.join(IMAGE_DIR, post.image))
  )
  if (missing.length) {
    throw new Error(
      `[seed-blog] Missing photos in ${IMAGE_DIR}: ${missing
        .map((post) => post.image)
        .join(", ")}`
    )
  }

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

  // A post keeps the copy of its photo it already shows, so a run with
  // `update` does not upload the same file again.
  const featuredImage = async (
    post: SeedPost,
    existing?: {
      featured_image?: string | null
      metadata?: Record<string, unknown> | null
    }
  ) => {
    if (
      existing?.featured_image &&
      existing.metadata?.featured_image_file === post.image
    ) {
      return existing.featured_image
    }

    const { result } = await uploadFilesWorkflow(container).run({
      input: {
        files: [
          {
            filename: post.image,
            mimeType: "image/jpeg",
            content: fs
              .readFileSync(path.join(IMAGE_DIR, post.image))
              .toString("base64"),
            access: "public",
          },
        ],
      },
    })
    return result[0].url
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

    const image = await featuredImage(post, existing)

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
      metadata: {
        keywords: post.keywords,
        source: "seed-blog-posts",
        featured_image_file: post.image,
      },
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
