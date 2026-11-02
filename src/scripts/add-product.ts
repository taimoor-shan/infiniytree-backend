import { readFile } from "node:fs/promises"
import { resolve } from "node:path"
import { ExecArgs, MedusaContainer } from "@medusajs/framework/types"
import {
  ContainerRegistrationKeys,
  MedusaError,
  Modules,
  ProductStatus as MedusaProductStatus,
} from "@medusajs/framework/utils"
import {
  batchTranslationsWorkflow,
  createInventoryLevelsWorkflow,
  createProductCategoriesWorkflow,
  createProductsWorkflow,
  createShippingProfilesWorkflow,
  updateProductsWorkflow,
} from "@medusajs/medusa/core-flows"
import { ITranslationModuleService } from "@medusajs/types"
import { addLanguages, addLanguagesToList } from "../utils/localized-metadata"
import {
  buildCreateInput,
  englishMetadata,
  findLookalikes,
  GERMAN,
  germanRows,
  handleFromTitle,
  KnownProduct,
  Lang,
  metadataLanguages,
  parseProductSpec,
  planTranslationSave,
  ProductEntities,
  ProductPlan,
  ProductStatus,
  suggest,
  TranslationSavePlan,
} from "../utils/product-spec"
import { revalidateStorefrontCache } from "../utils/revalidate-cache"
import {
  CARTON_PROFILE,
  LEGACY_PALLET_PROFILE_NAME,
  PALLET_PROFILE,
} from "./shipping-classes"

const DEFAULT_SALES_CHANNEL = "Default Sales Channel"
const DEFAULT_STOCK_LOCATION = "European Warehouse"

export type AddProductOptions = {
  /** Read and report; write nothing. */
  check?: boolean
  /** Replaces the status the spec gives ("draft" when it gives none). */
  status?: ProductStatus
}

export type AddProductResult = {
  /** "check" wrote nothing: what the steps say is what would be done. */
  mode: "check" | "write"
  /**
   * create: a new product (made now, or in a check, would be);
   * exists: the shop has the product already, so its own fields are left alone;
   * refused: the spec or the shop's data is not right, nothing was written.
   */
  outcome: "create" | "exists" | "refused"
  ok: boolean
  /** Whether anything was written to the database. */
  written: boolean
  productId?: string
  handle?: string
  status?: ProductStatus
  steps: string[]
  errors: string[]
  warnings: string[]
  notes: string[]
  /** What the shop owner does next (pictures, prices, stock, publishing). */
  todo: string[]
}

type Log = { steps: string[]; errors: string[]; warnings: string[] }

type Known = KnownProduct & { status: string }

type Resolved = {
  salesChannel?: { id: string; name: string }
  /** No id: the class does not exist yet and is made when writing. */
  shippingProfile: { id?: string; name: string }
  /** No id: the category does not exist yet and is made when writing. */
  categories: { lang: Lang; id?: string }[]
  collectionId?: string
  typeId?: string
  tagIds: string[]
  regions: { id: string; name: string; currency: string }[]
  stockLocation?: { id: string; name: string }
  known: Known[]
}

const same = (a: string, b: string) => a.trim().toLowerCase() === b.trim().toLowerCase()

const row = (label: string, text: string) => `${label.padEnd(15)}${text}`

const list = (items: string[], max = 8) =>
  items.length > max
    ? `${items.slice(0, max).join(", ")} and ${items.length - max} more`
    : items.join(", ")

const money = (currency: string, amount: number) =>
  `${currency.toUpperCase()} ${amount.toLocaleString("en-US")}`

/** ` Did you mean "Handmade"?` for a name that is a slip away from a real one. */
function didYouMean(name: string, candidates: string[]): string {
  const near = suggest(name, candidates)
  return near.length ? ` Did you mean ${near.map((n) => `"${n}"`).join(" or ")}?` : ""
}

