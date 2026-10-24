/** What `GET /admin/storefront-links` answers. */
export type StorefrontLinks = {
  base: string
  /** English and German market addresses; null until the store has a region. */
  markets: { en: string; de: string } | null
}

/** The languages the storefront serves. */
export type StorefrontLanguage = "en" | "de"

/** German for any `de-*` locale; English for the rest, including no locale. */
export const storefrontLanguage = (
  locale?: string | null
): StorefrontLanguage =>
  (locale || "en").toLowerCase().startsWith("de") ? "de" : "en"

/**
 * The storefront address for a language. Without a region the storefront
 * redirects an unprefixed address to a market of its own choosing.
 */
const marketFor = (links: StorefrontLinks, language: StorefrontLanguage) =>
  links.markets ? links.markets[language] : links.base

/**
 * Pages the storefront serves at an address of their own instead of `/<slug>`.
 * Keep in step with `CMS_SLUGS_WITH_OWN_ROUTE` in the storefront's
 * `src/app/sitemap.ts`. Any other page is at `/<slug>`.
 */
const OWN_ADDRESS = new Map<string, string>([
  ["home", ""],
  ["affiliate-policy", "/policies/affiliate"],
  ["imprint", "/policies/imprint"],
  ["privacy-policy", "/policies/privacy"],
  ["returns-and-refunds", "/policies/returns"],
  ["shipping-policy", "/policies/shipping"],
  ["terms-and-conditions", "/policies/terms"],
])

/**
 * The address of a saved page on the storefront, in the language it is written
 * in, or null while the links have not loaded.
 */
export const pageViewUrl = (
  links: StorefrontLinks | null | undefined,
  page: { slug: string; locale?: string | null }
): string | null => {
  if (!links) {
    return null
  }

  const slug = page.slug.replace(/^\/+|\/+$/g, "")

  return `${marketFor(links, storefrontLanguage(page.locale))}${
    OWN_ADDRESS.get(slug) ?? `/${slug}`
  }`
}

/** A saved blog post, in the language it is written in. */
export const postViewUrl = (
  links: StorefrontLinks | null | undefined,
  post: { handle: string; locale?: string | null }
): string | null =>
  links
    ? `${marketFor(links, storefrontLanguage(post.locale))}/blog/${encodeURIComponent(post.handle)}`
    : null

/** A saved blog category, in the language it is written in. */
export const categoryViewUrl = (
  links: StorefrontLinks | null | undefined,
  category: { handle: string; locale?: string | null }
): string | null =>
  links
    ? `${marketFor(links, storefrontLanguage(category.locale))}/blog/category/${encodeURIComponent(category.handle)}`
    : null

/** A product, in the language asked for (its text is translated, not written in one). */
export const productViewUrl = (
  links: StorefrontLinks | null | undefined,
  product: { handle?: string | null },
  language: StorefrontLanguage
): string | null =>
  links && product.handle
    ? `${marketFor(links, language)}/products/${encodeURIComponent(product.handle)}`
    : null
