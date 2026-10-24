/** One language of a post or category, as the script saves it. */
export type PostText = {
  title: string
  excerpt: string
  /** HTML from the rich-text editor's vocabulary: h2, h3, p, ul, ol, a, strong, table. */
  content: string
  featured_image_alt: string
  seo_title: string
  seo_description: string
}

export type SeedPost = {
  handle: string
  /** Category handles, the first one is the breadcrumb. */
  categories: string[]
  /**
   * The featured photo: a JPEG in `blog-content/images` (sources in its
   * CREDITS.md). The script uploads it to the storage of the database it runs
   * against, so the image exists locally and live alike.
   */
  image: string
  /** Search terms the post is written for, kept in `metadata.keywords`. */
  keywords: { en: string[]; de: string[] }
  en: PostText
  de: PostText
}

export type CategoryText = {
  name: string
  description: string
  seo_title: string
  seo_description: string
}

export type SeedCategory = {
  handle: string
  en: CategoryText
  de: CategoryText
}
