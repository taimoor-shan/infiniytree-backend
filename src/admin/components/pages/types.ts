export type Page = {
  id: string
  title: string
  slug: string
  /** The language the text is written in; other languages are translations. */
  locale?: string
  content?: string | null
  excerpt?: string | null
  featured_image?: string | null
  hero_video_url?: string | null
  template?: string
  seo_title?: string | null
  seo_description?: string | null
  status: "draft" | "published"
  is_public: boolean
  /** Languages the page has been translated into (list responses only). */
  translated_locales?: string[]
  created_at: string
  updated_at: string
}

export type PagesResponse = {
  pages: Page[]
  count: number
  limit: number
  offset: number
}

export type PageResponse = {
  page: Page
}

/** React Query keys, shared so a save can refresh every list that shows it. */
export const PAGE_QUERY_KEYS = {
  pages: "pages",
  page: "page",
} as const

export type PageState = "draft" | "hidden" | "published"

export const PAGE_STATE_BADGE = {
  draft: { color: "grey", label: "Draft" },
  hidden: { color: "orange", label: "Hidden" },
  published: { color: "green", label: "Published" },
} as const

/**
 * What a visitor can see: the storefront serves a page only when it is
 * published and visible. Published but not visible is kept off the storefront.
 */
export const pageState = (
  page: Pick<Page, "status" | "is_public">
): PageState => {
  if (page.status !== "published") {
    return "draft"
  }

  return page.is_public ? "published" : "hidden"
}
