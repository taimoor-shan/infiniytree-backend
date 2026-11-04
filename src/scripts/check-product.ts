import { ExecArgs, MedusaContainer } from "@medusajs/framework/types"
import { ContainerRegistrationKeys, Modules } from "@medusajs/framework/utils"
import { ITranslationModuleService } from "@medusajs/types"
import {
  ProductReview,
  ProductSnapshot,
  reviewProduct,
  TranslatableRecord,
} from "../utils/product-review"
import { GERMAN, suggest } from "../utils/product-spec"

export type InspectResult = {
  found: boolean
  /** What was asked for: a handle or an id. */
  key: string
  id?: string
  title?: string
  handle?: string
  status?: string
  review?: ProductReview
  /** The product exists and has no problems (warnings and to-dos are not problems). */
  ok: boolean
  message?: string
}

const hasText = (value: unknown): value is string =>
  typeof value === "string" && value.trim() !== ""

/**
 * Reads a product as the storefront will and reports what is wrong or still to
 * do: status, category, shipping class, prices per market (and where it reads
 * "Price on request"), stock, pictures, the metadata the page reads and the
 * German texts. Reads only.
 *
 *   npx medusa exec ./src/scripts/check-product.ts blue-cascade
 *
 * On the server, run the built file from `.medusa/server`:
 *   npx medusa exec ./src/scripts/check-product.js blue-cascade
 *
 * The product is named by its handle (or its id). Exit code 1 when it is not
 * found or has a problem; the last line is `RESULT_JSON {…}`.
 */
export default async function checkProductScript({ container, args }: ExecArgs) {
  const key = args[0]
  if (!key) {
    console.log("Usage: medusa exec ./src/scripts/check-product.ts <handle or id>")
    process.exitCode = 1
    return
  }

  const result = await inspectProduct(container, key)
  console.log(renderInspection(result))
  console.log(`RESULT_JSON ${JSON.stringify(result)}`)

  if (!result.ok) {
    process.exitCode = 1
  }
}

export async function inspectProduct(
  container: MedusaContainer,
  key: string
): Promise<InspectResult> {
  const found = await gatherSnapshot(container, key)

  if (!found.snapshot) {
    return { found: false, ok: false, key, message: found.message }
  }

  const { snapshot } = found
  const review = reviewProduct(snapshot)

  return {
    found: true,
    key,
    id: snapshot.id,
    title: snapshot.title,
    handle: snapshot.handle,
    status: snapshot.status,
    review,
    ok: review.problems.length === 0,
  }
}

