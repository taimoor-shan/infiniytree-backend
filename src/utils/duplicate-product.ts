/**
 * Duplicating a product: the parts that are plain data in, data out, so they
 * can be tested without a database. The workflow (`workflows/duplicate-product.ts`)
 * reads the product, calls these, and saves the result.
 *
 * A copy is a new draft with its own title and handle. It keeps everything the
 * original says about itself, and starts without what must belong to one
 * product only: its stock, and the SKU and barcodes, which are unique.
 */

/** A URL-safe handle from free text, the same rules as the admin's preview. */
export const slugify = (value: string): string =>
  value
    .normalize("NFKD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/ß/g, "ss")
    .replace(/&/g, " and ")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")

/**
 * A title as a handle, before any -2 or -3. A title with nothing a handle can
 * hold ("!!!", or text in a script this cannot transliterate) becomes "product".
 */
export const handleBase = (title: string): string => slugify(title) || "product"

/**
 * The handle of a copy: its title as a handle, or with -2, -3 … after it when
 * that is taken (handles are unique).
 */
export const copyHandle = (title: string, taken: Iterable<string>): string => {
  const base = handleBase(title)
  const used = new Set(taken)

  if (!used.has(base)) {
    return base
  }

  let count = 2
  while (used.has(`${base}-${count}`)) {
    count += 1
  }

  return `${base}-${count}`
}

type Json = Record<string, unknown>

export type SourceImage = {
  id: string
  url: string
  rank?: number | null
  metadata?: Json | null
  /**
   * The variants this picture is tied to. A picture tied to none is shown by
   * every variant. (A variant's own `images` is not used: the product module
   * works it out as its tied pictures plus all the untied ones.)
   */
  variants?: { id: string }[] | null
}

export type SourceOptionValue = {
  id: string
  value: string
  rank?: number | null
}

export type SourceOption = {
  id: string
  title: string
  is_exclusive?: boolean | null
  metadata?: Json | null
  values: SourceOptionValue[]
}

/** The choice a variant has made for one option: "Gold" for "Planter". */
export type VariantChoice = { value: string; option: { title: string } }

export type SourcePrice = {
  currency_code: string
  amount: number
  min_quantity?: number | null
  max_quantity?: number | null
  /** Set for a price that belongs to a price list (a sale), not to the variant. */
  price_list_id?: string | null
  price_rules?: { attribute: string; value: string }[] | null
}

export type SourceVariant = {
  id: string
  title: string
  sku?: string | null
  barcode?: string | null
  ean?: string | null
  upc?: string | null
  allow_backorder?: boolean | null
  manage_inventory?: boolean | null
  hs_code?: string | null
  origin_country?: string | null
  mid_code?: string | null
  material?: string | null
  weight?: number | null
  length?: number | null
  height?: number | null
  width?: number | null
  variant_rank?: number | null
  thumbnail?: string | null
  metadata?: Json | null
  options: VariantChoice[]
  price_set?: { prices: SourcePrice[] } | null
}

/** A product as the workflow reads it, with everything a copy needs. */
export type SourceProduct = {
  id: string
  title: string
  subtitle?: string | null
  description?: string | null
  handle?: string | null
  status?: string
  thumbnail?: string | null
  is_giftcard?: boolean | null
  discountable?: boolean | null
  weight?: number | null
  length?: number | null
  height?: number | null
  width?: number | null
  origin_country?: string | null
  hs_code?: string | null
  mid_code?: string | null
  material?: string | null
  metadata?: Json | null
  type_id?: string | null
  collection_id?: string | null
  tags?: { id: string }[] | null
  categories?: { id: string }[] | null
  sales_channels?: { id: string }[] | null
  shipping_profile?: { id: string } | null
  images?: SourceImage[] | null
  options?: SourceOption[] | null
  variants?: SourceVariant[] | null
}

export type PriceCopy = {
  currency_code: string
  amount: number
  min_quantity?: number
  max_quantity?: number
  rules?: Record<string, string>
}

export type VariantCopy = {
  title: string
  options: Record<string, string>
  prices: PriceCopy[]
  allow_backorder?: boolean
  manage_inventory?: boolean
  hs_code?: string
  origin_country?: string
  mid_code?: string
  material?: string
  weight?: number
  length?: number
  height?: number
  width?: number
  /** What orders the variants. The create input does not list it; it is saved all the same. */
  variant_rank?: number
  metadata?: Json
}

/** What `createProductsWorkflow` is given for the copy. */
export type ProductCopy = {
  title: string
  handle: string
  status: "draft"
  subtitle?: string
  description?: string
  thumbnail?: string
  is_giftcard?: boolean
  discountable?: boolean
  weight?: number
  length?: number
  height?: number
  width?: number
  origin_country?: string
  hs_code?: string
  mid_code?: string
  material?: string
  metadata?: Json
  type_id?: string
  collection_id?: string
  shipping_profile_id?: string
  tag_ids: string[]
  category_ids: string[]
  sales_channels: { id: string }[]
  images: { url: string; metadata?: Json }[]
  options: {
    title: string
    values: string[]
    is_exclusive?: boolean
    metadata?: Json
  }[]
  variants: VariantCopy[]
}

/** What to read of a product to copy it: the fields `SourceProduct` holds. */
export const SOURCE_PRODUCT_FIELDS = [
  "id",
  "title",
  "subtitle",
  "description",
  "thumbnail",
  "is_giftcard",
  "discountable",
  "weight",
  "length",
  "height",
  "width",
  "origin_country",
  "hs_code",
  "mid_code",
  "material",
  "metadata",
  "type_id",
  "collection_id",
  "tags.id",
  "categories.id",
  "sales_channels.id",
  "shipping_profile.id",
  "images.id",
  "images.url",
  "images.rank",
  "images.metadata",
  "images.variants.id",
  "options.id",
  "options.title",
  "options.is_exclusive",
  "options.metadata",
  "options.values.id",
  "options.values.value",
  "options.values.rank",
  "variants.id",
  "variants.title",
  "variants.allow_backorder",
  "variants.manage_inventory",
  "variants.hs_code",
  "variants.origin_country",
  "variants.mid_code",
  "variants.material",
  "variants.weight",
  "variants.length",
  "variants.height",
  "variants.width",
  "variants.variant_rank",
  "variants.thumbnail",
  "variants.metadata",
  "variants.options.value",
  "variants.options.option.title",
  "variants.price_set.prices.currency_code",
  "variants.price_set.prices.amount",
  "variants.price_set.prices.min_quantity",
  "variants.price_set.prices.max_quantity",
  "variants.price_set.prices.price_list_id",
  "variants.price_set.prices.price_rules.attribute",
  "variants.price_set.prices.price_rules.value",
]

/** What to read of the new product to match it to the original: `CopiedProduct`. */
export const COPIED_PRODUCT_FIELDS = [
  "id",
  "title",
  "handle",
  "status",
  "options.id",
  "options.title",
  "options.values.id",
  "options.values.value",
  "variants.id",
  "variants.title",
  "variants.options.value",
  "variants.options.option.title",
  "images.id",
  "images.url",
]

const present = <T>(value: T | null | undefined): value is T =>
  value !== null && value !== undefined

/** The listed fields of `from` that have a value, null and missing left out. */
const only = <K extends string>(
  from: Partial<Record<K, unknown>>,
  keys: readonly K[]
): Partial<Record<K, any>> =>
  Object.fromEntries(
    keys.filter((key) => present(from[key])).map((key) => [key, from[key]])
  ) as Partial<Record<K, any>>

const byRank = <T extends { rank?: number | null }>(a: T, b: T) =>
  (a.rank ?? Number.MAX_SAFE_INTEGER) - (b.rank ?? Number.MAX_SAFE_INTEGER)

const copyJson = (value: Json | null | undefined): Json | undefined =>
  present(value) ? structuredClone(value) : undefined

const PRODUCT_FIELDS = [
  "subtitle",
  "description",
  "thumbnail",
  "is_giftcard",
  "discountable",
  "weight",
  "length",
  "height",
  "width",
  "origin_country",
  "hs_code",
  "mid_code",
  "material",
  "type_id",
  "collection_id",
] as const

const VARIANT_FIELDS = [
  "allow_backorder",
  "manage_inventory",
  "hs_code",
  "origin_country",
  "mid_code",
  "material",
  "weight",
  "length",
  "height",
  "width",
  "variant_rank",
] as const

const copyPrices = (variant: SourceVariant): PriceCopy[] =>
  (variant.price_set?.prices ?? [])
    .filter((price) => !price.price_list_id)
    .map((price) => ({
      currency_code: price.currency_code,
      amount: price.amount,
      ...only(price, ["min_quantity", "max_quantity"] as const),
      ...(price.price_rules?.length
        ? {
            rules: Object.fromEntries(
              price.price_rules.map((rule) => [rule.attribute, rule.value])
            ),
          }
        : {}),
    }))

/**
 * The product a copy is created from: the original's data under a new title
 * and handle, as a draft.
 *
 * Left out on purpose: the SKU, barcode, EAN and UPC of each variant (they
 * must be unique, so a copy of them would be refused), the link to the
 * original's stock (the new variants get items of their own, with none in
 * stock), and the sale prices of price lists.
 */
export const buildProductCopy = (
  source: SourceProduct,
  { title, handle }: { title: string; handle: string }
): ProductCopy => {
  const metadata = copyJson(source.metadata)
  const shippingProfileId = source.shipping_profile?.id

  return {
    ...only(source, PRODUCT_FIELDS),
    title,
    handle,
    status: "draft",
    ...(metadata ? { metadata } : {}),
    ...(shippingProfileId ? { shipping_profile_id: shippingProfileId } : {}),
    tag_ids: (source.tags ?? []).map((tag) => tag.id),
    category_ids: (source.categories ?? []).map((category) => category.id),
    sales_channels: (source.sales_channels ?? []).map((channel) => ({
      id: channel.id,
    })),
    images: [...(source.images ?? [])].sort(byRank).map((image) => {
      const imageMetadata = copyJson(image.metadata)
      return {
        url: image.url,
        ...(imageMetadata ? { metadata: imageMetadata } : {}),
      }
    }),
    options: (source.options ?? []).map((option) => {
      const optionMetadata = copyJson(option.metadata)
      return {
        title: option.title,
        values: [...option.values].sort(byRank).map((value) => value.value),
        ...(present(option.is_exclusive)
          ? { is_exclusive: option.is_exclusive }
          : {}),
        ...(optionMetadata ? { metadata: optionMetadata } : {}),
      }
    }),
    variants: [...(source.variants ?? [])]
      .sort(
        (a, b) =>
          (a.variant_rank ?? Number.MAX_SAFE_INTEGER) -
          (b.variant_rank ?? Number.MAX_SAFE_INTEGER)
      )
      .map((variant) => {
        const variantMetadata = copyJson(variant.metadata)
        return {
          title: variant.title,
          options: Object.fromEntries(
            variant.options.map((choice) => [choice.option.title, choice.value])
          ),
          prices: copyPrices(variant),
          ...only(variant, VARIANT_FIELDS),
          ...(variantMetadata ? { metadata: variantMetadata } : {}),
        }
      }),
  }
}

/** The copy as read back once created: the ids it was given. */
export type CopiedProduct = {
  id: string
  options: {
    id: string
    title: string
    values: { id: string; value: string }[]
  }[]
  variants: { id: string; title: string; options: VariantChoice[] }[]
  images: { id: string; url: string }[]
}

/** A row of the Translation module. */
export type TranslationRow = {
  id: string
  reference: string
  reference_id: string
  locale_code: string
  translations: Record<string, unknown> | null
}

export type TranslationCopy = {
  reference: string
  reference_id: string
  locale_code: string
  translations: Record<string, unknown>
}

export type CopyExtras = {
  /** Variant thumbnails, which the create input has no place for. */
  variantThumbnails: { variant_id: string; thumbnail: string }[]
  /** Which pictures are tied to which variant, which the create input has no place for. */
  variantImages: { variant_id: string; image_id: string }[]
  /** The original's translations, pointed at the copy. */
  translations: TranslationCopy[]
}

/** A variant is told apart by its choices: Planter Gold, Size Small. */
const choicesKey = (choices: VariantChoice[]): string =>
  JSON.stringify(
    choices
      .map((choice) => [choice.option.title, choice.value])
      .sort((a, b) => (a.join("\u0000") < b.join("\u0000") ? -1 : 1))
  )

/**
 * What the create input cannot carry, worked out once the copy exists: each
 * original variant and picture is matched to its twin in the copy (a variant
 * by its choices, a picture by its address), and those matches decide where
 * the variant thumbnails, the variant pictures and the translations go.
 *
 * The translated title of the product is not carried over: the copy has a title
 * of its own, and the original's would name the wrong product. The title of an
 * option, a choice or a variant is the same in the copy, so it is kept.
 */
export const planCopyExtras = (
  source: SourceProduct,
  copy: CopiedProduct,
  translations: TranslationRow[]
): CopyExtras => {
  const sourceVariants = [...(source.variants ?? [])].sort(
    (a, b) =>
      (a.variant_rank ?? Number.MAX_SAFE_INTEGER) -
      (b.variant_rank ?? Number.MAX_SAFE_INTEGER)
  )

  const variantTwin = new Map<string, string>()
  const unmatched = new Map<string, string[]>()
  for (const variant of copy.variants) {
    const key = choicesKey(variant.options)
    unmatched.set(key, [...(unmatched.get(key) ?? []), variant.id])
  }
  for (const variant of sourceVariants) {
    const twin = unmatched.get(choicesKey(variant.options))?.shift()
    if (twin) {
      variantTwin.set(variant.id, twin)
    }
  }

  const imageTwin = new Map<string, string>()
  const unusedImages = [...copy.images]
  for (const image of [...(source.images ?? [])].sort(byRank)) {
    const index = unusedImages.findIndex((twin) => twin.url === image.url)
    if (index >= 0) {
      imageTwin.set(image.id, unusedImages.splice(index, 1)[0].id)
    }
  }

  const variantThumbnails: CopyExtras["variantThumbnails"] = []
  for (const variant of sourceVariants) {
    const twin = variantTwin.get(variant.id)
    if (twin && variant.thumbnail) {
      variantThumbnails.push({ variant_id: twin, thumbnail: variant.thumbnail })
    }
  }

  // Only the ties the original has. A picture tied to no variant is shown by
  // all of them, and is left that way.
  const variantImages: CopyExtras["variantImages"] = []
  for (const image of [...(source.images ?? [])].sort(byRank)) {
    const imageId = imageTwin.get(image.id)
    if (!imageId) {
      continue
    }
    for (const tied of image.variants ?? []) {
      const variantId = variantTwin.get(tied.id)
      if (variantId) {
        variantImages.push({ variant_id: variantId, image_id: imageId })
      }
    }
  }

  // Where each translated record went: "kind:original id" → the copy's id
  const twins = new Map<string, string>([[`product:${source.id}`, copy.id]])
  for (const option of source.options ?? []) {
    const optionTwin = copy.options.find((twin) => twin.title === option.title)
    if (!optionTwin) {
      continue
    }
    twins.set(`product_option:${option.id}`, optionTwin.id)
    for (const value of option.values) {
      const valueTwin = optionTwin.values.find(
        (twin) => twin.value === value.value
      )
      if (valueTwin) {
        twins.set(`product_option_value:${value.id}`, valueTwin.id)
      }
    }
  }
  for (const [sourceId, twinId] of variantTwin) {
    twins.set(`product_variant:${sourceId}`, twinId)
  }

  const copiedTranslations: TranslationCopy[] = []
  for (const row of translations) {
    const referenceId = twins.get(`${row.reference}:${row.reference_id}`)
    if (!referenceId) {
      continue
    }

    const texts = { ...(row.translations ?? {}) }
    if (row.reference === "product") {
      delete texts.title
    }
    if (!Object.keys(texts).length) {
      continue
    }

    copiedTranslations.push({
      reference: row.reference,
      reference_id: referenceId,
      locale_code: row.locale_code,
      translations: texts,
    })
  }

  return {
    variantThumbnails,
    variantImages,
    translations: copiedTranslations,
  }
}
