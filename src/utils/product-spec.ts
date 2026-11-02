import {
  CARTON_PRODUCT_PATTERN,
  PALLET_PRODUCT_PATTERN,
} from "../scripts/shipping-classes"
import type { Texts } from "./localized-metadata"

/**
 * A product as the shop owner hands it over, written once as a JSON file (a
 * "spec", see `product-specs/` and `src/scripts/add-product.ts`). This is the
 * part that is plain data in, data out, so it needs no database: it reads and
 * checks a spec, works out the options and variants, and builds what Medusa is
 * given and the German rows to save.
 *
 * Every text is English, or one text per language:
 *
 *   "Maintenance-free"
 *   { "en": "Maintenance-free", "de": "Pflegefrei", "hu": "Karbantartásmentes" }
 *
 * English is the product's own text. German is saved as `de-DE` translation
 * rows (the one German locale the store offers; the storefront asks for it in
 * Austria and Germany alike), Hungarian only in the product's metadata, which
 * is where every product keeps it (the storefront has no Hungarian pages).
 */

export type Language = "en" | "de" | "hu"

/** One text in the languages it was written in; English is always there. */
export type Lang = { en: string; de?: string; hu?: string }

export type ProductStatus = "draft" | "published"
export type ShippingClass = "pallet" | "carton"

export type PlanOption = { title: Lang; values: Lang[] }

export type PlanVariant = {
  title: Lang
  /** English option title → English value. */
  options: Record<string, string>
  sku?: string
  /** Currency code → amount, as shown (49.99, not cents). No entry: no price. */
  prices: Record<string, number>
  stock: number
  manageInventory: boolean
  allowBackorder: boolean
}

/** A spec that was read and checked, with every default filled in. */
export type ProductPlan = {
  handle: string
  status: ProductStatus
  title: Lang
  /** The badge on the product's cards ("One of a kind"). */
  subtitle?: Lang
  /** Paragraphs joined by a blank line, which the product page keeps. */
  description?: Lang
  shortDescription?: Lang
  /** HTML for the Description section. */
  longDescription?: Lang
  keyFeatures: Lang[]
  careInstructions?: Lang
  approxDimensions?: {
    height?: string
    width?: string
    depth?: string
    unit: string
  }
  /** Medusa's own fields: cm and grams. */
  dimensions: { height?: number; width?: number; length?: number; weight?: number }
  material?: string
  originCountry?: string
  seoTitle?: Lang
  seoDescription?: Lang
  categories: Lang[]
  collection?: string
  type?: string
  tags: string[]
  shippingClass: ShippingClass
  salesChannel?: string
  stockLocation?: string
  options: PlanOption[]
  variants: PlanVariant[]
  /** No options in the spec: one default option and variant, as the admin makes. */
  simple: boolean
  /** Other metadata keys, written as JSON text where they are not text. */
  extraMetadata: Record<string, string>
}

export type SpecResult =
  | { ok: true; plan: ProductPlan; warnings: string[]; notes: string[] }
  | { ok: false; errors: string[]; warnings: string[]; notes: string[] }

/** What the admin names the option and variant of a product without choices. */
export const DEFAULT_CHOICE = {
  option: "Default option",
  value: "Default option value",
  variant: "Default variant",
}

const LANGUAGES: readonly Language[] = ["en", "de", "hu"]

const TOP_LEVEL_FIELDS = [
  "title",
  "handle",
  "subtitle",
  "status",
  "description",
  "shortDescription",
  "longDescription",
  "keyFeatures",
  "careInstructions",
  "approxDimensions",
  "dimensions",
  "material",
  "originCountry",
  "seo",
  "categories",
  "collection",
  "type",
  "tags",
  "shippingClass",
  "salesChannel",
  "stockLocation",
  "options",
  "variants",
  "prices",
  "stock",
  "sku",
  "metadata",
] as const

const VARIANT_FIELDS = [
  "options",
  "title",
  "sku",
  "prices",
  "stock",
  "manageInventory",
  "allowBackorder",
] as const

/** Metadata keys the spec fills from its own fields, so `metadata` may not. */
const MANAGED_METADATA_KEYS = [
  "short_description",
  "long_description",
  "key_features",
  "care_instructions",
  "approx_dimensions",
  "seo_title",
  "seo_description",
  // The Product video box owns these (it checks the file); see the CLAUDE.md.
  "video_url",
  "video_poster",
]

const HANDLE_PATTERN = /^[a-z0-9]+(?:-[a-z0-9]+)*$/

/** A URL-safe handle from free text, the same rules as the admin's preview. */
export const handleFromTitle = (title: string): string =>
  title
    .normalize("NFKD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/ß/g, "ss")
    .replace(/&/g, " and ")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "") || "product"

const isObject = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null && !Array.isArray(value)

const clean = (value: string): string => value.replace(/\r\n?/g, "\n").trim()

/** "160-180" is written as the range it is: "160–180". */
const asRange = (value: string): string =>
  value.replace(/(\d)\s*-\s*(\d)/g, "$1–$2")

type Context = {
  errors: string[]
  warnings: string[]
  notes: string[]
  /** Paths of texts without German, for one warning instead of many. */
  noGerman: string[]
  noHungarian: string[]
  unusedHungarian: string[]
  sameGerman: string[]
}

const newContext = (): Context => ({
  errors: [],
  warnings: [],
  notes: [],
  noGerman: [],
  noHungarian: [],
  unusedHungarian: [],
  sameGerman: [],
})