/**
 * Adds a product from a spec (see `product-specs/` and the add-product skill).
 *
 *   npx medusa exec ./src/scripts/add-product.ts product-specs/olive-tree.json check
 *   npx medusa exec ./src/scripts/add-product.ts product-specs/olive-tree.json
 *   npx medusa exec ./src/scripts/add-product.ts product-specs/olive-tree.json published
 *
 * On the server, run the built file from `.medusa/server`:
 *   npx medusa exec ./src/scripts/add-product.js /path/to/olive-tree.json check
 *
 * The words after the file: `check` reads and reports without writing anything,
 * `draft` or `published` replaces the spec's status (a spec without one is a
 * draft, so nothing reaches the storefront before its pictures are there).
 *
 * It makes what the admin's product form would, with the shop's conventions
 * filled in: the product with its options and variants (stock managed, no
 * backorders), a price per currency as the admin saves them (a base price and
 * one for each region that uses the currency), the shipping class, categories,
 * the metadata the storefront reads, stock where the spec gives some, and German
 * as `de-DE` translation rows with the other languages in the metadata. It
 * never makes a collection, type or tag: those must exist (the check says which
 * do), and it never touches pictures or the video, which are uploaded in the
 * admin.
 *
 * Safe to run twice: a product with the spec's handle is left as it is (so what
 * was edited in the admin is kept) and only given the German and metadata
 * languages it is missing, never replacing a text. A product with the same name
 * under another handle (renamed in the admin) stops the run instead.
 */
export default async function addProductScript({ container, args }: ExecArgs) {
  const words = args.map((arg) => arg.toLowerCase())
  const file = args.find(
    (arg) => !["check", "draft", "published"].includes(arg.toLowerCase())
  )

  if (!file || (words.includes("draft") && words.includes("published"))) {
    console.log(
      "Usage: medusa exec ./src/scripts/add-product.ts <spec.json> [check] [draft|published]"
    )
    process.exitCode = 1
    return
  }

  let raw: unknown
  try {
    raw = JSON.parse((await readFile(resolve(file), "utf8")).replace(/^﻿/, ""))
  } catch (error) {
    console.log(`Cannot read ${file}: ${(error as Error).message}`)
    process.exitCode = 1
    return
  }

  const result = await addProduct(container, raw, {
    check: words.includes("check"),
    status: words.includes("published")
      ? "published"
      : words.includes("draft")
        ? "draft"
        : undefined,
  })

  console.log(renderResult(result))
  console.log(`RESULT_JSON ${JSON.stringify(result)}`)

  if (!result.ok) {
    process.exitCode = 1
  }
}

export async function addProduct(
  container: MedusaContainer,
  raw: unknown,
  options: AddProductOptions = {}
): Promise<AddProductResult> {
  const check = options.check === true
  const logger = container.resolve(ContainerRegistrationKeys.LOGGER)

  const result: AddProductResult = {
    mode: check ? "check" : "write",
    outcome: "refused",
    ok: false,
    written: false,
    steps: [],
    errors: [],
    warnings: [],
    notes: [],
    todo: [],
  }

  const parsed = parseProductSpec(
    options.status && typeof raw === "object" && raw !== null && !Array.isArray(raw)
      ? { ...raw, status: options.status }
      : raw
  )
  result.warnings.push(...parsed.warnings)
  result.notes.push(...parsed.notes)

  if (!parsed.ok) {
    result.errors.push(...parsed.errors)
    return result
  }

  const plan = parsed.plan
  result.handle = plan.handle
  result.status = plan.status

  const resolved = await resolveReferences(container, plan, result)
  const lookalikes = findLookalikes(plan, resolved.known)

  if (lookalikes.sameTitle && !lookalikes.sameHandle) {
    const other = lookalikes.sameTitle
    result.errors.push(
      `A product called "${other.title}" already exists under the handle "${other.handle}" (${other.id}). Making this spec would add a second one. If it is the same product (renamed or given another handle in the admin), leave it as it is; if it is a different product, give the spec another title.`
    )
  }
  for (const other of lookalikes.similar) {
    result.warnings.push(
      `The shop has a product with a similar name, "${other.title}" (${other.handle}). If this spec describes that product, do not add it again.`
    )
  }

  const existing = lookalikes.sameHandle
    ? resolved.known.find((product) => product.id === lookalikes.sameHandle!.id)
    : undefined

  if (!existing) {
    await checkSkus(container, plan, result)
  }
  if (plan.status === "published") {
    result.warnings.push(
      "It is published straight away, before its pictures are uploaded: the storefront would show it without an image. Leave it a draft until the pictures are in."
    )
  }

  if (result.errors.length) {
    return result
  }

  result.ok = true
  result.outcome = existing ? "exists" : "create"

  try {
    if (existing) {
      await topUpExisting(container, plan, existing, check, result)
    } else {
      await createNew(container, plan, resolved, check, result)
    }
  } catch (error) {
    result.ok = false
    result.errors.push(
      `Stopped: ${(error as Error).message}${
        result.productId
          ? " The product was created; run the same spec again to finish what is missing, it only adds what is not there."
          : ""
      }`
    )
    return result
  }

  if (result.written) {
    await revalidateStorefrontCache(["products", "variants", "categories"], logger)
  }
  result.todo = ownerTodo(plan, resolved, result.outcome === "create")

  return result
}

