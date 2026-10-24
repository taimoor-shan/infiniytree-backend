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
   * The product whose thumbnail becomes the featured image, looked up by
   * handle in the database the script runs against, so the image exists
   * locally and live alike. Missing product → no image.
   */
  image_product: string
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