const listOf = (items: string[], max = 8): string =>
  items.length > max
    ? `${items.slice(0, max).join(", ")} and ${items.length - max} more`
    : items.join(", ")

type TextOptions = {
  required?: boolean
  /** A text that may also be a list of paragraphs. */
  prose?: boolean
  /** A text the product keeps in its metadata, where Hungarian is stored. */
  metadata?: boolean
}

/** Reads a text: plain English, or one text per language. */
function readText(
  value: unknown,
  path: string,
  context: Context,
  { required = false, prose = false, metadata = false }: TextOptions = {}
): Lang | undefined {
  if (value === undefined || value === null) {
    if (required) {
      context.errors.push(`${path} is required.`)
    }
    return undefined
  }

  const one = (item: unknown, at: string): string | undefined => {
    if (typeof item === "string") {
      return clean(item) || undefined
    }
    if (prose && Array.isArray(item) && item.every((p) => typeof p === "string")) {
      return item.map(clean).filter(Boolean).join("\n\n") || undefined
    }
    context.errors.push(
      `${at} must be ${prose ? "text or a list of paragraphs" : "text"}.`
    )
    return undefined
  }

  let lang: Lang | undefined

  if (isObject(value)) {
    const unknown = Object.keys(value).find(
      (key) => !(LANGUAGES as readonly string[]).includes(key)
    )
    if (unknown) {
      context.errors.push(
        `${path} has the language "${unknown}": use en, de or hu.`
      )
    }

    const englishMissing = `${path} needs an English text ("en"): English is the product's own text.`
    if (value.en === undefined || value.en === null) {
      context.errors.push(englishMissing)
      return undefined
    }

    const en = one(value.en, `${path}.en`)
    if (!en) {
      if (typeof value.en === "string") {
        context.errors.push(englishMissing)
      }
      return undefined
    }

    lang = { en }
    for (const language of ["de", "hu"] as const) {
      if (value[language] !== undefined) {
        const text = one(value[language], `${path}.${language}`)
        if (text) {
          lang[language] = text
        }
      }
    }
  } else {
    const en = one(value, path)
    if (!en) {
      if (typeof value === "string") {
        context.errors.push(`${path} must not be empty.`)
      }
      return undefined
    }
    lang = { en }
  }

  if (!lang.de) {
    context.noGerman.push(path)
  } else if (lang.de === lang.en && lang.en.length > 30) {
    context.sameGerman.push(path)
  }
  if (metadata && !lang.hu) {
    context.noHungarian.push(path)
  }
  if (!metadata && lang.hu) {
    context.unusedHungarian.push(path)
  }

  return lang
}

function readPrices(
  value: unknown,
  path: string,
  context: Context
): Record<string, number> | undefined {
  if (value === undefined || value === null) {
    return undefined
  }
  if (!isObject(value)) {
    context.errors.push(
      `${path} must list an amount per currency, such as { "eur": 1990, "huf": 720000 }.`
    )
    return undefined
  }

  const prices: Record<string, number> = {}
  for (const [currency, amount] of Object.entries(value)) {
    const code = currency.trim().toLowerCase()
    if (!/^[a-z]{3}$/.test(code)) {
      context.errors.push(
        `${path}.${currency} is not a currency code (use eur, huf …).`
      )
      continue
    }
    if (typeof amount !== "number" || !Number.isFinite(amount) || amount <= 0) {
      context.errors.push(
        `${path}.${currency} must be a number above zero. For no price at all, leave the currency out: the product then reads "Price on request".`
      )
      continue
    }
    if (Math.round(amount * 100) / 100 !== amount) {
      context.errors.push(
        `${path}.${currency} has more than two decimals (${amount}).`
      )
      continue
    }
    if (code === "huf" && !Number.isInteger(amount)) {
      context.warnings.push(`${path}.${currency} has decimals; forints are whole.`)
    }
    prices[code] = amount
  }
  return prices
}

function readStock(
  value: unknown,
  path: string,
  context: Context
): number | undefined {
  if (value === undefined || value === null) {
    return undefined
  }
  if (typeof value !== "number" || !Number.isInteger(value) || value < 0) {
    context.errors.push(`${path} must be a whole number, zero or more.`)
    return undefined
  }
  return value
}

function readFlag(
  value: unknown,
  path: string,
  context: Context
): boolean | undefined {
  if (value === undefined || value === null) {
    return undefined
  }
  if (typeof value !== "boolean") {
    context.errors.push(`${path} must be true or false.`)
    return undefined
  }
  return value
}

function readName(
  value: unknown,
  path: string,
  context: Context
): string | undefined {
  if (value === undefined || value === null) {
    return undefined
  }
  if (typeof value !== "string" || !clean(value)) {
    context.errors.push(`${path} must be text.`)
    return undefined
  }
  return clean(value)
}

function readDimensions(
  value: unknown,
  context: Context
): ProductPlan["dimensions"] {
  const dimensions: ProductPlan["dimensions"] = {}
  if (value === undefined || value === null) {
    return dimensions
  }
  if (!isObject(value)) {
    context.errors.push(
      `dimensions must be { "height": 220, "width": 120, "length": 120 } in centimetres (weight in grams).`
    )
    return dimensions
  }

  for (const [key, amount] of Object.entries(value)) {
    if (!["height", "width", "length", "weight"].includes(key)) {
      context.errors.push(
        `dimensions.${key} is not a field: use height, width, length (the depth) or weight.`
      )
      continue
    }
    if (typeof amount !== "number" || !Number.isFinite(amount) || amount <= 0) {
      context.errors.push(`dimensions.${key} must be a number above zero.`)
      continue
    }
    dimensions[key as keyof ProductPlan["dimensions"]] = amount
  }
  return dimensions
}