// ---------------------------------------------------------------------------
// Reading the shop
// ---------------------------------------------------------------------------

/** Finds what the spec names in the shop. Reads only; what is missing is said. */
async function resolveReferences(
  container: MedusaContainer,
  plan: ProductPlan,
  log: Log
): Promise<Resolved> {
  const productService = container.resolve(Modules.PRODUCT)
  const fulfillmentService = container.resolve(Modules.FULFILLMENT)
  const salesChannelService = container.resolve(Modules.SALES_CHANNEL)
  const regionService = container.resolve(Modules.REGION)
  const storeService = container.resolve(Modules.STORE)
  const stockLocationService = container.resolve(Modules.STOCK_LOCATION)

  const resolved: Resolved = {
    shippingProfile: { name: "" },
    categories: [],
    tagIds: [],
    regions: [],
    known: [],
  }

  const known = await productService.listProducts(
    {},
    { select: ["id", "title", "handle", "status"], take: null }
  )
  resolved.known = known.map((product) => ({
    id: product.id,
    title: product.title,
    handle: product.handle,
    status: product.status,
  }))

  // Sales channel
  const channels = await salesChannelService.listSalesChannels({}, { take: null })
  const channel = plan.salesChannel
    ? channels.find((candidate) => same(candidate.name, plan.salesChannel!))
    : (channels.find((candidate) => candidate.name === DEFAULT_SALES_CHANNEL) ??
      (channels.length === 1 ? channels[0] : undefined))
  if (channel) {
    resolved.salesChannel = { id: channel.id, name: channel.name }
  } else {
    const names = channels.map((candidate) => candidate.name)
    log.errors.push(
      plan.salesChannel
        ? `The sales channel "${plan.salesChannel}" does not exist (${list(names)}).${didYouMean(plan.salesChannel, names)}`
        : `There is no "${DEFAULT_SALES_CHANNEL}": name the channel to sell in with salesChannel (${list(names)}).`
    )
  }

  // Shipping class, found by its type so a rename in the admin does not matter
  const profile = plan.shippingClass === "carton" ? CARTON_PROFILE : PALLET_PROFILE
  const [byType] = await fulfillmentService.listShippingProfiles({ type: profile.type })
  const [found] = byType
    ? [byType]
    : await fulfillmentService.listShippingProfiles({
        name:
          plan.shippingClass === "carton"
            ? [profile.name]
            : [profile.name, LEGACY_PALLET_PROFILE_NAME],
      })
  resolved.shippingProfile = found
    ? { id: found.id, name: found.name }
    : { name: profile.name }

  // Categories
  const categories = await productService.listProductCategories(
    {},
    { select: ["id", "name", "handle"], take: null }
  )
  for (const lang of plan.categories) {
    const matches = categories.filter(
      (category) =>
        same(category.name, lang.en) || category.handle === handleFromTitle(lang.en)
    )

    if (matches.length > 1) {
      log.errors.push(
        `The category "${lang.en}" matches several categories (${matches
          .map((match) => `${match.name}: ${match.handle}`)
          .join("; ")}): rename one, so a name points at one category.`
      )
    } else if (matches.length === 1) {
      resolved.categories.push({ lang, id: matches[0].id })
    } else {
      const names = categories.map((category) => category.name)
      resolved.categories.push({ lang })
      log.warnings.push(
        `The category "${lang.en}" does not exist, so it will be created${
          names.length ? ` (the shop has ${list(names)})` : ""
        }.${didYouMean(lang.en, names)}`
      )
    }
  }

  // Collection, type and tags are never made here: they exist or the spec is wrong
  if (plan.collection) {
    const collections = await productService.listProductCollections(
      {},
      { select: ["id", "title", "handle"], take: null }
    )
    const match = collections.find(
      (collection) =>
        same(collection.title, plan.collection!) ||
        collection.handle === handleFromTitle(plan.collection!)
    )
    if (match) {
      resolved.collectionId = match.id
    } else {
      const names = collections.map((collection) => collection.title)
      log.errors.push(
        `The collection "${plan.collection}" does not exist (${list(names) || "the shop has none"}).${didYouMean(plan.collection, names)} Make it in the admin (Products → Collections) or leave it out.`
      )
    }
  }

  if (plan.type) {
    const types = await productService.listProductTypes(
      {},
      { select: ["id", "value"], take: null }
    )
    const match = types.find((type) => same(type.value, plan.type!))
    if (match) {
      resolved.typeId = match.id
    } else {
      const names = types.map((type) => type.value)
      log.errors.push(
        `The product type "${plan.type}" does not exist (${list(names) || "the shop has none"}).${didYouMean(plan.type, names)} Make it in the admin or leave it out.`
      )
    }
  }

  if (plan.tags.length) {
    const tags = await productService.listProductTags(
      {},
      { select: ["id", "value"], take: null }
    )
    for (const name of plan.tags) {
      const match = tags.find((tag) => same(tag.value, name))
      if (match) {
        resolved.tagIds.push(match.id)
      } else {
        const names = tags.map((tag) => tag.value)
        log.errors.push(
          `The tag "${name}" does not exist (${list(names) || "the shop has none"}).${didYouMean(name, names)} Make it in the admin or leave it out.`
        )
      }
    }
  }

  // Regions and currencies: what the prices are saved for
  const regions = await regionService.listRegions(
    {},
    { select: ["id", "name", "currency_code"], take: null }
  )
  resolved.regions = regions.map((region) => ({
    id: region.id,
    name: region.name,
    currency: region.currency_code.toLowerCase(),
  }))

  const [store] = await storeService.listStores(
    {},
    { relations: ["supported_currencies"] }
  )
  const storeCurrencies = (store?.supported_currencies ?? []).map((currency) =>
    currency.currency_code.toLowerCase()
  )

  const priced = new Set(
    plan.variants.flatMap((variant) => Object.keys(variant.prices))
  )
  for (const currency of priced) {
    if (!storeCurrencies.includes(currency)) {
      log.errors.push(
        `The store does not sell in ${currency.toUpperCase()} (it sells in ${
          storeCurrencies.map((code) => code.toUpperCase()).join(", ") || "no currency"
        }): leave that price out, or add the currency under Settings → Store.`
      )
    } else if (!resolved.regions.some((region) => region.currency === currency)) {
      log.warnings.push(
        `No region sells in ${currency.toUpperCase()}, so that price is saved without a region.`
      )
    }
  }
  if (priced.size) {
    const unpriced = [
      ...new Set(
        resolved.regions
          .filter((region) => !priced.has(region.currency))
          .map((region) => region.currency)
      ),
    ]
    for (const currency of unpriced) {
      const markets = resolved.regions
        .filter((region) => region.currency === currency)
        .map((region) => region.name)
      log.warnings.push(
        `No ${currency.toUpperCase()} price: ${list(markets)} will read "Price on request" until one is entered.`
      )
    }
  }

  // Stock needs a place to be kept
  const stocked = plan.variants.some(
    (variant) => variant.stock > 0 && variant.manageInventory
  )
  if (plan.variants.some((variant) => variant.stock > 0 && !variant.manageInventory)) {
    log.warnings.push(
      "Stock is given for a variant that does not manage inventory: it is ignored."
    )
  }
  if (stocked) {
    const locations = await stockLocationService.listStockLocations({}, { take: null })
    const location = plan.stockLocation
      ? locations.find((candidate) => same(candidate.name, plan.stockLocation!))
      : (locations.find((candidate) => candidate.name === DEFAULT_STOCK_LOCATION) ??
        (locations.length === 1 ? locations[0] : undefined))
    if (location) {
      resolved.stockLocation = { id: location.id, name: location.name }
    } else {
      const names = locations.map((candidate) => candidate.name)
      log.errors.push(
        plan.stockLocation
          ? `The stock location "${plan.stockLocation}" does not exist (${list(names)}).${didYouMean(plan.stockLocation, names)}`
          : `There is no "${DEFAULT_STOCK_LOCATION}": name the location that holds the stock with stockLocation (${list(names)}).`
      )
    }
  }

  return resolved
}

