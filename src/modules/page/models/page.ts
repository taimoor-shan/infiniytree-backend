import { model } from "@medusajs/framework/utils"

/**
 * A CMS page.
 *
 * `title`, `excerpt`, `content` and the SEO fields are `translatable()`: they
 * hold the text in the page's own language (`locale`) and the translations
 * into other languages live in Medusa's Translation module, the same way
 * products' do. A page is therefore written once and translated (in the
 * "Translations" box of the page editor, or Settings → Translations), instead
 * of duplicated per language with the same slug. Pages created before this
 * existed as one record per language still work: a record in the visitor's own
 * language is served as it is (`resolveLocalizedRecord` in
 * `src/utils/translations/apply.ts`).
 */
const Page = model.define("page", {
  id: model.id().primaryKey(),
  title: model.text().translatable(),
  slug: model.text(),
  // The language the text is written in; other languages are translations.
  locale: model.text().default("en"),
  content: model.text().translatable().nullable(),
  excerpt: model.text().translatable().nullable(),
  featured_image: model.text().nullable(),
  hero_video_url: model.text().nullable(),
  // Which storefront layout renders the page, like a WordPress page template.
  // Unknown keys fall back to "default", so the admin and the storefront can be
  // deployed apart without breaking pages.
  template: model.text().default("default"),
  seo_title: model.text().translatable().nullable(),
  seo_description: model.text().translatable().nullable(),
  status: model.text().default("draft"),
  is_public: model.boolean().default(false),
  metadata: model.json().nullable(),
})

export default Page