function readApproxDimensions(
  value: unknown,
  context: Context
): ProductPlan["approxDimensions"] {
  if (value === undefined || value === null) {
    return undefined
  }
  if (!isObject(value)) {
    context.errors.push(
      `approxDimensions must be { "height": "160–180", "width": "140–170", "depth": "80–100", "unit": "cm" }.`
    )
    return undefined
  }

  const approx: NonNullable<ProductPlan["approxDimensions"]> = { unit: "cm" }
  for (const [key, item] of Object.entries(value)) {
    if (key === "unit") {
      if (typeof item !== "string" || !item.trim()) {
        context.errors.push("approxDimensions.unit must be text.")
      } else {
        approx.unit = item.trim()
      }
      continue
    }
    if (!["height", "width", "depth"].includes(key)) {
      context.errors.push(
        `approxDimensions.${key} is not a field: use height, width, depth or unit.`
      )
      continue
    }
    if (
      (typeof item !== "string" && typeof item !== "number") ||
      !String(item).trim()
    ) {
      context.errors.push(`approxDimensions.${key} must be a figure or a range.`)
      continue
    }
    approx[key as "height" | "width" | "depth"] = asRange(String(item).trim())
  }

  if (!approx.height && !approx.width && !approx.depth) {
    context.errors.push(
      "approxDimensions needs a height, width or depth (leave it out when there are none)."
    )
    return undefined
  }
  return approx
}

/** Every combination of the options' values, the last option varying fastest. */
function combinations(options: PlanOption[]): Record<string, string>[] {
  let rows: Record<string, string>[] = [{}]
  for (const option of options) {
    rows = rows.flatMap((row) =>
      option.values.map((value) => ({ ...row, [option.title.en]: value.en }))
    )
  }
  return rows
}

function variantTitle(options: PlanOption[], choice: Record<string, string>): Lang {
  const values = options.map(
    (option) => option.values.find((value) => value.en === choice[option.title.en])!
  )
  const en = values.map((value) => value.en).join(" / ")

  return values.every((value) => value.de)
    ? { en, de: values.map((value) => value.de).join(" / ") }
    : { en }
}

function rejectUnknown(
  value: Record<string, unknown>,
  allowed: readonly string[],
  path: string,
  context: Context
) {
  for (const key of Object.keys(value)) {
    if (key.startsWith("_") || key.startsWith("$") || allowed.includes(key)) {
      continue
    }
    const near = allowed.find(
      (field) => field.toLowerCase() === key.toLowerCase().replace(/[_\s-]/g, "")
    )
    context.errors.push(
      `Unknown field "${path}${key}"${near ? ` (did you mean "${near}"?)` : ""}.`
    )
  }
}

/**
 * Reads and checks a spec. Errors are what would make the product wrong or
 * impossible to make; warnings are what is probably a slip; notes say what the
 * spec means for the shop (no price, no stock, a draft) so nobody is surprised.
 */
