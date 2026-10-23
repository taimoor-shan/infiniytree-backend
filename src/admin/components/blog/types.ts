export type BlogCategory = {
  id: string
  name: string
  handle: string
  /** The language the text is written in; other languages are translations. */
  locale: string
  description?: string | null
  seo_title?: string | null
  seo_description?: string | null
  /** Languages it has been translated into (list responses only). */
  translated_locales?: string[]
}

export type BlogPost = {
  id: string
  title: string
  handle: string
  locale: string
  excerpt?: string | null
  content?: string | null
  featured_image?: string | null
  featured_image_alt?: string | null
  author_name?: string | null
  template: string
  status: "draft" | "published"
  published_at?: string | null
  reading_time?: number | null
  seo_title?: string | null
  seo_description?: string | null
  categories?: BlogCategory[]
  /** Languages it has been translated into (list responses only). */
  translated_locales?: string[]
  created_at: string
  updated_at: string
}

export type PostsResponse = {
  posts: BlogPost[]
  count: number
  limit: number
  offset: number
}

export type PostResponse = { post: BlogPost }

export type CategoriesResponse = { categories: BlogCategory[]; count: number }

export type CategoryResponse = { category: BlogCategory }

/** React Query keys, shared so a save can refresh every list that shows it. */
export const BLOG_QUERY_KEYS = {
  posts: "blog-posts",
  post: "blog-post",
  categories: "blog-categories",
} as const

export type PostState = "draft" | "scheduled" | "published"

export const POST_STATE_BADGE = {
  draft: { color: "grey", label: "Draft" },
  scheduled: { color: "orange", label: "Scheduled" },
  published: { color: "green", label: "Published" },
} as const

/**
 * What a visitor can see right now. A post marked published with a date in the
 * future is scheduled: the storefront shows it once that moment has passed.
 */
export const postState = (
  post: Pick<BlogPost, "status" | "published_at">
): PostState => {
  if (post.status !== "published") {
    return "draft"
  }

  return post.published_at && new Date(post.published_at).getTime() > Date.now()
    ? "scheduled"
    : "published"
}