/** A SKU belongs to one variant in the whole shop. */
async function checkSkus(
  container: MedusaContainer,
  plan: ProductPlan,
  log: Log
) {
  const skus = plan.variants.map((variant) => variant.sku).filter(Boolean) as string[]
  if (!skus.length) {
    return
  }

  const productService = container.resolve(Modules.PRODUCT)
  const taken = await productService.listProductVariants(
    { sku: skus },
    { select: ["id", "sku", "title"], take: null }
  )
  for (const variant of taken) {
    log.errors.push(
      `The SKU "${variant.sku}" is already used by the variant "${variant.title}" (${variant.id}): a SKU belongs to one variant.`
    )
  }
}

// ---------------------------------------------------------------------------
// A product that is not there yet
// ---------------------------------------------------------------------------

async function createNew(
  container: MedusaContainer,
  plan: ProductPlan,
  resolved: Resolved,
  check: boolean,
  result: AddProductResult
) {
  const will = (done: string, wouldDo: string) => (check ? wouldDo : done)

  result.steps.push(
    row(
      "Product",
      `${plan.title.en}: ${plan.status}, handle ${plan.handle}${
        plan.subtitle ? `, badge "${plan.subtitle.en}"` : ""
      }`
    )
  )
  if (resolved.salesChannel) {
    result.steps.push(row("Sales channel", resolved.salesChannel.name))
  }
  result.steps.push(
    row(
      "Shipping",
      `${resolved.shippingProfile.name} (${
        resolved.shippingProfile.id ? "exists" : will("made", "will be made")
      })`
    )
  )
  if (plan.categories.length) {
    result.steps.push(
      row(
        "Categories",
        resolved.categories
          .map(
            (category) =>
              `${category.lang.en} (${
                category.id ? "exists" : will("made", "will be made")
              })`
          )
          .join(", ")
      )
    )
  }
  for (const [label, text] of [
    ["Collection", plan.collection],
    ["Type", plan.type],
    ["Tags", plan.tags.join(", ")],
  ] as const) {
    if (text) {
      result.steps.push(row(label, text))
    }
  }

  for (const option of plan.options) {
    result.steps.push(
      row(
        plan.simple ? "Options" : `Option`,
        plan.simple
          ? "none (a default option and variant, as the admin makes)"
          : `${option.title.en}: ${option.values.map((value) => value.en).join(", ")}`
      )
    )
  }
  result.steps.push(row("Variants", `${plan.variants.length}`))
  for (const variant of plan.variants.slice(0, 12)) {
    const prices = Object.entries(variant.prices).map(([code, amount]) =>
      money(code, amount)
    )
    result.steps.push(
      `  ${variant.title.en}: ${prices.length ? prices.join(" / ") : "no price"}, ${
        variant.manageInventory
          ? variant.stock > 0
            ? `${variant.stock} in stock`
            : "no stock"
          : "stock not tracked"
      }${variant.sku ? `, SKU ${variant.sku}` : ""}`
    )
  }
  if (plan.variants.length > 12) {
    result.steps.push(`  … and ${plan.variants.length - 12} more`)
  }

  const metadataKeys = Object.keys(englishMetadata(plan))
  if (metadataKeys.length) {
    result.steps.push(row("Metadata", metadataKeys.join(", ")))
  }

  const languages = plannedLanguages(plan)
  result.steps.push(row("German", languages.german))
  if (languages.metadata) {
    result.steps.push(row("Other languages", languages.metadata))
  }

  if (check) {
    return
  }

  const refs = {
    salesChannelId: resolved.salesChannel!.id,
    shippingProfileId:
      resolved.shippingProfile.id ?? (await makeShippingProfile(container, plan)),
    categoryIds: [] as string[],
    collectionId: resolved.collectionId,
    typeId: resolved.typeId,
    tagIds: resolved.tagIds,
    regionIdsByCurrency: resolved.regions.reduce<Record<string, string[]>>(
      (byCurrency, region) => ({
        ...byCurrency,
        [region.currency]: [...(byCurrency[region.currency] ?? []), region.id],
      }),
      {}
    ),
  }
  for (const category of resolved.categories) {
    refs.categoryIds.push(category.id ?? (await makeCategory(container, category.lang)))
    result.written = true
  }

  const input = buildCreateInput(plan, refs)
  const {
    result: [product],
  } = await createProductsWorkflow(container).run({
    input: {
      products: [
        {
          ...input,
          status:
            plan.status === "published"
              ? MedusaProductStatus.PUBLISHED
              : MedusaProductStatus.DRAFT,
        },
      ],
    },
  })
  result.written = true
  result.productId = product.id
  result.steps.push(`Created ${product.id}.`)

  if (resolved.stockLocation) {
    await setStock(container, plan, product.id, resolved.stockLocation.id, result)
  }

  const done = await topUpLanguages(container, plan, product.id, {
    write: true,
    existing: false,
  })
  result.steps.push(
    `Saved ${done.german.created.length} German texts and the other languages of ${
      done.metadata.length
    } metadata fields.`
  )
}

