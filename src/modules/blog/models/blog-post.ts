import { model } from "@medusajs/framework/utils"
import BlogCategory from "./blog-category"

/**
 * A blog article.
 *
 * One record per article, whatever the languages. `title`, `excerpt`,
 * `content`, the image description and the SEO fields are `translatable()`:
 * they hold the text in the article's own language (`locale`), and the
 * translations into other languages live in Medusa's Translation module, the
 * same way products' do. They are edited and auto-translated in the admin
 * (the "Translations" box of the post editor, or Settings → Translations), and
 * the storefront receives the visitor's language, falling back to the original.
 * `handle` (the URL segment, like a product handle) is the same in every
 * language.
 *
 * Visibility: an article is public when `status` is "published" and
 * `published_at` is not in the future, so publishing with a future date
 * schedules the article, the same way WordPress does.
 */
const BlogPost = model
  .define("blog_post", {
    id: model.id({ prefix: "post" }).primaryKey(),
    title: model.text().translatable(),
    handle: model.text(),
    // The language the text above is written in; the others are translations.
    locale: model.text().default("en"),
    excerpt: model.text().translatable().nullable(),
    content: model.text().translatable().nullable(),
    featured_image: model.text().nullable(),
    featured_image_alt: model.text().translatable().nullable(),
    author_name: model.text().nullable(),
    // Which storefront layout renders the article. Unknown keys fall back to
    // the default layout, so the storefront and admin can be deployed apart.
    template: model.text().default("standard"),
    status: model.text().default("draft"),
    published_at: model.dateTime().nullable(),
    // Minutes, computed from `content` whenever it is saved.
    reading_time: model.number().nullable(),
    seo_title: model.text().translatable().nullable(),
    seo_description: model.text().translatable().nullable(),
    metadata: model.json().nullable(),
    categories: model.manyToMany(() => BlogCategory, { mappedBy: "posts" }),
  })
  .indexes([
    { on: ["handle"], unique: true },
    { on: ["status", "published_at"] },
  ])

export default BlogPost