export function parseProductSpec(raw: unknown): SpecResult {
  const context = newContext()

  if (!isObject(raw)) {
    return {
      ok: false,
      errors: ["The spec must be a JSON object, { \"title\": …, … }."],
      warnings: [],
      notes: [],
    }
  }

  rejectUnknown(raw, TOP_LEVEL_FIELDS, "", context)

  const title = readText(raw.title, "title", context, { required: true })
  if (title && title.en.length > 255) {
    context.errors.push("title is longer than 255 characters.")
  }

  let handle = ""
  if (raw.handle !== undefined && raw.handle !== null) {
    if (typeof raw.handle !== "string" || !HANDLE_PATTERN.test(raw.handle)) {
      context.errors.push(
        `handle "${String(raw.handle)}" must be lower-case words joined by hyphens, such as "blue-cascade".`
      )
    } else {
      handle = raw.handle
    }
  } else if (title) {
    handle = handleFromTitle(title.en)
  }

  let status: ProductStatus = "draft"
  if (raw.status !== undefined && raw.status !== null) {
    if (raw.status === "draft" || raw.status === "published") {
      status = raw.status
    } else {
      context.errors.push(`status must be "draft" or "published".`)
    }
  }

  const subtitle = readText(raw.subtitle, "subtitle", context)
  const description = readText(raw.description, "description", context, {
    prose: true,
  })
  const shortDescription = readText(raw.shortDescription, "shortDescription", context, {
    metadata: true,
  })
  const longDescription = readText(raw.longDescription, "longDescription", context, {
    metadata: true,
  })
  const careInstructions = readText(raw.careInstructions, "careInstructions", context, {
    metadata: true,
  })

  const keyFeatures: Lang[] = []
  if (raw.keyFeatures !== undefined && raw.keyFeatures !== null) {
    if (!Array.isArray(raw.keyFeatures)) {
      context.errors.push("keyFeatures must be a list of texts.")
    } else {
      raw.keyFeatures.forEach((item, index) => {
        const feature = readText(item, `keyFeatures[${index}]`, context, {
          required: true,
          metadata: true,
        })
        if (feature) {
          keyFeatures.push(feature)
        }
      })
      const english = keyFeatures.map((feature) => feature.en.toLowerCase())
      if (new Set(english).size !== english.length) {
        context.errors.push(
          "keyFeatures has the same English text twice: a feature is found by its English text."
        )
      }
    }
  }

  let seoTitle: Lang | undefined
  let seoDescription: Lang | undefined
  if (raw.seo !== undefined && raw.seo !== null) {
    if (!isObject(raw.seo)) {
      context.errors.push(`seo must be { "title": …, "description": … }.`)
    } else {
      rejectUnknown(raw.seo, ["title", "description"], "seo.", context)
      seoTitle = readText(raw.seo.title, "seo.title", context, { metadata: true })
      seoDescription = readText(raw.seo.description, "seo.description", context, {
        metadata: true,
      })
    }
  }

  const categories: Lang[] = []
  if (raw.categories !== undefined && raw.categories !== null) {
    if (!Array.isArray(raw.categories)) {
      context.errors.push("categories must be a list of names.")
    } else {
      raw.categories.forEach((item, index) => {
        const category = readText(item, `categories[${index}]`, context, {
          required: true,
        })
        if (category) {
          categories.push(category)
        }
      })
    }
  }

  const tags: string[] = []
  if (raw.tags !== undefined && raw.tags !== null) {
    if (!Array.isArray(raw.tags)) {
      context.errors.push("tags must be a list of names.")
    } else {
      raw.tags.forEach((item, index) => {
        const tag = readName(item, `tags[${index}]`, context)
        if (tag) {
          tags.push(tag)
        }
      })
    }
  }

  const shippingClass = raw.shippingClass
  if (shippingClass !== "pallet" && shippingClass !== "carton") {
    context.errors.push(
      `shippingClass is required: "pallet" (a piece takes a pallet) or "carton" (a piece travels in a carton). Delivery is priced by it.`
    )
  }

  const dimensions = readDimensions(raw.dimensions, context)
  const approxDimensions = readApproxDimensions(raw.approxDimensions, context)
  const material = readName(raw.material, "material", context)

  let originCountry: string | undefined
  if (raw.originCountry !== undefined && raw.originCountry !== null) {
    if (typeof raw.originCountry !== "string" || !/^[A-Za-z]{2}$/.test(raw.originCountry)) {
      context.errors.push(`originCountry must be a two-letter country code such as "AT".`)
    } else {
      originCountry = raw.originCountry.toUpperCase()
    }
  }

  const collection = readName(raw.collection, "collection", context)
  const type = readName(raw.type, "type", context)
  const salesChannel = readName(raw.salesChannel, "salesChannel", context)
  const stockLocation = readName(raw.stockLocation, "stockLocation", context)

  const extraMetadata: Record<string, string> = {}
  if (raw.metadata !== undefined && raw.metadata !== null) {
    if (!isObject(raw.metadata)) {
      context.errors.push("metadata must be an object of keys and values.")
    } else {
      for (const [key, value] of Object.entries(raw.metadata)) {
        if (MANAGED_METADATA_KEYS.includes(key)) {
          context.errors.push(
            `metadata.${key} is set from its own field${
              key.startsWith("video_")
                ? ": add the video in the admin's Product video box"
                : ""
            }.`
          )
        } else if (value !== null && value !== undefined) {
          extraMetadata[key] =
            typeof value === "string" ? value : JSON.stringify(value)
        }
      }
    }
  }

  // Options and variants
  const options: PlanOption[] = []
  if (raw.options !== undefined && raw.options !== null) {
    if (!Array.isArray(raw.options)) {
      context.errors.push("options must be a list of { title, values }.")
    } else {
      raw.options.forEach((item, index) => {
        const path = `options[${index}]`
        if (!isObject(item)) {
          context.errors.push(`${path} must be { "title": …, "values": […] }.`)
          return
        }
        rejectUnknown(item, ["title", "values"], `${path}.`, context)

        const optionTitle = readText(item.title, `${path}.title`, context, {
          required: true,
        })
        const values: Lang[] = []
        if (!Array.isArray(item.values) || item.values.length === 0) {
          context.errors.push(`${path}.values must list at least one value.`)
        } else {
          item.values.forEach((entry, at) => {
            const value = readText(entry, `${path}.values[${at}]`, context, {
              required: true,
            })
            if (value) {
              values.push(value)
            }
          })
          const english = values.map((value) => value.en.toLowerCase())
          if (new Set(english).size !== english.length) {
            context.errors.push(`${path}.values has the same value twice.`)
          }
        }
        if (optionTitle) {
          options.push({ title: optionTitle, values })
        }
      })
      const names = options.map((option) => option.title.en.toLowerCase())
      if (new Set(names).size !== names.length) {
        context.errors.push("options has the same option twice.")
      }
    }
  }

  const defaultPrices = readPrices(raw.prices, "prices", context)
  const defaultStock = readStock(raw.stock, "stock", context)
  const topSku = readName(raw.sku, "sku", context)

  const variants: PlanVariant[] = []
  const simple = options.length === 0 && !context.errors.some((e) => e.startsWith("options"))

  const makeVariant = (
    choice: Record<string, string>,
    given: Record<string, unknown> | undefined,
    path: string
  ): PlanVariant => {
    if (given) {
      rejectUnknown(given, VARIANT_FIELDS, `${path}.`, context)
    }

    const ownTitle = readText(given?.title, `${path}.title`, context)
    const prices =
      given?.prices !== undefined
        ? readPrices(given.prices, `${path}.prices`, context) ?? {}
        : defaultPrices ?? {}
    const stock = readStock(given?.stock, `${path}.stock`, context) ?? defaultStock ?? 0

    return {
      title:
        ownTitle ??
        (simple ? { en: DEFAULT_CHOICE.variant } : variantTitle(options, choice)),
      options: choice,
      sku: readName(given?.sku, `${path}.sku`, context),
      prices,
      stock,
      // The shop's variants all manage stock and none take backorders.
      manageInventory:
        readFlag(given?.manageInventory, `${path}.manageInventory`, context) ?? true,
      allowBackorder:
        readFlag(given?.allowBackorder, `${path}.allowBackorder`, context) ?? false,
    }
  }

  if (raw.variants !== undefined && raw.variants !== null && !Array.isArray(raw.variants)) {
    context.errors.push("variants must be a list.")
  } else if (simple) {
    const given = (raw.variants as unknown[] | undefined) ?? []
    if (given.length > 1) {
      context.errors.push(
        "Several variants need options: add an option (such as Planter) with a value for each."
      )
    } else {
      const only = given[0]
      if (only !== undefined && !isObject(only)) {
        context.errors.push("variants[0] must be an object.")
      } else {
        if (only && only.options !== undefined) {
          context.errors.push("variants[0].options needs the product's options list.")
        }
        variants.push(
          makeVariant({ [DEFAULT_CHOICE.option]: DEFAULT_CHOICE.value }, only, "variants[0]")
        )
      }
    }
  } else if (raw.variants === undefined || raw.variants === null) {
    for (const [index, choice] of combinations(options).entries()) {
      variants.push(makeVariant(choice, undefined, `variants[${index}]`))
    }
  } else {
    const used = new Set<string>()
    ;(raw.variants as unknown[]).forEach((item, index) => {
      const path = `variants[${index}]`
      if (!isObject(item) || !isObject(item.options)) {
        context.errors.push(
          `${path}.options must name a value for every option, such as { "Planter": "Blue" }.`
        )
        return
      }

      const choice: Record<string, string> = {}
      let valid = true
      for (const option of options) {
        const picked = item.options[option.title.en]
        if (typeof picked !== "string" || !option.values.some((v) => v.en === picked)) {
          context.errors.push(
            `${path}.options.${option.title.en} must be one of: ${option.values
              .map((value) => value.en)
              .join(", ")}.`
          )
          valid = false
        } else {
          choice[option.title.en] = picked
        }
      }
      for (const key of Object.keys(item.options)) {
        if (!options.some((option) => option.title.en === key)) {
          context.errors.push(`${path}.options.${key} is not one of the product's options.`)
          valid = false
        }
      }
      if (!valid) {
        return
      }

      const signature = JSON.stringify(options.map((o) => choice[o.title.en]))
      if (used.has(signature)) {
        context.errors.push(`${path} repeats a combination of options another variant has.`)
        return
      }
      used.add(signature)
      variants.push(makeVariant(choice, item, path))
    })

    for (const option of options) {
      for (const value of option.values) {
        if (!variants.some((variant) => variant.options[option.title.en] === value.en)) {
          context.warnings.push(
            `${option.title.en} "${value.en}" has no variant, so it cannot be chosen.`
          )
        }
      }
    }
  }

  if (topSku) {
    if (variants.length === 1) {
      variants[0].sku = variants[0].sku ?? topSku
    } else {
      context.errors.push(
        "sku at the top is for a product with one variant: give each variant its own sku."
      )
    }
  }
  const skus = variants.map((variant) => variant.sku).filter(Boolean)
  if (new Set(skus).size !== skus.length) {
    context.errors.push("Two variants have the same sku: a SKU belongs to one variant.")
  }

  // Warnings and notes
  if (!description && !shortDescription) {
    context.warnings.push(
      "No description: the product page has no text. Add description (and shortDescription for the line under the title)."
    )
  }
  if (shortDescription && !description && !longDescription) {
    context.warnings.push(
      "There is a shortDescription but no description, so the page has no Description section."
    )
  }
  if (categories.length === 0) {
    context.warnings.push(
      "No category: the product is not listed in any category page."
    )
  }
  if (seoTitle && seoTitle.en.length > 70) {
    context.warnings.push(
      `seo.title is ${seoTitle.en.length} characters; search results cut it at about 60–70.`
    )
  }
  if (seoDescription && seoDescription.en.length > 160) {
    context.warnings.push(
      `seo.description is ${seoDescription.en.length} characters; search results cut it at about 160.`
    )
  }
  if (!seoTitle || !seoDescription) {
    context.warnings.push(
      "No SEO title or description: the page then uses the product's name and description."
    )
  }
  if (approxDimensions && (dimensions.height || dimensions.width || dimensions.length)) {
    context.warnings.push(
      "Both dimensions and approxDimensions are given: the page shows the exact figure where there is one and the range for the rest."
    )
  }

  if (title && (shippingClass === "pallet" || shippingClass === "carton")) {
    const byName = CARTON_PRODUCT_PATTERN.test(title.en)
      ? "carton"
      : PALLET_PRODUCT_PATTERN.test(title.en)
        ? "pallet"
        : undefined
    if (byName && byName !== shippingClass) {
      context.warnings.push(
        `The name sorts into the ${byName} class in shipping-classes.ts, so "setup-shipping" would move this ${shippingClass} product there the next time it runs.`
      )
    }
  }

  const priced = variants.filter((variant) => Object.keys(variant.prices).length)
  if (variants.length && priced.length === 0) {
    context.notes.push(
      `No price: the product shows "Price on request" and cannot be bought.`
    )
  } else if (priced.length && priced.length < variants.length) {
    context.warnings.push(
      `${variants.length - priced.length} of ${variants.length} variants have no price and read "Price on request": ${listOf(
        variants.filter((v) => !Object.keys(v.prices).length).map((v) => v.title.en)
      )}.`
    )
  }
  const currencies = new Set(priced.flatMap((variant) => Object.keys(variant.prices)))
  for (const currency of currencies) {
    const without = priced.filter((variant) => variant.prices[currency] === undefined)
    if (without.length) {
      context.warnings.push(
        `${without.length} variant(s) have no ${currency.toUpperCase()} price: ${listOf(
          without.map((variant) => variant.title.en)
        )}.`
      )
    }
  }

  if (variants.length && variants.every((variant) => variant.stock === 0)) {
    context.notes.push(
      "No stock: every choice is out of stock, and the page offers “Notify me”."
    )
  }
  if (status === "draft") {
    context.notes.push("A draft: it stays off the storefront until it is published.")
  }

  if (context.noGerman.length) {
    context.warnings.push(
      `No German for ${listOf(context.noGerman)}: German visitors see the English text there.`
    )
  }
  if (context.sameGerman.length) {
    context.warnings.push(
      `The German is the same as the English for ${listOf(context.sameGerman)}: not translated yet?`
    )
  }
  if (context.noHungarian.length) {
    context.warnings.push(
      `No Hungarian for ${listOf(context.noHungarian)}: every product keeps Hungarian next to the English in its metadata.`
    )
  }
  if (context.unusedHungarian.length) {
    context.warnings.push(
      `Hungarian for ${listOf(context.unusedHungarian)} is not used: only the metadata texts keep Hungarian (short, long and care text, key features, SEO).`
    )
  }

  if (context.errors.length || !title || !shippingClass) {
    return {
      ok: false,
      errors: context.errors,
      warnings: context.warnings,
      notes: context.notes,
    }
  }

  return {
    ok: true,
    warnings: context.warnings,
    notes: context.notes,
    plan: {
      handle,
      status,
      title,
      subtitle,
      description,
      shortDescription,
      longDescription,
      keyFeatures,
      careInstructions,
      approxDimensions,
      dimensions,
      material,
      originCountry,
      seoTitle,
      seoDescription,
      categories,
      collection,
      type,
      tags,
      shippingClass: shippingClass as ShippingClass,
      salesChannel,
      stockLocation,
      options: simple
        ? [
            {
              title: { en: DEFAULT_CHOICE.option },
              values: [{ en: DEFAULT_CHOICE.value }],
            },
          ]
        : options,
      variants,
      simple,
      extraMetadata,
    },
  }
}

