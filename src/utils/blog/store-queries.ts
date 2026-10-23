import {
  loadTranslationRows,
  localizeRecords,
  translatedLocales,
} from "../translations/apply"

/**
 * Read queries behind the public `/store/blog/*` endpoints.
 *
 * A post exists once; its text in other languages lives in Medusa's
 * Translation module (see `../translations/apply.ts`). Every query reads the
 * original text and then lays the visitor's translation over it, falling back
 * to the original for a language with no translation. Listings scan the
 * published posts in a light form (ids, date, category handles), page in
 * memory, and load only the requested page in full. A blog is tens or hundreds
 * of articles, so the scan is cheap and capped.
 */

/** A `query.graph` caller, as resolved from the container (`"query"`). */
export type GraphQuery = {
  graph: (
    args: Record<string, unknown>
  ) => Promise<{ data: any[]; metadata?: any }>
}

type Container = { resolve: (key: string) => any }
type Row = { id: string; [key: string]: any }

/** Upper bound on articles scanned for one request. */
const MAX_SCAN = 2000

/** What a listing card needs. No body, so a page of cards stays small. */
export const CARD_FIELDS = [
  "id",
  "title",
  "handle",
  "locale",
  "excerpt",
  "featured_image",
  "featured_image_alt",
  "author_name",
  "template",
  "published_at",
  "reading_time",
  "categories.id",
  "categories.name",
  "categories.handle",
  "categories.locale",
]

/** Everything the article page renders. */
export const POST_FIELDS = [
  ...CARD_FIELDS,
  "content",
  "seo_title",
  "seo_description",
  "metadata",
  "updated_at",
]

export const CATEGORY_FIELDS = [
  "id",
  "name",
  "handle",
  "locale",
  "description",
  "seo_title",
  "seo_description",
]

/** Published, and not scheduled for later. */
export const visiblePostFilters = () => ({
  status: "published",
  $or: [{ published_at: null }, { published_at: { $lte: new Date() } }],
})

const time = (value: unknown) =>
  value ? new Date(value as string).getTime() : 0

const newestFirst = (a: Row, b: Row) =>
  time(b.published_at) - time(a.published_at)

const queryOf = (container: Container): GraphQuery =>
  container.resolve("query") as GraphQuery

const scanVisiblePosts = async (container: Container, fields: string[]) => {
  const { data } = await queryOf(container).graph({
    entity: "blog_post",
    fields,
    filters: visiblePostFilters(),
    pagination: { take: MAX_SCAN, skip: 0 },
  })

  return data
}

/** Posts, and the categories inside them, in the visitor's language. */
async function localizePosts(
  container: Container,
  posts: Row[],
  locale: string | null | undefined
): Promise<Row[]> {
  const localizedPosts = await localizeRecords(container, posts, locale)

  const categories = new Map<string, Row>()

  for (const post of posts) {
    for (const category of post.categories ?? []) {
      categories.set(category.id, category)
    }
  }

  const localizedCategories = new Map(
    (await localizeRecords(container, Array.from(categories.values()), locale)).map(
      (category) => [category.id, category]
    )
  )

  return localizedPosts.map((post) => ({
    ...post,
    categories: (post.categories ?? []).map(
      (category: Row) => localizedCategories.get(category.id) ?? category
    ),
  }))
}

export async function listVisiblePosts(
  container: Container,
  {
    locale,
    category,
    limit,
    offset,
  }: {
    locale?: string | null
    category?: string | null
    limit: number
    offset: number
  }
) {
  let found = await scanVisiblePosts(container, [
    "id",
    "handle",
    "published_at",
    "categories.handle",
  ])

  // The handle is the same in every language, so the filter does not depend
  // on the visitor's.
  if (category) {
    found = found.filter((post) =>
      post.categories?.some((c: { handle: string }) => c.handle === category)
    )
  }

  found.sort(newestFirst)

  const ids = found.slice(offset, offset + limit).map((post) => post.id)

  if (!ids.length) {
    return { posts: [], count: found.length }
  }

  const { data } = await queryOf(container).graph({
    entity: "blog_post",
    fields: CARD_FIELDS,
    filters: { id: ids },
  })

  const byId = new Map(data.map((post) => [post.id, post]))
  const ordered = ids.map((id) => byId.get(id)).filter(Boolean) as Row[]

  return {
    posts: await localizePosts(container, ordered, locale),
    count: found.length,
  }
}

/**
 * One article by handle in the visitor's language, with the languages it is
 * available in (its own and every translation).
 */
export async function retrieveVisiblePost(
  container: Container,
  handle: string,
  locale?: string | null
) {
  const { data } = await queryOf(container).graph({
    entity: "blog_post",
    fields: POST_FIELDS,
    filters: { handle, ...visiblePostFilters() },
  })

  const [post] = data

  if (!post) {
    return null
  }

  const rows = await loadTranslationRows(container, [post.id])
  const [localized] = await localizePosts(container, [post], locale)

  return {
    post: localized,
    locales: Array.from(
      new Set([post.locale ?? "en", ...translatedLocales(rows.get(post.id))])
    ).sort(),
  }
}

/** Categories that have at least one visible article, with that count. */
export async function listVisibleCategories(
  container: Container,
  locale?: string | null
) {
  const scan = await scanVisiblePosts(container, [
    "id",
    "categories.id",
    "categories.name",
    "categories.handle",
    "categories.locale",
    "categories.description",
  ])

  const counted = new Map<string, { category: Row; count: number }>()

  for (const post of scan) {
    for (const category of post.categories ?? []) {
      const entry = counted.get(category.id)

      if (entry) {
        entry.count += 1
      } else {
        counted.set(category.id, { category, count: 1 })
      }
    }
  }

  const localized = await localizeRecords(
    container,
    Array.from(counted.values(), ({ category }) => category),
    locale
  )

  return localized
    .map(
      (category): Row => ({
        ...category,
        post_count: counted.get(category.id)?.count ?? 0,
      })
    )
    .sort((a, b) => String(a.name).localeCompare(String(b.name)))
}

/** A category by handle in the visitor's language, or null. */
export async function retrieveCategory(
  container: Container,
  handle: string,
  locale?: string | null
) {
  const { data } = await queryOf(container).graph({
    entity: "blog_category",
    fields: CATEGORY_FIELDS,
    filters: { handle },
  })

  const [category] = await localizeRecords(container, data.slice(0, 1), locale)

  return category ?? null
}

/** Handles and dates for the storefront sitemap. */
export async function listSitemapEntries(container: Container) {
  const scan = await scanVisiblePosts(container, [
    "handle",
    "published_at",
    "updated_at",
    "categories.handle",
  ])

  const posts = new Map<string, { handle: string; updated_at: string | null }>()
  const categories = new Set<string>()

  for (const post of scan) {
    const current = posts.get(post.handle)

    if (!current || time(post.updated_at) > time(current.updated_at)) {
      posts.set(post.handle, {
        handle: post.handle,
        updated_at: post.updated_at ?? null,
      })
    }

    for (const category of post.categories ?? []) {
      categories.add(category.handle)
    }
  }

  return {
    posts: Array.from(posts.values()),
    categories: Array.from(categories, (handle) => ({ handle })),
  }
}
