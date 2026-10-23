import { model } from "@medusajs/framework/utils"
import BlogPost from "./blog-post"

/**
 * A blog category, the blog's equivalent of a product category.
 *
 * One record per category, whatever the languages: `name`, `description` and
 * the SEO fields are `translatable()` (see `BlogPost`), `handle` is shared by
 * every language, so `/blog/category/<handle>` works in all of them.
 */
const BlogCategory = model
  .define("blog_category", {
    id: model.id({ prefix: "blogcat" }).primaryKey(),
    name: model.text().translatable(),
    handle: model.text(),
    // The language `name` and the other text are written in.
    locale: model.text().default("en"),
    description: model.text().translatable().nullable(),
    seo_title: model.text().translatable().nullable(),
    seo_description: model.text().translatable().nullable(),
    metadata: model.json().nullable(),
    posts: model.manyToMany(() => BlogPost, { mappedBy: "categories" }),
  })
  .indexes([{ on: ["handle"], unique: true }])

export default BlogCategory
