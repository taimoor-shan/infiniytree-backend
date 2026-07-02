import { model } from "@medusajs/framework/utils"

const Page = model.define("page", {
  id: model.id().primaryKey(),
  title: model.text(),
  slug: model.text(),
  content: model.text().nullable(),
  excerpt: model.text().nullable(),
  featured_image: model.text().nullable(),
  seo_title: model.text().nullable(),
  seo_description: model.text().nullable(),
  status: model.text().default("draft"),
  is_public: model.boolean().default(false),
  metadata: model.json().nullable(),
})

export default Page