// ---------------------------------------------------------------------------
// What Medusa is given
// ---------------------------------------------------------------------------

/**
 * The metadata a product is created with: English only, written the way the
 * admin's metadata editor stores it (structured values as JSON text). The other
 * languages are added afterwards by `metadataLanguages()`.
 */
export function englishMetadata(plan: ProductPlan): Record<string, string> {
  const metadata: Record<string, string> = {}

  if (plan.shortDescription) {
    metadata.short_description = plan.shortDescription.en
  }
  if (plan.longDescription) {
    metadata.long_description = plan.longDescription.en
  }
  if (plan.keyFeatures.length) {
    metadata.key_features = JSON.stringify(
      plan.keyFeatures.map((feature) => ({ en: feature.en }))
    )
  }
  if (plan.careInstructions) {
    metadata.care_instructions = plan.careInstructions.en
  }
  if (plan.approxDimensions) {
    const { height, width, depth, unit } = plan.approxDimensions
    metadata.approx_dimensions = JSON.stringify({
      ...(height ? { height } : {}),
      ...(width ? { width } : {}),
      ...(depth ? { depth } : {}),
      unit,
    })
  }
  if (plan.seoTitle) {
    metadata.seo_title = plan.seoTitle.en
  }
  if (plan.seoDescription) {
    metadata.seo_description = plan.seoDescription.en
  }

  return { ...metadata, ...plan.extraMetadata }
}

