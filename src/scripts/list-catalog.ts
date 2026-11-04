import { ExecArgs, MedusaContainer } from "@medusajs/framework/types"
import { ContainerRegistrationKeys, Modules } from "@medusajs/framework/utils"
import { ITranslationModuleService } from "@medusajs/types"
import { GERMAN } from "../utils/product-spec"

export type Catalog = {
  categories: {
    name: string
    handle: string
    active: boolean
    parent?: string
    german?: string
  }[]
  collections: { title: string; handle: string }[]
  types: string[]
  tags: string[]
  shippingProfiles: { name: string; type: string }[]
  salesChannels: string[]
  stockLocations: string[]
  regions: { name: string; currency: string; countries: string[] }[]
  storeCurrencies: string[]
  products: {
    title: string
    handle: string
    status: string
    categories: string[]
    shippingClass?: string
    variants: number
  }[]
  /** English texts the shop already says in German, to keep new German consistent. */
  german: { kind: string; english: string; german: string }[]
}

const hasText = (value: unknown): value is string =>
  typeof value === "string" && value.trim() !== ""

/**
 * Lists what a new product can refer to and how the shop already speaks: its
 * categories, collections, types, tags, shipping classes, sales channels, stock
 * locations, regions and currencies, its products, and the German it already has
 * for badges, options, choices and categories. Reads only.
 *
 *   npx medusa exec ./src/scripts/list-catalog.ts
 *
 * On the server, run the built file from `.medusa/server`:
 *   npx medusa exec ./src/scripts/list-catalog.js
 *
 * The last line is `RESULT_JSON {…}`.
 */
export default async function listCatalogScript({ container }: ExecArgs) {
  const catalog = await listCatalog(container)

  console.log(renderCatalog(catalog))
  console.log(`RESULT_JSON ${JSON.stringify(catalog)}`)
}

export async function listCatalog(container: MedusaContainer): Promise<Catalog> {
  const query = container.resolve(ContainerRegistrationKeys.QUERY)
  const productService = container.resolve(Modules.PRODUCT)
  const fulfillmentService = container.resolve(Modules.FULFILLMENT)
  const salesChannelService = container.resolve(Modules.SALES_CHANNEL)
  const stockLocationService = container.resolve(Modules.STOCK_LOCATION)
  const regionService = container.resolve(Modules.REGION)
  const storeService = container.resolve(Modules.STORE)
  const translationService: ITranslationModuleService = container.resolve(
    Modules.TRANSLATION
  )

  const categories = await productService.listProductCategories(
    {},
    {
      select: ["id", "name", "handle", "is_active", "parent_category_id"],
      take: null,
    }
  )
  const collections = await productService.listProductCollections(
    {},
    { select: ["id", "title", "handle"], take: null }
  )
  const types = await productService.listProductTypes(
    {},
    { select: ["id", "value"], take: null }
  )
  const tags = await productService.listProductTags(
    {},
    { select: ["id", "value"], take: null }
  )
  const profiles = await fulfillmentService.listShippingProfiles({})
  const channels = await salesChannelService.listSalesChannels({}, { take: null })
  const locations = await stockLocationService.listStockLocations({}, { take: null })
  const regions = await regionService.listRegions(
    {},
    {
      select: ["id", "name", "currency_code"],
      relations: ["countries"],
      take: null,
    }
  )
  const [store] = await storeService.listStores(
    {},
    { relations: ["supported_currencies"] }
  )

  const { data: products } = await query.graph({
    entity: "product",
    fields: [
      "id",
      "title",
      "handle",
      "status",
      "subtitle",
      "categories.name",
      "shipping_profile.type",
      "options.id",
      "options.title",
      "options.values.id",
      "options.values.value",
      "variants.id",
      "variants.title",
    ],
  })
  const { data: shippingOptions } = await query.graph({
    entity: "shipping_option",
    fields: ["id", "name"],
  })

  // German the shop already has, found by the English next to it
  const english = new Map<string, Record<string, string>>()
  const remember = (reference: string, id: string, texts: Record<string, unknown>) =>
    english.set(
      `${reference}:${id}`,
      Object.fromEntries(
        Object.entries(texts).filter((entry): entry is [string, string] =>
          hasText(entry[1])
        )
      )
    )

  for (const product of products as any[]) {
    remember("product", product.id, { subtitle: product.subtitle })
    for (const option of (product.options ?? []).filter(Boolean)) {
      remember("product_option", option.id, { title: option.title })
      for (const value of (option.values ?? []).filter(Boolean)) {
        remember("product_option_value", value.id, { value: value.value })
      }
    }
  }
  for (const category of categories) {
    remember("product_category", category.id, { name: category.name })
  }
  for (const option of shippingOptions as any[]) {
    remember("shipping_option", option.id, { name: option.name })
  }

  const rows = await translationService.listTranslations(
    { locale_code: GERMAN },
    { take: null }
  )

  const kinds: Record<string, string> = {
    product: "badge",
    product_option: "option",
    product_option_value: "choice",
    product_category: "category",
    shipping_option: "delivery",
  }
  const seen = new Set<string>()
  const german: Catalog["german"] = []
  const germanOfCategory = new Map<string, string>()

  for (const row of rows) {
    const originals = english.get(`${row.reference}:${row.reference_id}`)
    if (!originals) {
      continue
    }
    for (const [field, text] of Object.entries(originals)) {
      const translated = (row.translations as Record<string, unknown> | null)?.[field]
      if (!hasText(translated)) {
        continue
      }
      if (row.reference === "product_category") {
        germanOfCategory.set(row.reference_id, translated)
      }
      const key = `${text}|${translated}`
      if (!seen.has(key)) {
        seen.add(key)
        german.push({ kind: kinds[row.reference], english: text, german: translated })
      }
    }
  }

  const parentName = new Map(categories.map((category) => [category.id, category.name]))

  return {
    categories: categories.map((category) => ({
      name: category.name,
      handle: category.handle,
      active: category.is_active !== false,
      parent: category.parent_category_id
        ? parentName.get(category.parent_category_id)
        : undefined,
      german: germanOfCategory.get(category.id),
    })),
    collections: collections.map(({ title, handle }) => ({ title, handle })),
    types: types.map((type) => type.value),
    tags: tags.map((tag) => tag.value),
    shippingProfiles: profiles.map(({ name, type }) => ({ name, type })),
    salesChannels: channels.map((channel) => channel.name),
    stockLocations: locations.map((location) => location.name),
    regions: regions.map((region) => ({
      name: region.name,
      currency: region.currency_code.toLowerCase(),
      countries: ((region as any).countries ?? [])
        .map((country: any) => String(country.iso_2).toUpperCase())
        .sort(),
    })),
    storeCurrencies: (store?.supported_currencies ?? []).map((currency) =>
      currency.currency_code.toLowerCase()
    ),
    products: (products as any[]).map((product) => ({
      title: product.title,
      handle: product.handle,
      status: product.status,
      categories: (product.categories ?? []).filter(Boolean).map((c: any) => c.name),
      shippingClass: product.shipping_profile?.type ?? undefined,
      variants: (product.variants ?? []).filter(Boolean).length,
    })),
    german,
  }
}

