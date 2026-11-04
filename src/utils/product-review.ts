/**
 * Reads a product the way the storefront will, from what the database holds,
 * and says what is wrong or still to do. Plain data in, data out: the gathering
 * is `src/scripts/check-product.ts`.
 */

export type ReviewVariant = {
  title: string
  sku?: string | null
  manageInventory: boolean
  allowBackorder: boolean
  /** Prices as saved (price-list prices left out); `regionId` is the rule, if any. */
  prices: { currency: string; amount: number; regionId?: string | null }[]
  /** Pieces that can be sold, or null when the variant has no inventory item. */
  available: number | null
}

/** A record that has a German text, and the fields that have English text. */
export type TranslatableRecord = {
  reference: string
  id: string
  label: string
  fields: string[]
}

export type GermanRowState = {
  reference: string
  reference_id: string
  fields: string[]
}

export type ProductSnapshot = {
  id: string
  title: string
  handle: string
  status: string
  thumbnail?: string | null
  metadata: Record<string, unknown>
  images: number
  categories: string[]
  collection?: string | null
  type?: string | null
  tags: string[]
  shippingProfile?: { name: string; type?: string | null } | null
  salesChannels: string[]
  options: { title: string; values: string[] }[]
  variants: ReviewVariant[]
  regions: { id: string; name: string; currency: string }[]
  records: TranslatableRecord[]
  germanRows: GermanRowState[]
}

export type ProductReview = {
  lines: string[]
  /** What makes the page wrong or broken. */
  problems: string[]
  /** What is probably a slip. */
  warnings: string[]
  /** What the shop owner does next. */
  todo: string[]
}

const GERMAN_KEYS = ["de", "de-AT", "de-DE"]
const HUNGARIAN_KEYS = ["hu", "hu-HU"]

/** Metadata the storefront reads that holds one text per language. */
const TEXT_KEYS = [
  "short_description",
  "long_description",
  "care_instructions",
  "seo_title",
  "seo_description",
]

const hasText = (value: unknown): boolean =>
  typeof value === "string" && value.trim() !== ""

const isObject = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null && !Array.isArray(value)

type Parsed =
  | { kind: "text"; languages: Set<string> }
  | { kind: "list"; items: Set<string>[] }
  | { kind: "object"; value: Record<string, unknown> }
  | { kind: "invalid" }

/** A metadata value: plain English text, or JSON as the admin stores it. */
function readMetadata(value: unknown): Parsed {
  let stored = value
  if (typeof value === "string") {
    const trimmed = value.trim()
    if (trimmed.startsWith("{") || trimmed.startsWith("[")) {
      try {
        stored = JSON.parse(trimmed)
      } catch {
        return { kind: "invalid" }
      }
    } else {
      return { kind: "text", languages: new Set(hasText(trimmed) ? ["en"] : []) }
    }
  }

  const languagesOf = (item: unknown): Set<string> => {
    if (typeof item === "string") {
      return new Set(hasText(item) ? ["en"] : [])
    }
    return new Set(
      isObject(item)
        ? Object.entries(item)
            .filter(([, text]) => hasText(text))
            .map(([language]) => language)
        : []
    )
  }

  if (Array.isArray(stored)) {
    return { kind: "list", items: stored.map(languagesOf) }
  }
  if (isObject(stored)) {
    return { kind: "object", value: stored }
  }
  return { kind: "text", languages: languagesOf(stored) }
}

const has = (languages: Set<string>, keys: string[]) =>
  keys.some((key) => languages.has(key))

/** Fields of each record that have English text and no German text. */
export function germanGaps(
  records: TranslatableRecord[],
  rows: GermanRowState[]
): string[] {
  return records.flatMap((record) => {
    const row = rows.find(
      (candidate) =>
        candidate.reference === record.reference && candidate.reference_id === record.id
    )
    const missing = record.fields.filter((field) => !row?.fields.includes(field))
    return missing.length ? [`${record.label} (${missing.join(", ")})`] : []
  })
}

const money = (currency: string, amount: number) =>
  `${currency.toUpperCase()} ${amount.toLocaleString("en-US")}`

/** A label in the 16-wide column; one that is longer still keeps a space before its text. */
const label = (text: string) => (text.length < 16 ? text.padEnd(16) : `${text} `)

const list = (items: string[], max = 6) =>
  items.length > max
    ? `${items.slice(0, max).join(", ")} and ${items.length - max} more`
    : items.join(", ")