/** Reads the product and what the review needs from the database. */
export async function gatherSnapshot(
  container: MedusaContainer,
  key: string
): Promise<{ snapshot?: ProductSnapshot; message?: string }> {
  const query = container.resolve(ContainerRegistrationKeys.QUERY)
  const regionService = container.resolve(Modules.REGION)
  const translationService: ITranslationModuleService = container.resolve(
    Modules.TRANSLATION
  )

  const {
    data: [product],
  } = await query.graph({
    entity: "product",
    fields: [
      "id",
      "title",
      "handle",
      "status",
      "subtitle",
      "description",
      "thumbnail",
      "metadata",
      "images.id",
      "categories.id",
      "categories.name",
      "collection.title",
      "type.value",
      "tags.value",
      "shipping_profile.name",
      "shipping_profile.type",
      "sales_channels.name",
      "options.id",
      "options.title",
      "options.values.id",
      "options.values.value",
      "variants.id",
      "variants.title",
      "variants.sku",
      "variants.manage_inventory",
      "variants.allow_backorder",
      "variants.variant_rank",
      "variants.price_set.prices.currency_code",
      "variants.price_set.prices.amount",
      "variants.price_set.prices.price_list_id",
      "variants.price_set.prices.price_rules.attribute",
      "variants.price_set.prices.price_rules.value",
      "variants.inventory_items.required_quantity",
      "variants.inventory_items.inventory.location_levels.stocked_quantity",
      "variants.inventory_items.inventory.location_levels.reserved_quantity",
    ],
    filters: /^prod_/.test(key) ? { id: key } : { handle: key },
  })

  if (!product) {
    const { data: all } = await query.graph({
      entity: "product",
      fields: ["handle"],
    })
    const near = suggest(
      key,
      all.map((item: any) => item.handle)
    )
    return {
      message: `No product has the handle or id "${key}".${
        near.length ? ` Did you mean ${near.map((handle) => `"${handle}"`).join(" or ")}?` : ""
      }`,
    }
  }

  const regions = await regionService.listRegions(
    {},
    { select: ["id", "name", "currency_code"], take: null }
  )

  const variants = [...(product.variants ?? [])]
    .filter(Boolean)
    .sort((a: any, b: any) => (a.variant_rank ?? 0) - (b.variant_rank ?? 0))

  // German: the records that have English text, and the German rows that exist
  const records: TranslatableRecord[] = []
  const addRecord = (
    reference: string,
    id: string,
    label: string,
    texts: Record<string, unknown>
  ) => {
    const fields = Object.entries(texts)
      .filter(([, text]) => hasText(text))
      .map(([field]) => field)
    if (fields.length) {
      records.push({ reference, id, label, fields })
    }
  }

  addRecord("product", product.id, `product ${product.title}`, {
    title: product.title,
    subtitle: product.subtitle,
    description: product.description,
  })
  for (const option of (product.options ?? []).filter(Boolean) as any[]) {
    addRecord("product_option", option.id, `option ${option.title}`, {
      title: option.title,
    })
    for (const value of (option.values ?? []).filter(Boolean)) {
      addRecord("product_option_value", value.id, `${option.title} ${value.value}`, {
        value: value.value,
      })
    }
  }
  for (const variant of variants as any[]) {
    addRecord("product_variant", variant.id, `variant ${variant.title}`, {
      title: variant.title,
    })
  }
  for (const category of (product.categories ?? []).filter(Boolean) as any[]) {
    addRecord("product_category", category.id, `category ${category.name}`, {
      name: category.name,
    })
  }

  const rows = records.length
    ? await translationService.listTranslations(
        { reference_id: records.map((record) => record.id), locale_code: GERMAN },
        { take: null }
      )
    : []

  const snapshot: ProductSnapshot = {
    id: product.id,
    title: product.title,
    handle: product.handle,
    status: product.status,
    thumbnail: product.thumbnail,
    metadata: (product.metadata ?? {}) as Record<string, unknown>,
    images: (product.images ?? []).filter(Boolean).length,
    categories: (product.categories ?? []).filter(Boolean).map((c: any) => c.name),
    collection: (product.collection as any)?.title ?? null,
    type: (product.type as any)?.value ?? null,
    tags: (product.tags ?? []).filter(Boolean).map((tag: any) => tag.value),
    shippingProfile: product.shipping_profile
      ? {
          name: (product.shipping_profile as any).name,
          type: (product.shipping_profile as any).type,
        }
      : null,
    salesChannels: (product.sales_channels ?? [])
      .filter(Boolean)
      .map((channel: any) => channel.name),
    options: (product.options ?? []).filter(Boolean).map((option: any) => ({
      title: option.title,
      values: (option.values ?? []).filter(Boolean).map((value: any) => value.value),
    })),
    variants: variants.map((variant: any) => ({
      title: variant.title,
      sku: variant.sku,
      manageInventory: variant.manage_inventory !== false,
      allowBackorder: variant.allow_backorder === true,
      prices: regularPrices(variant),
      available: availableOf(variant),
    })),
    regions: regions.map((region) => ({
      id: region.id,
      name: region.name,
      currency: region.currency_code.toLowerCase(),
    })),
    records,
    germanRows: rows.map((row) => ({
      reference: row.reference,
      reference_id: row.reference_id,
      fields: Object.entries((row.translations ?? {}) as Record<string, unknown>)
        .filter(([, text]) => hasText(text))
        .map(([field]) => field),
    })),
  }

  return { snapshot }
}

/** The prices a shopper can get: none from a price list, none for a customer group. */
function regularPrices(variant: any): ProductSnapshot["variants"][number]["prices"] {
  return ((variant.price_set?.prices ?? []) as any[])
    .filter((price) => price && !price.price_list_id)
    .flatMap((price) => {
      const rules = (price.price_rules ?? []).filter(Boolean)
      if (rules.some((rule: any) => rule.attribute !== "region_id")) {
        return []
      }
      return [
        {
          currency: String(price.currency_code).toLowerCase(),
          amount: Number(price.amount),
          regionId:
            rules.find((rule: any) => rule.attribute === "region_id")?.value ?? null,
        },
      ]
    })
}

/**
 * Pieces that can be sold: what is in stock and not reserved, summed over the
 * locations, and for a variant made of several inventory items the number of
 * whole sets. Null when the variant has no inventory item.
 */
function availableOf(variant: any): number | null {
  const items = ((variant.inventory_items ?? []) as any[]).filter(Boolean)
  if (!items.length) {
    return null
  }

  return Math.min(
    ...items.map((item) => {
      const levels = ((item.inventory?.location_levels ?? []) as any[]).filter(Boolean)
      const free = levels.reduce(
        (sum, level) =>
          sum + Number(level.stocked_quantity ?? 0) - Number(level.reserved_quantity ?? 0),
        0
      )
      return Math.max(0, Math.floor(free / Math.max(1, Number(item.required_quantity ?? 1))))
    })
  )
}

export function renderInspection(result: InspectResult): string {
  if (!result.found || !result.review) {
    return `Not found: ${result.message ?? result.key}`
  }

  const { lines, problems, warnings, todo } = result.review
  const out = [`== ${lines[0]} ==`, ...lines.slice(1)]

  const sections: [string, string[]][] = [
    ["Problems:", problems],
    ["Warnings:", warnings],
    ["Your next steps:", todo],
  ]
  for (const [heading, items] of sections) {
    if (items.length) {
      out.push("", heading, ...items.map((item) => `  - ${item}`))
    }
  }
  if (!problems.length) {
    out.push("", "No problems found.")
  }

  return out.join("\n")
}