export function renderCatalog(catalog: Catalog): string {
  const none = (items: string[]) => (items.length ? items.join(", ") : "none")
  const lines: string[] = ["== Catalog =="]

  lines.push(
    "",
    `Categories (${catalog.categories.length}): a spec names one by its English name`,
    ...catalog.categories.map(
      (category) =>
        `  ${category.name}${category.parent ? ` (under ${category.parent})` : ""} [${
          category.handle
        }]${category.active ? "" : " inactive"}${
          category.german ? `, German: ${category.german}` : ", no German yet"
        }`
    )
  )

  lines.push(
    "",
    `Collections: ${none(catalog.collections.map((c) => `${c.title} [${c.handle}]`))}`,
    `Product types: ${none(catalog.types)}`,
    `Tags: ${none(catalog.tags)}`,
    `Shipping classes: ${none(catalog.shippingProfiles.map((p) => `${p.name} (${p.type})`))}`,
    `Sales channels: ${none(catalog.salesChannels)}`,
    `Stock locations: ${none(catalog.stockLocations)}`,
    `Store currencies: ${none(catalog.storeCurrencies.map((c) => c.toUpperCase()))}`,
    `Regions: ${none(
      catalog.regions.map(
        (region) =>
          `${region.name} (${region.currency.toUpperCase()}${
            region.countries.length ? `: ${region.countries.join(" ")}` : ""
          })`
      )
    )}`
  )

  lines.push(
    "",
    `Products (${catalog.products.length}):`,
    ...catalog.products.map(
      (product) =>
        `  ${product.title} [${product.handle}] ${product.status}, ${
          product.shippingClass ?? "no shipping class"
        }, ${product.variants} variant(s)${
          product.categories.length ? `, ${product.categories.join(" / ")}` : ""
        }`
    )
  )

  if (catalog.german.length) {
    lines.push(
      "",
      "German the shop already uses (keep new German consistent with it):",
      ...catalog.german.map(
        (entry) => `  ${entry.kind}: ${entry.english} → ${entry.german}`
      )
    )
  }

  return lines.join("\n")
}