async function makeShippingProfile(container: MedusaContainer, plan: ProductPlan) {
  const { result } = await createShippingProfilesWorkflow(container).run({
    input: { data: [plan.shippingClass === "carton" ? CARTON_PROFILE : PALLET_PROFILE] },
  })
  return result[0].id
}

async function makeCategory(container: MedusaContainer, lang: Lang) {
  const { result } = await createProductCategoriesWorkflow(container).run({
    input: { product_categories: [{ name: lang.en, is_active: true }] },
  })
  return result[0].id
}

/** The stock of each variant that has some, at the stock location. */
async function setStock(
  container: MedusaContainer,
  plan: ProductPlan,
  productId: string,
  locationId: string,
  result: AddProductResult
) {
  const query = container.resolve(ContainerRegistrationKeys.QUERY)
  const {
    data: [created],
  } = await query.graph({
    entity: "product",
    fields: [
      "variants.id",
      "variants.variant_rank",
      "variants.inventory_items.inventory_item_id",
    ],
    filters: { id: productId },
  })

  const variants = [...(created?.variants ?? [])].sort(
    (a: any, b: any) => (a.variant_rank ?? 0) - (b.variant_rank ?? 0)
  )

  const levels: {
    inventory_item_id: string
    location_id: string
    stocked_quantity: number
  }[] = []
  plan.variants.forEach((variant, index) => {
    if (variant.stock <= 0 || !variant.manageInventory) {
      return
    }
    const inventoryItemId = (variants[index] as any)?.inventory_items?.[0]
      ?.inventory_item_id
    if (inventoryItemId) {
      levels.push({
        inventory_item_id: inventoryItemId,
        location_id: locationId,
        stocked_quantity: variant.stock,
      })
    } else {
      result.warnings.push(
        `The variant "${variant.title.en}" has no inventory item, so its stock of ${variant.stock} was not saved: set it in the admin.`
      )
    }
  })

  if (levels.length) {
    await createInventoryLevelsWorkflow(container).run({
      input: { inventory_levels: levels },
    })
    result.steps.push(`Stock saved for ${levels.length} variant(s).`)
  }
}