export function reviewProduct(product: ProductSnapshot): ProductReview {
  const review: ProductReview = { lines: [], problems: [], warnings: [], todo: [] }
  const { lines, problems, warnings, todo } = review
  const published = product.status === "published"

  lines.push(`${product.title} (${product.handle}, ${product.id})`)
  lines.push(`Status          ${product.status}`)

  // Where it appears and how it is delivered
  lines.push(
    `Categories      ${product.categories.length ? product.categories.join(", ") : "none"}`
  )
  if (product.collection) lines.push(`Collection      ${product.collection}`)
  if (product.type) lines.push(`Type            ${product.type}`)
  if (product.tags.length) lines.push(`Tags            ${product.tags.join(", ")}`)
  lines.push(
    `Shipping class  ${
      product.shippingProfile
        ? `${product.shippingProfile.name}${
            product.shippingProfile.type ? ` (${product.shippingProfile.type})` : ""
          }`
        : "none"
    }`
  )
  lines.push(
    `Sales channels  ${product.salesChannels.length ? product.salesChannels.join(", ") : "none"}`
  )

  if (!product.shippingProfile) {
    problems.push(
      "No shipping class: delivery cannot be priced for it. Give it Pallet or Carton products (the product → Shipping profile)."
    )
  }
  if (!product.salesChannels.length) {
    problems.push(
      "It is in no sales channel, so the storefront cannot show it: add the Default Sales Channel."
    )
  }
  if (!product.categories.length) {
    warnings.push("It is in no category, so no category page lists it.")
  }

  // Pictures and video
  const video = hasText(product.metadata.video_url)
  lines.push(
    `Pictures        ${product.images}${video ? " and a video" : ", no video"}${
      product.thumbnail ? "" : product.images ? " (no thumbnail set: the first picture is used)" : ""
    }`
  )
  if (product.images === 0) {
    const text =
      "It has no pictures: upload at least two in the admin (the product → Media)."
    if (published) {
      problems.push(`Published without pictures: ${text}`)
    } else {
      todo.push(text)
    }
  } else if (product.images === 1) {
    todo.push(
      "It has one picture: add a second one, the video (if any) shows after it."
    )
  }
  if (video && !hasText(product.metadata.video_poster)) {
    lines.push("Video           no still image, so the first picture is shown over it")
  }

  // Options and variants
  for (const option of product.options) {
    lines.push(`Option          ${option.title}: ${option.values.join(", ")}`)
  }
  if (!product.variants.length) {
    problems.push("It has no variants, so nothing can be bought or priced.")
  }

  // Prices, market by market
  const priced = (variant: ReviewVariant, currency: string) =>
    variant.prices.some((price) => price.currency === currency)

  for (const region of product.regions) {
    const withPrice = product.variants.filter((variant) =>
      priced(variant, region.currency)
    )
    if (!product.variants.length) break

    if (!withPrice.length) {
      lines.push(
        `${label(`Price ${region.name}`)}Price on request (no ${region.currency.toUpperCase()} price)`
      )
    } else {
      const amounts = [
        ...new Set(
          withPrice.map((variant) => {
            const price = variant.prices.find((p) => p.currency === region.currency)!
            return money(price.currency, price.amount)
          })
        ),
      ]
      lines.push(
        `${label(`Price ${region.name}`)}${amounts.join(" / ")}${
          withPrice.length < product.variants.length
            ? ` (${product.variants.length - withPrice.length} of ${product.variants.length} variants without)`
            : ""
        }`
      )
      if (withPrice.length < product.variants.length) {
        warnings.push(
          `${list(
            product.variants
              .filter((variant) => !priced(variant, region.currency))
              .map((variant) => variant.title)
          )} has no ${region.currency.toUpperCase()} price in ${region.name}.`
        )
      }
      const noRegionRow = withPrice.filter(
        (variant) =>
          !variant.prices.some(
            (price) => price.currency === region.currency && price.regionId === region.id
          )
      )
      if (noRegionRow.length) {
        warnings.push(
          `${list(noRegionRow.map((variant) => variant.title))} has a ${region.currency.toUpperCase()} price but none for the region ${region.name}: the admin's price table shows that column empty.`
        )
      }
    }
  }

  const anyPrice = product.regions.some((region) =>
    product.variants.some((variant) => priced(variant, region.currency))
  )
  if (product.variants.length && !anyPrice) {
    todo.push(
      "No price in any market: the page reads “Price on request”. Enter the prices when they are agreed."
    )
  } else if (anyPrice) {
    const unpriced = [
      ...new Set(
        product.regions
          .filter(
            (region) =>
              !product.variants.some((variant) => priced(variant, region.currency))
          )
          .map((region) => region.currency.toUpperCase())
      ),
    ]
    if (unpriced.length) {
      todo.push(
        `No ${unpriced.join(" and ")} price: that market reads “Price on request”.`
      )
    }
  }

  // Stock
  for (const variant of product.variants) {
    const stock = !variant.manageInventory
      ? "stock not tracked: always available"
      : variant.available === null
        ? "managed but has no inventory item"
        : variant.available > 0
          ? `${variant.available} available`
          : variant.allowBackorder
            ? "none in stock, backorders allowed"
            : "out of stock"
    lines.push(`Variant         ${variant.title}${variant.sku ? ` [${variant.sku}]` : ""}: ${stock}`)

    if (variant.manageInventory && variant.available === null) {
      problems.push(
        `The variant "${variant.title}" manages stock but has no inventory item: it cannot be stocked or bought.`
      )
    }
  }
  const buyable = product.variants.some(
    (variant) =>
      !variant.manageInventory ||
      variant.allowBackorder ||
      (variant.available ?? 0) > 0
  )
  if (product.variants.length && !buyable) {
    lines.push("Availability    out of stock everywhere: the page offers “Notify me”")
  }

  // Metadata the storefront reads
  for (const key of TEXT_KEYS) {
    const value = product.metadata[key]
    if (value === undefined || value === null || value === "") {
      if (["short_description", "seo_title", "seo_description"].includes(key)) {
        warnings.push(`metadata ${key} is empty.`)
      }
      continue
    }

    const read = readMetadata(value)
    if (read.kind === "invalid") {
      problems.push(`metadata ${key} looks like JSON but is not valid: it would be shown as written.`)
      continue
    }
    const languages =
      read.kind === "text"
        ? read.languages
        : read.kind === "object"
          ? new Set(
              Object.entries(read.value)
                .filter(([, text]) => hasText(text))
                .map(([language]) => language)
            )
          : new Set<string>()
    const shown = [
      languages.has("en") ? "en" : "",
      has(languages, GERMAN_KEYS) ? "de" : "",
      has(languages, HUNGARIAN_KEYS) ? "hu" : "",
    ].filter(Boolean)
    lines.push(`Metadata        ${key}: ${shown.join(", ") || "no text"}`)

    if (!languages.has("en")) {
      problems.push(`metadata ${key} has no English text, which is what other languages fall back to.`)
    } else if (!has(languages, GERMAN_KEYS)) {
      warnings.push(`metadata ${key} has no German: German visitors read the English.`)
    } else if (!has(languages, HUNGARIAN_KEYS)) {
      warnings.push(`metadata ${key} has no Hungarian.`)
    }

    const english =
      read.kind === "text" ? String(value).trim() : String((read as any).value?.en ?? "")
    const limit = key === "seo_title" ? 70 : key === "seo_description" ? 160 : 0
    if (limit && english.length > limit) {
      warnings.push(
        `${key} is ${english.length} characters; search results cut it at about ${
          key === "seo_title" ? "60–70" : "160"
        }.`
      )
    }
  }

  const features = product.metadata.key_features
  if (features !== undefined && features !== null && features !== "") {
    const read = readMetadata(features)
    if (read.kind !== "list") {
      problems.push(
        "metadata key_features must be a list of texts, e.g. [{\"en\": \"Maintenance-free\"}]."
      )
    } else {
      const german = read.items.filter((item) => has(item, GERMAN_KEYS)).length
      const hungarian = read.items.filter((item) => has(item, HUNGARIAN_KEYS)).length
      lines.push(
        `Metadata        key_features: ${read.items.length} (German ${german}, Hungarian ${hungarian})`
      )
      if (german < read.items.length) {
        warnings.push(
          `${read.items.length - german} of ${read.items.length} key features have no German.`
        )
      }
    }
  }

  const dimensions = product.metadata.approx_dimensions
  if (dimensions !== undefined && dimensions !== null && dimensions !== "") {
    const read = readMetadata(dimensions)
    if (read.kind !== "object") {
      problems.push(
        "metadata approx_dimensions must be {\"height\": \"160–180\", \"width\": \"140–170\", \"depth\": \"80–100\", \"unit\": \"cm\"}."
      )
    } else {
      lines.push(`Metadata        approx_dimensions: ${JSON.stringify(read.value)}`)
    }
  }

  // German rows
  const gaps = germanGaps(product.records, product.germanRows)
  lines.push(
    `German texts    ${
      gaps.length
        ? `${product.records.length - gaps.length} of ${product.records.length} records complete`
        : `all ${product.records.length} records complete`
    }`
  )
  if (gaps.length) {
    warnings.push(`No German saved for: ${list(gaps)}.`)
  }

  if (product.status === "draft") {
    todo.push(
      "It is a draft, so it is not on the storefront. Publish it (the product → Status) when the pictures and prices are right."
    )
  }

  return review
}
