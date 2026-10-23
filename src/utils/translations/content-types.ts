import { MedusaError } from "@medusajs/framework/utils"
import { BLOG_MODULE } from "../../modules/blog"
import BlogModuleService from "../../modules/blog/service"
import { PAGE_MODULE } from "../../modules/page"
import PageModuleService from "../../modules/page/service"

/**
 * The CMS content that can be translated, and how.
 *
 * Each type is a data model whose text fields are marked `translatable()`
 * (see the models); translations are stored by Medusa's Translation module
 * under the type's `reference`, the way products' are. `fields` says which
 * fields the admin offers for translation and how to edit them, and it has to
 * match the model: `content-types.unit.spec.ts` checks that it does.
 */

export type ContentReference = "page" | "blog_post" | "blog_category"

export type ContentField = {
  key: string
  label: string
  /** `html` is edited with the rich-text editor and translated in pieces. */
  kind: "text" | "textarea" | "html"
}

type Container = { resolve: (key: string) => any }

export type ContentType = {
  reference: ContentReference
  label: string
  fields: ContentField[]
  /** Storefront cache tags to refresh when a translation changes. */
  cacheTags: string[]
  retrieve: (container: Container, id: string) => Promise<Record<string, any>>
}

const SEO_FIELDS: ContentField[] = [
  { key: "seo_title", label: "SEO title", kind: "text" },
  { key: "seo_description", label: "SEO description", kind: "textarea" },
]

export const CONTENT_TYPES: Record<ContentReference, ContentType> = {
  page: {
    reference: "page",
    label: "Page",
    fields: [
      { key: "title", label: "Title", kind: "text" },
      { key: "excerpt", label: "Excerpt", kind: "textarea" },
      { key: "content", label: "Content", kind: "html" },
      ...SEO_FIELDS,
    ],
    cacheTags: ["pages"],
    retrieve: async (container, id) =>
      (container.resolve(PAGE_MODULE) as PageModuleService).retrievePage(id),
  },
  blog_post: {
    reference: "blog_post",
    label: "Blog post",
    fields: [
      { key: "title", label: "Title", kind: "text" },
      { key: "excerpt", label: "Excerpt", kind: "textarea" },
      { key: "content", label: "Content", kind: "html" },
      { key: "featured_image_alt", label: "Image description", kind: "text" },
      ...SEO_FIELDS,
    ],
    cacheTags: ["blog"],
    retrieve: async (container, id) =>
      (container.resolve(BLOG_MODULE) as BlogModuleService).retrieveBlogPost(id),
  },
  blog_category: {
    reference: "blog_category",
    label: "Blog category",
    fields: [
      { key: "name", label: "Name", kind: "text" },
      { key: "description", label: "Description", kind: "textarea" },
      ...SEO_FIELDS,
    ],
    cacheTags: ["blog"],
    retrieve: async (container, id) =>
      (container.resolve(BLOG_MODULE) as BlogModuleService).retrieveBlogCategory(
        id
      ),
  },
}

export const getContentType = (reference: string): ContentType | undefined =>
  Object.prototype.hasOwnProperty.call(CONTENT_TYPES, reference)
    ? CONTENT_TYPES[reference as ContentReference]
    : undefined

/** The type for a `:reference` URL segment, or a 400 for one that is not. */
export const requireContentType = (reference: string): ContentType => {
  const type = getContentType(reference)

  if (!type) {
    throw new MedusaError(
      MedusaError.Types.INVALID_DATA,
      `"${reference}" cannot be translated here`
    )
  }

  return type
}

/** The keys the admin may save for a type. */
export const contentFieldKeys = (type: ContentType): string[] =>
  type.fields.map((field) => field.key)