// ---------------------------------------------------------------------------
// A product that is there already
// ---------------------------------------------------------------------------

async function topUpExisting(
  container: MedusaContainer,
  plan: ProductPlan,
  existing: Known,
  check: boolean,
  result: AddProductResult
) {
  result.productId = existing.id
  result.status = existing.status as ProductStatus
  result.steps.push(
    row(
      "Product",
      `"${existing.title}" is already in the shop (${existing.id}, ${existing.status}, handle ${existing.handle}): its fields are left as they are.`
    )
  )

  const done = await topUpLanguages(container, plan, existing.id, {
    write: !check,
    existing: true,
  })
  const german = [...done.german.created, ...done.german.updated]

  result.steps.push(
    row(
      "German",
      german.length
        ? `${check ? "would add" : "added"} ${list(german)}${
            done.german.kept.length ? `; ${done.german.kept.length} already there` : ""
          }`
        : done.german.kept.length
          ? `nothing to add, ${done.german.kept.length} already there`
          : "nothing to add"
    )
  )
  result.steps.push(
    row(
      "Other languages",
      done.metadata.length
        ? `${check ? "would add" : "added"} to ${list(done.metadata)}`
        : "nothing to add"
    )
  )

  if (!check && (german.length || done.metadata.length)) {
    result.written = true
  }
}