/** One text by language for a metadata field (see `localized-metadata.ts`). */
function metadataTexts(lang: Lang, shape: "market" | "language"): Texts | null {
  if (!lang.de && !lang.hu) {
    return null
  }

  const texts: Texts = { en: lang.en }
  if (lang.de) {
    if (shape === "market") {
      // The store offers one German; both markets read the same text.
      texts["de-AT"] = lang.de
      texts["de-DE"] = lang.de
    } else {
      texts.de = lang.de
    }
  }
  if (lang.hu) {
    if (shape === "market") {
      texts["hu-HU"] = lang.hu
    } else {
      texts.hu = lang.hu
    }
  }
  return texts
}

export type MetadataLanguages = {
  /** Metadata key → the text in its languages. */
  texts: Record<string, Texts>
  /** Metadata key → the list of texts (`key_features`), each in its languages. */
  lists: Record<string, Texts[]>
}

/**
 * The other languages of the metadata texts. The page's own short, care and SEO
 * texts are stored per market (`de-AT`, `de-DE`, `hu-HU`), the long description
 * per language (`de`, `hu`), as the admin's Long description box saves it.
 */
export function metadataLanguages(plan: ProductPlan): MetadataLanguages {
  const texts: Record<string, Texts> = {}
  const lists: Record<string, Texts[]> = {}

  const fields: [string, Lang | undefined, "market" | "language"][] = [
    ["short_description", plan.shortDescription, "market"],
    ["care_instructions", plan.careInstructions, "market"],
    ["seo_title", plan.seoTitle, "market"],
    ["seo_description", plan.seoDescription, "market"],
    ["long_description", plan.longDescription, "language"],
  ]
  for (const [key, lang, shape] of fields) {
    const value = lang ? metadataTexts(lang, shape) : null
    if (value) {
      texts[key] = value
    }
  }

  const features = plan.keyFeatures
    .map((feature) => metadataTexts(feature, "market"))
    .filter((feature): feature is Texts => feature !== null)
  if (features.length) {
    lists.key_features = features
  }

  return { texts, lists }
}