// ---------------------------------------------------------------------------
// German and the other languages
// ---------------------------------------------------------------------------

/**
 * Saves German as `de-DE` translation rows and gives the metadata texts their
 * other languages. It only adds: a row that has a field keeps it, and a metadata
 * text whose English was edited since is left alone (see `localized-metadata.ts`).
 */
async function topUpLanguages(
  container: MedusaContainer,
  plan: ProductPlan,
  productId: string,
  { write, existing }: { write: boolean; existing: boolean }
): Promise<{ german: TranslationSavePlan; metadata: string[] }> {
  const query = container.resolve(ContainerRegistrationKeys.QUERY)
  const {
    data: [product],
  } = await query.graph({
    entity: "product",
    fields: [
      "id",
      "title",
      "subtitle",
      "description",
      "metadata",
      "options.id",
      "options.title",
      "options.values.id",
      "options.values.value",
      "variants.id",
      "variants.title",
      "categories.id",
      "categories.name",
    ],
    filters: { id: productId },
  })

  if (!product) {
    throw new MedusaError(
      MedusaError.Types.NOT_FOUND,
      `The product ${productId} was not found.`
    )
  }

  const entities: ProductEntities = {
    id: product.id,
    own: existing
      ? {
          title: product.title,
          subtitle: product.subtitle,
          description: product.description,
        }
      : undefined,
    options: (product.options ?? []).filter(Boolean).map((option: any) => ({
      id: option.id,
      title: option.title,
      values: (option.values ?? [])
        .filter(Boolean)
        .map((value: any) => ({ id: value.id, value: value.value })),
    })),
    variants: (product.variants ?? [])
      .filter(Boolean)
      .map((variant: any) => ({ id: variant.id, title: variant.title })),
    categories: (product.categories ?? [])
      .filter(Boolean)
      .map((category: any) => ({ id: category.id, name: category.name })),
  }

  const rows = germanRows(plan, entities)
  const translationService: ITranslationModuleService = container.resolve(
    Modules.TRANSLATION
  )
  const current = rows.length
    ? await translationService.listTranslations(
        {
          reference_id: rows.map((item) => item.reference_id),
          locale_code: GERMAN,
        },
        { take: null }
      )
    : []

  const german = planTranslationSave(
    rows,
    current.map((translation) => ({
      id: translation.id,
      reference: translation.reference,
      reference_id: translation.reference_id,
      translations: translation.translations as Record<string, unknown> | null,
    }))
  )
  if (write && (german.create.length || german.update.length)) {
    await batchTranslationsWorkflow(container).run({
      input: { create: german.create, update: german.update, delete: [] },
    })
  }

  const stored = (product.metadata ?? {}) as Record<string, unknown>
  const { texts, lists } = metadataLanguages(plan)
  const added: Record<string, string> = {}
  for (const [key, value] of Object.entries(texts)) {
    const next = addLanguages(stored[key], value)
    if (next) {
      added[key] = next
    }
  }
  for (const [key, items] of Object.entries(lists)) {
    const next = addLanguagesToList(stored[key], items)
    if (next) {
      added[key] = next
    }
  }
  if (write && Object.keys(added).length) {
    await updateProductsWorkflow(container).run({
      input: {
        selector: { id: productId },
        update: { metadata: { ...stored, ...added } },
      },
    })
  }

  return { german, metadata: Object.keys(added) }
}