export type PriceRow = {
  currency_code: string
  amount: number
  rules?: { region_id: string }
}

/**
 * A variant's prices as the admin saves them: for each currency a price with no
 * rules (what a visitor in that currency pays) and one for each region that
 * uses the currency, which is the column the admin's price table fills in.
 */
export function priceRows(
  prices: Record<string, number>,
  regionIdsByCurrency: Record<string, string[]>
): PriceRow[] {
  return Object.entries(prices).flatMap(([currency, amount]) => [
    { currency_code: currency, amount },
    ...(regionIdsByCurrency[currency] ?? []).map((regionId) => ({
      currency_code: currency,
      amount,
      rules: { region_id: regionId },
    })),
  ])
}

export type ProductRefs = {
  salesChannelId: string
  shippingProfileId: string
  categoryIds: string[]
  collectionId?: string
  typeId?: string
  tagIds: string[]
  /** Currency code → the ids of the regions that sell in it. */
  regionIdsByCurrency: Record<string, string[]>
}

const compact = <T extends Record<string, unknown>>(value: T): T =>
  Object.fromEntries(
    Object.entries(value).filter(([, item]) => item !== undefined)
  ) as T

/** The product, as `createProductsWorkflow` takes it. */
export function buildCreateInput(plan: ProductPlan, refs: ProductRefs) {
  return compact({
    title: plan.title.en,
    handle: plan.handle,
    subtitle: plan.subtitle?.en,
    description: plan.description?.en,
    status: plan.status,
    material: plan.material,
    origin_country: plan.originCountry,
    height: plan.dimensions.height,
    width: plan.dimensions.width,
    length: plan.dimensions.length,
    weight: plan.dimensions.weight,
    shipping_profile_id: refs.shippingProfileId,
    category_ids: refs.categoryIds,
    collection_id: refs.collectionId,
    type_id: refs.typeId,
    tag_ids: refs.tagIds,
    sales_channels: [{ id: refs.salesChannelId }],
    options: plan.options.map((option) => ({
      title: option.title.en,
      values: option.values.map((value) => value.en),
    })),
    variants: plan.variants.map((variant, rank) =>
      compact({
        title: variant.title.en,
        sku: variant.sku,
        options: variant.options,
        manage_inventory: variant.manageInventory,
        allow_backorder: variant.allowBackorder,
        variant_rank: rank,
        prices: priceRows(variant.prices, refs.regionIdsByCurrency),
      })
    ),
    metadata: englishMetadata(plan),
  })
}

// ---------------------------------------------------------------------------
// The product may be there already
// ---------------------------------------------------------------------------

export type KnownProduct = { id: string; title: string; handle: string }

export type Lookalikes = {
  /** The product the spec describes, when it was made from it before. */
  sameHandle?: KnownProduct
  /** A product with the same name under another handle (renamed in the admin?). */
  sameTitle?: KnownProduct
  /** Products whose name or handle contains this one's, or the other way round. */
  similar: KnownProduct[]
}

const squash = (value: string) => value.trim().toLowerCase().replace(/\s+/g, " ")

/**
 * Whether the shop has the product already. The handle says it is the same
 * product (run twice, nothing is made twice); the same name under another handle
 * is a product someone renamed, which a second copy would duplicate; a similar
 * name is only worth a look ("Blue Cascade" and "Blue Cascade Composition").
 */
export function findLookalikes(plan: ProductPlan, known: KnownProduct[]): Lookalikes {
  const title = squash(plan.title.en)
  const found: Lookalikes = { similar: [] }

  for (const product of known) {
    if (product.handle === plan.handle) {
      found.sameHandle = product
    } else if (squash(product.title) === title) {
      found.sameTitle = product
    } else {
      const other = squash(product.title)
      const [short, long] = title.length <= other.length ? [title, other] : [other, title]
      const handleOverlap =
        product.handle.startsWith(`${plan.handle}-`) ||
        plan.handle.startsWith(`${product.handle}-`)

      if (handleOverlap || (short.length >= 5 && long.includes(short))) {
        found.similar.push(product)
      }
    }
  }

  return found
}

/** How many single-letter edits turn one text into the other. */
function editDistance(a: string, b: string): number {
  let previous = Array.from({ length: b.length + 1 }, (_, index) => index)

  for (let i = 1; i <= a.length; i++) {
    const row = [i]
    for (let j = 1; j <= b.length; j++) {
      row[j] = Math.min(
        previous[j] + 1,
        row[j - 1] + 1,
        previous[j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1)
      )
    }
    previous = row
  }

  return previous[b.length]
}

/**
 * Names the shop has that are a slip of the pen away from `name`, so a typo in
 * a category, collection or tag ("Handmde") is pointed out instead of quietly
 * making a new one. The same name in other capitals is no slip: it is a match.
 */
export function suggest(name: string, candidates: string[]): string[] {
  const target = squash(name)
  const allowed = Math.max(1, Math.floor(target.length / 5))

  return candidates.filter((candidate) => {
    const other = squash(candidate)
    return other !== target && editDistance(target, other) <= allowed
  })
}

// ---------------------------------------------------------------------------
// German
// ---------------------------------------------------------------------------

/** What the product has in the database, to match the plan's texts to. */
export type ProductEntities = {
  id: string
  /**
   * The product's own English text, for a product that was there before the spec
   * was read: a text whose English was edited since is left without German, so
   * the German of the old wording is never put under new wording.
   */
  own?: {
    title?: string | null
    subtitle?: string | null
    description?: string | null
  }
  options: {
    id: string
    title: string
    values: { id: string; value: string }[]
  }[]
  variants: { id: string; title: string }[]
  categories: { id: string; name: string }[]
}

export type GermanRow = {
  /** What it is, for the log. */
  label: string
  /** The kind of record, as the translation module names it. */
  reference: string
  reference_id: string
  texts: Record<string, string>
}

const same = (a: string, b: string) => a.trim().toLowerCase() === b.trim().toLowerCase()

/**
 * The German rows to save for a product that exists: its own text, each option
 * and choice, each variant and each category. Found by the English text, so a
 * product edited in the admin is still matched wherever the text is unchanged.
 */
export function germanRows(plan: ProductPlan, entities: ProductEntities): GermanRow[] {
  const rows: GermanRow[] = []

  const unchanged = (field: "title" | "subtitle" | "description", english: string) =>
    entities.own === undefined || same(entities.own[field] ?? "", english)

  const own: Record<string, string> = {}
  if (plan.title.de && unchanged("title", plan.title.en)) {
    own.title = plan.title.de
  }
  if (plan.subtitle?.de && unchanged("subtitle", plan.subtitle.en)) {
    own.subtitle = plan.subtitle.de
  }
  if (plan.description?.de && unchanged("description", plan.description.en)) {
    own.description = plan.description.de
  }
  if (Object.keys(own).length) {
    rows.push({
      label: `product ${plan.title.en}`,
      reference: "product",
      reference_id: entities.id,
      texts: own,
    })
  }

  for (const option of plan.options) {
    const found = entities.options.find((entity) => same(entity.title, option.title.en))
    if (!found) {
      continue
    }
    if (option.title.de) {
      rows.push({
        label: `option ${option.title.en}`,
        reference: "product_option",
        reference_id: found.id,
        texts: { title: option.title.de },
      })
    }
    for (const value of option.values) {
      const foundValue = found.values.find((entity) => same(entity.value, value.en))
      if (foundValue && value.de) {
        rows.push({
          label: `${option.title.en} ${value.en}`,
          reference: "product_option_value",
          reference_id: foundValue.id,
          texts: { value: value.de },
        })
      }
    }
  }

  for (const variant of plan.variants) {
    const found = entities.variants.find((entity) => same(entity.title, variant.title.en))
    if (found && variant.title.de) {
      rows.push({
        label: `variant ${variant.title.en}`,
        reference: "product_variant",
        reference_id: found.id,
        texts: { title: variant.title.de },
      })
    }
  }

  for (const category of plan.categories) {
    const found = entities.categories.find((entity) => same(entity.name, category.en))
    if (found && category.de) {
      rows.push({
        label: `category ${category.en}`,
        reference: "product_category",
        reference_id: found.id,
        texts: { name: category.de },
      })
    }
  }

  return rows
}

// ---------------------------------------------------------------------------
// Saving German without changing what is there
// ---------------------------------------------------------------------------

/**
 * The locale German is saved under. The store offers this one German locale and
 * the storefront asks Medusa for it in every German market (`matchLocale` there
 * swaps `de-AT` for it), so one translation serves Austria and Germany.
 */
export const GERMAN = "de-DE"

/** A translation row as the translation module returns it. */
export type ExistingTranslation = {
  id: string
  reference: string
  reference_id: string
  translations: Record<string, unknown> | null
}

export type TranslationSavePlan = {
  create: {
    reference: string
    reference_id: string
    locale_code: string
    translations: Record<string, string>
  }[]
  update: { id: string; translations: Record<string, unknown> }[]
  /** Labels, for the log. */
  created: string[]
  updated: string[]
  kept: string[]
}

const hasText = (value: unknown): boolean =>
  typeof value === "string" && value.trim() !== ""

/**
 * What to save so that every wanted German text is there and nothing that is
 * there changes: a record without a row gets one, a row that lacks a field is
 * given it, a field that has text stays as it is (it may have been proofread in
 * the admin). `existing` are the German rows of the wanted records.
 */
export function planTranslationSave(
  wanted: GermanRow[],
  existing: ExistingTranslation[]
): TranslationSavePlan {
  const plan: TranslationSavePlan = {
    create: [],
    update: [],
    created: [],
    updated: [],
    kept: [],
  }

  for (const item of wanted) {
    const current = existing.find(
      (row) => row.reference === item.reference && row.reference_id === item.reference_id
    )

    if (!current) {
      plan.create.push({
        reference: item.reference,
        reference_id: item.reference_id,
        locale_code: GERMAN,
        translations: item.texts,
      })
      plan.created.push(item.label)
      continue
    }

    const lacking = Object.entries(item.texts).filter(
      ([field]) => !hasText(current.translations?.[field])
    )
    if (!lacking.length) {
      plan.kept.push(item.label)
      continue
    }

    plan.update.push({
      id: current.id,
      translations: { ...current.translations, ...Object.fromEntries(lacking) },
    })
    plan.updated.push(item.label)
  }

  return plan
}