/** What a new product will be given in other languages, for the dry run. */
function plannedLanguages(plan: ProductPlan): { german: string; metadata: string } {
  const rows = germanRows(plan, {
    id: "product",
    options: plan.options.map((option) => ({
      id: option.title.en,
      title: option.title.en,
      values: option.values.map((value) => ({ id: value.en, value: value.en })),
    })),
    variants: plan.variants.map((variant) => ({
      id: variant.title.en,
      title: variant.title.en,
    })),
    categories: plan.categories.map((category) => ({
      id: category.en,
      name: category.en,
    })),
  })

  const kinds = [
    ["product", "product"],
    ["product_option", "option"],
    ["product_option_value", "choices"],
    ["product_variant", "variants"],
    ["product_category", "categories"],
  ] as const
  const german = rows.length
    ? `${rows.length} texts: ${kinds
        .map(([reference, label]) => {
          const count = rows.filter((item) => item.reference === reference).length
          return count ? `${label}${count > 1 ? ` ×${count}` : ""}` : ""
        })
        .filter(Boolean)
        .join(", ")} (de-DE, which serves Austria and Germany)`
    : "none: German visitors read the English"

  const { texts, lists } = metadataLanguages(plan)
  const keys = [...Object.keys(texts), ...Object.keys(lists)]

  return {
    german,
    metadata: keys.length ? `German and Hungarian in the metadata: ${keys.join(", ")}` : "",
  }
}

// ---------------------------------------------------------------------------
// What is left for the shop owner, and how it is told
// ---------------------------------------------------------------------------

function ownerTodo(plan: ProductPlan, resolved: Resolved, isNew: boolean): string[] {
  const todo: string[] = []

  if (isNew) {
    todo.push(
      "Upload the pictures in the admin (the product → Media): at least two, the first is the main picture and the one on the product cards."
    )
    todo.push(
      "Optional: add the video in the Product video box (MP4 or WebM, up to 20 MB). The storefront shows it after the second picture."
    )
  }

  const priced = new Set(plan.variants.flatMap((variant) => Object.keys(variant.prices)))
  if (!priced.size) {
    todo.push(
      "Enter the prices when they are agreed (each variant → Prices). Until then the page reads “Price on request”."
    )
  } else {
    const missing = [
      ...new Set(
        resolved.regions
          .map((region) => region.currency)
          .filter((currency) => !priced.has(currency))
      ),
    ]
    if (missing.length) {
      todo.push(
        `Enter the ${missing
          .map((currency) => currency.toUpperCase())
          .join(" and ")} price (each variant → Prices): that market reads “Price on request” until then.`
      )
    }
  }

  if (plan.variants.every((variant) => variant.stock === 0)) {
    todo.push(
      "Add stock when pieces are ready (Inventory). Until then every choice is out of stock and the page offers “Notify me”."
    )
  }

  if (plan.status === "draft") {
    todo.push(
      "Publish it when the pictures and prices are right (the product → Status → Published); until then it is not on the storefront."
    )
  }

  const made = resolved.categories.filter((category) => !category.id)
  if (made.length) {
    todo.push(
      `Check the new ${made.length > 1 ? "categories" : "category"} ${made
        .map((category) => `"${category.lang.en}"`)
        .join(", ")}: it was made at the top level, so move it under a parent in Products → Categories if it belongs there.`
    )
  }

  return todo
}

export function renderResult(result: AddProductResult): string {
  const lines: string[] = []
  const check = result.mode === "check"

  const title =
    result.outcome === "refused"
      ? `Not added${result.handle ? `: ${result.handle}` : ""}`
      : result.outcome === "exists"
        ? `${check ? "Check" : "Updated"}: ${result.handle} is already in the shop`
        : `${check ? "Check: would add" : "Added"} ${result.handle}`
  lines.push(`== ${title} ==`)
  if (check) {
    lines.push("Dry run: nothing was written.")
  }
  if (result.steps.length) {
    lines.push("", ...result.steps)
  }

  const sections: [string, string[]][] = [
    ["Errors:", result.errors],
    ["Warnings:", result.warnings],
    ["Notes:", result.notes],
    ["Your next steps:", result.todo],
  ]
  for (const [heading, items] of sections) {
    if (items.length) {
      lines.push("", heading, ...items.map((item) => `  - ${item}`))
    }
  }

  return lines.join("\n")
}
