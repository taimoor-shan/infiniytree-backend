import { medusaIntegrationTestRunner } from "@medusajs/test-utils"
import { ContainerRegistrationKeys, Modules } from "@medusajs/framework/utils"
import {
  createProductCategoriesWorkflow,
  createRegionsWorkflow,
  createSalesChannelsWorkflow,
  createStockLocationsWorkflow,
  linkSalesChannelsToApiKeyWorkflow,
  linkSalesChannelsToStockLocationWorkflow,
  updateStoresWorkflow,
} from "@medusajs/medusa/core-flows"
import { mkdtemp, rm, writeFile } from "node:fs/promises"
import { tmpdir } from "node:os"
import { join } from "node:path"
import blueCascadeSpec from "../../product-specs/blue-cascade.json"
import addProductScript, { addProduct } from "../../src/scripts/add-product"
import { inspectProduct } from "../../src/scripts/check-product"
import { listCatalog } from "../../src/scripts/list-catalog"
import { setProductStatus } from "../../src/scripts/set-product-status"
import { createAdminHeaders } from "./helpers/admin-auth"

jest.setTimeout(180 * 1000)

const PRODUCT_FIELDS = [
  "id",
  "title",
  "handle",
  "status",
  "subtitle",
  "description",
  "metadata",
  "*categories",
  "*sales_channels",
  "*shipping_profile",
  "*options",
  "*options.values",
  "*variants",
].join(",")

/** A product with two options, prices in both currencies and stock. */
const lamp = {
  title: { en: "Black Orchid Lamp", de: "Schwarze Orchideenlampe" },
  subtitle: { en: "New", de: "Neu" },
  description: {
    en: ["A lamp with orchids.", "It needs no care."],
    de: ["Eine Lampe mit Orchideen.", "Sie braucht keine Pflege."],
  },
  shortDescription: { en: "A lamp.", de: "Eine Lampe.", hu: "Egy lámpa." },
  seo: {
    title: { en: "Black Orchid Lamp", de: "Schwarze Orchideenlampe", hu: "Fekete orchideás lámpa" },
    description: { en: "A lamp.", de: "Eine Lampe.", hu: "Egy lámpa." },
  },
  categories: [{ en: "Lamps", de: "Lampen" }],
  shippingClass: "carton",
  options: [
    {
      title: { en: "Colour", de: "Farbe" },
      values: [
        { en: "Black", de: "Schwarz" },
        { en: "White", de: "Weiß" },
      ],
    },
    {
      title: { en: "Size", de: "Größe" },
      values: [
        { en: "Small", de: "Klein" },
        { en: "Large", de: "Groß" },
      ],
    },
  ],
  prices: { eur: 1990, huf: 720000 },
  stock: 5,
  variants: [
    { options: { Colour: "Black", Size: "Small" }, sku: "LAMP-BS" },
    {
      options: { Colour: "Black", Size: "Large" },
      sku: "LAMP-BL",
      prices: { eur: 2490, huf: 900000 },
      stock: 2,
    },
    { options: { Colour: "White", Size: "Small" }, sku: "LAMP-WS" },
    {
      options: { Colour: "White", Size: "Large" },
      sku: "LAMP-WL",
      prices: { eur: 2490, huf: 900000 },
      stock: 0,
    },
  ],
}

medusaIntegrationTestRunner({
  inApp: true,
  env: {},
  testSuite: ({ api, getContainer }) => {
    let headers: Record<string, string>
    let storeHeaders: Record<string, string>
    let salesChannelId: string
    let europeRegionId: string
    let hungaryRegionId: string
    let locationId: string

    beforeEach(async () => {
      const container = getContainer()
      const admin = await createAdminHeaders(container)
      headers = admin.headers

      const [store] = await container.resolve(Modules.STORE).listStores()
      await updateStoresWorkflow(container).run({
        input: {
          selector: { id: store.id },
          update: {
            supported_currencies: [
              { currency_code: "eur", is_default: true },
              { currency_code: "huf" },
            ],
          },
        },
      })

      let [salesChannel] = await container
        .resolve(Modules.SALES_CHANNEL)
        .listSalesChannels({ name: "Default Sales Channel" })
      if (!salesChannel) {
        ;[salesChannel] = (
          await createSalesChannelsWorkflow(container).run({
            input: { salesChannelsData: [{ name: "Default Sales Channel" }] },
          })
        ).result
      }
      salesChannelId = salesChannel.id

      const { result: regions } = await createRegionsWorkflow(container).run({
        input: {
          regions: [
            {
              name: "Europe",
              currency_code: "eur",
              countries: ["at", "de"],
              payment_providers: ["pp_system_default"],
            },
            {
              name: "Hungary",
              currency_code: "huf",
              countries: ["hu"],
              payment_providers: ["pp_system_default"],
            },
          ],
        },
      })
      europeRegionId = regions.find((region) => region.name === "Europe")!.id
      hungaryRegionId = regions.find((region) => region.name === "Hungary")!.id

      const {
        result: [location],
      } = await createStockLocationsWorkflow(container).run({
        input: { locations: [{ name: "European Warehouse" }] },
      })
      locationId = location.id
      await linkSalesChannelsToStockLocationWorkflow(container).run({
        input: { id: location.id, add: [salesChannel.id] },
      })

      const key = await container.resolve(Modules.API_KEY).createApiKeys({
        title: "storefront",
        type: "publishable",
        created_by: admin.user.id,
      })
      await linkSalesChannelsToApiKeyWorkflow(container).run({
        input: { id: key.id, add: [salesChannel.id] },
      })
      storeHeaders = { "x-publishable-api-key": key.token }
    })

    const add = (spec: unknown, options = {}) =>
      addProduct(getContainer(), spec, options)

    const readProduct = async (id: string) =>
      (await api.get(`/admin/products/${id}?fields=${PRODUCT_FIELDS}`, { headers }))
        .data.product

    const productsByHandle = async (handle: string) =>
      (await api.get(`/admin/products?handle=${handle}&limit=10`, { headers })).data
        .products

    /** Everything the tool could write to, counted. */
    const fingerprint = async () => {
      const container = getContainer()
      return {
        products: (await container.resolve(Modules.PRODUCT).listProducts({})).length,
        categories: (
          await container.resolve(Modules.PRODUCT).listProductCategories({})
        ).length,
        profiles: (await container.resolve(Modules.FULFILLMENT).listShippingProfiles({}))
          .length,
        translations: (
          await container.resolve(Modules.TRANSLATION).listTranslations({}, { take: null })
        ).length,
        inventoryItems: (await container.resolve(Modules.INVENTORY).listInventoryItems({}))
          .length,
        levels: (await container.resolve(Modules.INVENTORY).listInventoryLevels({}))
          .length,
      }
    }

    const germanRows = async () =>
      getContainer()
        .resolve(Modules.TRANSLATION)
        .listTranslations({ locale_code: "de-DE" }, { take: null })

    /** A variant's prices as saved: "eur 1990" for the base price, "eur 1990 @region" for a region. */
    const pricesOf = async (handle: string) => {
      const {
        data: [product],
      } = await getContainer()
        .resolve(ContainerRegistrationKeys.QUERY)
        .graph({
          entity: "product",
          fields: [
            "variants.title",
            "variants.price_set.prices.currency_code",
            "variants.price_set.prices.amount",
            "variants.price_set.prices.price_rules.attribute",
            "variants.price_set.prices.price_rules.value",
          ],
          filters: { handle },
        })

      const regionName: Record<string, string> = {
        [europeRegionId]: "Europe",
        [hungaryRegionId]: "Hungary",
      }
      return Object.fromEntries(
        product.variants.map((variant: any) => [
          variant.title,
          variant.price_set.prices
            .map(
              (price: any) =>
                `${price.currency_code} ${Number(price.amount)}${
                  price.price_rules?.length
                    ? ` @${regionName[price.price_rules[0].value]}`
                    : ""
                }`
            )
            .sort(),
        ])
      )
    }

    describe("the Blue Cascade spec", () => {
      let result: Awaited<ReturnType<typeof add>>
      let product: any

      beforeEach(async () => {
        result = await add(blueCascadeSpec)
        product = await readProduct(result.productId!)
      })

      it("makes the product a draft, as the spec says", () => {
        expect(result).toEqual(
          expect.objectContaining({
            mode: "write",
            outcome: "create",
            ok: true,
            written: true,
            handle: "blue-cascade",
            status: "draft",
            errors: [],
          })
        )
        expect(product).toEqual(
          expect.objectContaining({
            title: "Blue Cascade",
            handle: "blue-cascade",
            status: "draft",
            subtitle: "One of a kind",
          })
        )
        expect(product.description.split("\n\n")).toHaveLength(4)
      })

      it("has a Planter option with Blue, Gold and White, one variant each, no price, no stock", async () => {
        expect(product.options).toHaveLength(1)
        expect(product.options[0].title).toBe("Planter")
        expect(product.options[0].values.map((v: any) => v.value).sort()).toEqual([
          "Blue",
          "Gold",
          "White",
        ])

        const byRank = [...product.variants].sort(
          (a: any, b: any) => a.variant_rank - b.variant_rank
        )
        expect(byRank.map((v: any) => v.title)).toEqual(["Blue", "Gold", "White"])
        for (const variant of byRank) {
          expect(variant.manage_inventory).toBe(true)
          expect(variant.allow_backorder).toBe(false)
        }
        expect(Object.values(await pricesOf("blue-cascade")).flat()).toEqual([])

        const inventory = getContainer().resolve(Modules.INVENTORY)
        expect(await inventory.listInventoryItems({})).toHaveLength(3)
        expect(await inventory.listInventoryLevels({})).toHaveLength(0)
      })

      it("sells in the default sales channel, ships on a pallet, sits in the new category", () => {
        expect(product.sales_channels.map((c: any) => c.id)).toEqual([salesChannelId])
        expect(product.shipping_profile).toEqual(
          expect.objectContaining({ name: "Pallet products", type: "pallet" })
        )
        expect(product.categories.map((c: any) => c.name)).toEqual(["One of a kind"])
      })

      it("keeps what the page reads in the metadata, English first and German and Hungarian beside it", () => {
        const { metadata } = product

        expect(JSON.parse(metadata.short_description)).toEqual({
          en: expect.stringContaining("Blue Cascade is a one-of-a-kind"),
          "de-AT": expect.stringContaining("Blue Cascade ist eine einzigartige"),
          "de-DE": expect.stringContaining("Blue Cascade ist eine einzigartige"),
          "hu-HU": expect.stringContaining("A Blue Cascade egyedi"),
        })
        expect(JSON.parse(metadata.seo_title)).toEqual(
          expect.objectContaining({
            en: "Blue Cascade | One-of-a-Kind Artificial Floral Arrangement | InfinYtree",
            "de-DE": expect.stringContaining("Einzigartiges künstliches"),
          })
        )

        const features = JSON.parse(metadata.key_features)
        expect(features).toHaveLength(6)
        expect(features[2]).toEqual({
          en: "Maintenance-free",
          "de-AT": "Pflegefrei",
          "de-DE": "Pflegefrei",
          "hu-HU": "Karbantartásmentes",
        })
        expect(JSON.parse(metadata.approx_dimensions)).toEqual({
          height: "160–180",
          width: "140–170",
          depth: "80–100",
          unit: "cm",
        })
      })

      it("saves the German as de-DE rows for the product, its option, choices, variants and category", async () => {
        const rows = await germanRows()
        const byKind = (reference: string) =>
          rows.filter((row) => row.reference === reference)

        expect(byKind("product")).toHaveLength(1)
        expect(byKind("product")[0]).toEqual(
          expect.objectContaining({
            reference_id: product.id,
            translations: {
              title: "Kunstblumen-Arrangement Blue Cascade",
              subtitle: "Einzigartig",
              description: expect.stringContaining("Blue Cascade ist ein dramatisches"),
            },
          })
        )
        expect(byKind("product_option").map((r) => r.translations)).toEqual([
          { title: "Pflanzgefäß" },
        ])
        expect(
          byKind("product_option_value")
            .map((r) => (r.translations as any).value)
            .sort()
        ).toEqual(["Blau", "Gold", "Weiß"])
        expect(
          byKind("product_variant")
            .map((r) => (r.translations as any).title)
            .sort()
        ).toEqual(["Blau", "Gold", "Weiß"])
        expect(byKind("product_category").map((r) => r.translations)).toEqual([
          { name: "Unikate" },
        ])
        expect(rows).toHaveLength(9)
      })

      it("is a draft: the storefront does not list it", async () => {
        const { data } = await api.get("/store/products?handle=blue-cascade", {
          headers: storeHeaders,
        })
        expect(data.products).toHaveLength(0)
      })

      it("tells the owner what is left to do", () => {
        const todo = result.todo.join("\n")
        expect(todo).toContain("Upload the pictures")
        expect(todo).toContain("Price on request")
        expect(todo).toContain("Add stock")
        expect(todo).toContain("Publish it")
      })
    })

    describe("published straight away", () => {
      it("is on the storefront, with a warning that it has no pictures yet", async () => {
        const result = await add(blueCascadeSpec, { status: "published" })

        expect(result.ok).toBe(true)
        expect(result.status).toBe("published")
        expect(result.warnings.join("\n")).toContain("published straight away")

        const { data } = await api.get("/store/products?handle=blue-cascade", {
          headers: storeHeaders,
        })
        expect(data.products).toHaveLength(1)
      })
    })

    describe("a product with two options, prices and stock", () => {
      let result: Awaited<ReturnType<typeof add>>
      let product: any

      beforeEach(async () => {
        result = await add(lamp, { status: "published" })
        product = await readProduct(result.productId!)
      })

      it("makes a variant for every combination, titled by its choices", () => {
        expect(result.ok).toBe(true)
        expect(
          [...product.variants]
            .sort((a: any, b: any) => a.variant_rank - b.variant_rank)
            .map((v: any) => [v.title, v.sku])
        ).toEqual([
          ["Black / Small", "LAMP-BS"],
          ["Black / Large", "LAMP-BL"],
          ["White / Small", "LAMP-WS"],
          ["White / Large", "LAMP-WL"],
        ])
      })

      it("saves each price as a base price and one for each region that uses the currency", async () => {
        const prices = await pricesOf("black-orchid-lamp")

        expect(prices["Black / Small"]).toEqual(
          [
            "eur 1990",
            "eur 1990 @Europe",
            "huf 720000",
            "huf 720000 @Hungary",
          ].sort()
        )
        expect(prices["White / Large"]).toEqual(
          [
            "eur 2490",
            "eur 2490 @Europe",
            "huf 900000",
            "huf 900000 @Hungary",
          ].sort()
        )
      })

      it("charges what the spec says in each market, as the storefront reads it", async () => {
        const calculated = async (regionId: string) =>
          Object.fromEntries(
            (
              await api.get(
                `/store/products?handle=black-orchid-lamp&region_id=${regionId}&fields=*variants.calculated_price`,
                { headers: storeHeaders }
              )
            ).data.products[0].variants.map((v: any) => [
              v.title,
              [v.calculated_price.currency_code, v.calculated_price.calculated_amount],
            ])
          )

        expect(await calculated(europeRegionId)).toEqual({
          "Black / Small": ["eur", 1990],
          "Black / Large": ["eur", 2490],
          "White / Small": ["eur", 1990],
          "White / Large": ["eur", 2490],
        })
        expect(await calculated(hungaryRegionId)).toEqual({
          "Black / Small": ["huf", 720000],
          "Black / Large": ["huf", 900000],
          "White / Small": ["huf", 720000],
          "White / Large": ["huf", 900000],
        })
      })

      it("stocks the variants that have stock at the stock location, and none for zero", async () => {
        const container = getContainer()
        const levels = await container
          .resolve(Modules.INVENTORY)
          .listInventoryLevels({}, { relations: ["inventory_item"] })

        expect(levels).toHaveLength(3)
        expect(levels.every((level) => level.location_id === locationId)).toBe(true)
        expect(levels.map((level) => Number(level.stocked_quantity)).sort()).toEqual([
          2, 5, 5,
        ])
        expect(await container.resolve(Modules.INVENTORY).listInventoryItems({})).toHaveLength(4)
      })

      it("ships in cartons, in a class it made", async () => {
        expect(product.shipping_profile).toEqual(
          expect.objectContaining({ name: "Carton products", type: "carton" })
        )
      })

      it("says the two sizes' German titles joined as the English ones are", async () => {
        const titles = (await germanRows())
          .filter((row) => row.reference === "product_variant")
          .map((row) => (row.translations as any).title)
          .sort()

        expect(titles).toEqual([
          "Schwarz / Groß",
          "Schwarz / Klein",
          "Weiß / Groß",
          "Weiß / Klein",
        ])
      })

      it("reads as complete in the inspection, but for the pictures", async () => {
        const inspected = await inspectProduct(getContainer(), "black-orchid-lamp")

        expect(inspected.found).toBe(true)
        expect(inspected.review!.lines.join("\n")).toContain("Price Europe")
        expect(inspected.review!.lines.join("\n")).toContain("EUR 1,990 / EUR 2,490")
        expect(inspected.review!.lines.join("\n")).toContain("HUF 720,000 / HUF 900,000")
        expect(inspected.review!.lines.join("\n")).toContain("White / Large [LAMP-WL]: out of stock")
        expect(inspected.review!.lines.join("\n")).toContain("Black / Large [LAMP-BL]: 2 available")
        // It was published with no pictures: that is the one problem.
        expect(inspected.review!.problems).toEqual([
          expect.stringContaining("Published without pictures"),
        ])
        expect(inspected.review!.warnings).toEqual([])
      })
    })

    describe("a dry run", () => {
      it("writes nothing and says what it would do", async () => {
        const before = await fingerprint()
        const result = await add(blueCascadeSpec, { check: true })

        expect(result).toEqual(
          expect.objectContaining({
            mode: "check",
            outcome: "create",
            ok: true,
            written: false,
          })
        )
        expect(result.productId).toBeUndefined()
        expect(result.steps.join("\n")).toContain("Pallet products (will be made)")
        expect(result.steps.join("\n")).toContain("One of a kind (will be made)")
        expect(result.steps.join("\n")).toContain("9 texts")
        expect(await fingerprint()).toEqual(before)
        expect(await productsByHandle("blue-cascade")).toHaveLength(0)
      })

      it("writes nothing for a product that is there either", async () => {
        const first = await add(blueCascadeSpec)
        const before = await fingerprint()

        const result = await add(blueCascadeSpec, { check: true })
        expect(result.outcome).toBe("exists")
        expect(result.written).toBe(false)
        expect(result.productId).toBe(first.productId)
        expect(await fingerprint()).toEqual(before)
      })

      it("says which prices a market will miss", async () => {
        const result = await add({ ...lamp, prices: { eur: 1990 }, variants: undefined }, { check: true })

        expect(result.ok).toBe(true)
        expect(result.warnings.join("\n")).toContain(
          'No HUF price: Hungary will read "Price on request"'
        )
        expect(result.todo.join("\n")).toContain("Enter the HUF price")
      })
    })

    describe("running the same spec again", () => {
      it("leaves the product as the admin has it and adds only what is missing", async () => {
        const first = await add(blueCascadeSpec)
        const container = getContainer()
        const translations = container.resolve(Modules.TRANSLATION)

        // Edited in the admin: the product is renamed, its German title rewritten
        // by hand, and the German of one choice lost.
        await api.post(
          `/admin/products/${first.productId}`,
          { title: "Blue Cascade XL" },
          { headers }
        )
        const rows = await translations.listTranslations(
          { locale_code: "de-DE" },
          { take: null }
        )
        const productRow = rows.find((row) => row.reference === "product")!
        await translations.updateTranslations([
          {
            id: productRow.id,
            translations: {
              ...(productRow.translations as Record<string, string>),
              title: "Von Hand geschrieben",
            },
          },
        ])
        const goldRow = rows.find(
          (row) => (row.translations as any)?.value === "Gold"
        )!
        await translations.deleteTranslations([goldRow.id])

        const second = await add(blueCascadeSpec)

        expect(second).toEqual(
          expect.objectContaining({
            outcome: "exists",
            ok: true,
            written: true,
            productId: first.productId,
          })
        )
        expect(second.steps.join("\n")).toContain("is already in the shop")
        expect(second.steps.join("\n")).toContain("Planter Gold")

        expect(await productsByHandle("blue-cascade")).toHaveLength(1)
        expect((await readProduct(first.productId!)).title).toBe("Blue Cascade XL")

        const after = await translations.listTranslations(
          { locale_code: "de-DE" },
          { take: null }
        )
        expect(after).toHaveLength(9)
        expect((after.find((row) => row.reference === "product")!.translations as any).title).toBe(
          "Von Hand geschrieben"
        )
        expect(
          after.find((row) => (row.translations as any)?.value === "Gold")
        ).toBeDefined()
      })

      it("changes nothing the second time when nothing is missing", async () => {
        await add(blueCascadeSpec)
        const before = await fingerprint()
        const metadata = (await readProduct((await productsByHandle("blue-cascade"))[0].id))
          .metadata

        const second = await add(blueCascadeSpec)

        expect(second.outcome).toBe("exists")
        expect(second.written).toBe(false)
        expect(await fingerprint()).toEqual(before)
        expect(
          (await readProduct((await productsByHandle("blue-cascade"))[0].id)).metadata
        ).toEqual(metadata)
      })

      it("does not put German under an English text that was edited since", async () => {
        const first = await add(blueCascadeSpec)
        const edited =
          "Blue Cascade, rewritten by the shop owner: a text the old German no longer says."
        await api.post(
          `/admin/products/${first.productId}`,
          { metadata: { short_description: edited } },
          { headers }
        )

        await add(blueCascadeSpec)

        expect(
          (await readProduct(first.productId!)).metadata.short_description
        ).toBe(edited)
      })
    })

    describe("refusing", () => {
      it("a spec that is not right, naming each fault", async () => {
        const before = await fingerprint()
        const result = await add({ title: "Olive Tree", prices: { eur: -1 } })

        expect(result.ok).toBe(false)
        expect(result.outcome).toBe("refused")
        expect(result.written).toBe(false)
        expect(result.errors.join("\n")).toContain("shippingClass is required")
        expect(result.errors.join("\n")).toContain("prices.eur must be a number above zero")
        expect(await fingerprint()).toEqual(before)
      })

      it("a product with the same name under another handle, which would be a second copy", async () => {
        const first = await add(blueCascadeSpec)
        const before = await fingerprint()

        const result = await add({ ...blueCascadeSpec, handle: "blue-cascade-2" })

        expect(result.ok).toBe(false)
        expect(result.errors).toEqual([
          expect.stringContaining(
            `A product called "Blue Cascade" already exists under the handle "blue-cascade" (${first.productId})`
          ),
        ])
        expect(await fingerprint()).toEqual(before)
      })

      it("a collection, type or tag the shop does not have, with a hint for a typo", async () => {
        const container = getContainer()
        await container.resolve(Modules.PRODUCT).createProductCollections([
          { title: "Summer", handle: "summer" },
        ])
        await container.resolve(Modules.PRODUCT).createProductTags([{ value: "Garden" }])

        const result = await add({
          ...lamp,
          collection: "Sumer",
          type: "Lamp",
          tags: ["Garden", "Gardn"],
        })

        expect(result.ok).toBe(false)
        expect(result.errors.join("\n")).toContain(
          'The collection "Sumer" does not exist (Summer). Did you mean "Summer"?'
        )
        expect(result.errors.join("\n")).toContain('The product type "Lamp" does not exist')
        expect(result.errors.join("\n")).toContain(
          'The tag "Gardn" does not exist (Garden). Did you mean "Garden"?'
        )
        expect(result.errors.join("\n")).not.toContain('The tag "Garden"')
        expect(await productsByHandle("black-orchid-lamp")).toHaveLength(0)
      })

      it("a SKU another variant has", async () => {
        await add(lamp)
        const result = await add({ ...lamp, title: "Another Lamp" })

        expect(result.ok).toBe(false)
        expect(result.errors.join("\n")).toContain(
          'The SKU "LAMP-BS" is already used by the variant "Black / Small"'
        )
        expect(await productsByHandle("another-lamp")).toHaveLength(0)
      })

      it("a currency the store does not sell in, a missing stock location and a missing channel", async () => {
        const result = await add({
          ...lamp,
          prices: { usd: 20 },
          variants: undefined,
          stockLocation: "Nowhere",
          salesChannel: "Webshop",
        })

        expect(result.ok).toBe(false)
        expect(result.errors.join("\n")).toContain("The store does not sell in USD (it sells in ")
        expect(result.errors.join("\n")).toContain('The stock location "Nowhere" does not exist')
        expect(result.errors.join("\n")).toContain('The sales channel "Webshop" does not exist')
      })

      it("a category name that matches several categories", async () => {
        const {
          result: [indoor],
        } = await createProductCategoriesWorkflow(getContainer()).run({
          input: { product_categories: [{ name: "Indoor", is_active: true }] },
        })
        await createProductCategoriesWorkflow(getContainer()).run({
          input: {
            product_categories: [
              { name: "Lamps", handle: "lamps", is_active: true },
              {
                name: "Lamps",
                handle: "lamps-indoor",
                is_active: true,
                parent_category_id: indoor.id,
              },
            ],
          },
        })
        const result = await add(lamp)

        expect(result.ok).toBe(false)
        expect(result.errors.join("\n")).toContain('The category "Lamps" matches several categories')
      })
    })

    describe("what it warns about but allows", () => {
      it("a similar name, so a renamed product is not added again by mistake", async () => {
        await add({ ...blueCascadeSpec, title: "Blue Cascade Composition", handle: "blue-cascade-composition" })

        const result = await add(blueCascadeSpec, { check: true })

        expect(result.ok).toBe(true)
        expect(result.outcome).toBe("create")
        expect(result.warnings.join("\n")).toContain(
          'similar name, "Blue Cascade Composition" (blue-cascade-composition)'
        )
      })

      it("a category that looks like a typo, which it then makes", async () => {
        await createProductCategoriesWorkflow(getContainer()).run({
          input: { product_categories: [{ name: "Lamps", is_active: true }] },
        })

        const result = await add({ ...lamp, categories: [{ en: "Lampz", de: "Lampz" }] })

        expect(result.ok).toBe(true)
        expect(result.warnings.join("\n")).toContain(
          'The category "Lampz" is not in the shop yet, so it is made with the product'
        )
        expect(result.warnings.join("\n")).toContain('Did you mean "Lamps"?')
        const { categories } = await readProduct(result.productId!)
        expect(categories.map((c: any) => c.name)).toEqual(["Lampz"])
      })
    })

    describe("the categories", () => {
      it("uses an existing one, whatever its capitals, and gives it its German name", async () => {
        const {
          result: [existing],
        } = await createProductCategoriesWorkflow(getContainer()).run({
          input: { product_categories: [{ name: "LAMPS", is_active: true }] },
        })

        const result = await add(lamp)
        const product = await readProduct(result.productId!)

        expect(product.categories.map((c: any) => c.id)).toEqual([existing.id])
        expect(
          (
            await getContainer()
              .resolve(Modules.PRODUCT)
              .listProductCategories({}, { select: ["id", "name"] })
          ).filter((category) => category.name.toLowerCase() === "lamps")
        ).toHaveLength(1)
        expect(
          (await germanRows()).find((row) => row.reference === "product_category")!
            .translations
        ).toEqual({ name: "Lampen" })
      })
    })

    describe("a product without options", () => {
      it("gets the default option and variant the admin makes", async () => {
        const result = await add({
          title: "Olive Tree",
          shippingClass: "pallet",
          prices: { eur: 4500 },
          stock: 1,
        })
        const product = await readProduct(result.productId!)

        expect(result.ok).toBe(true)
        expect(product.options.map((o: any) => [o.title, o.values.map((v: any) => v.value)])).toEqual([
          ["Default option", ["Default option value"]],
        ])
        expect(product.variants.map((v: any) => v.title)).toEqual(["Default variant"])
        expect(await pricesOf("olive-tree")).toEqual({
          "Default variant": ["eur 4500", "eur 4500 @Europe"],
        })
      })
    })

    describe("the command", () => {
      let directory: string
      let log: jest.SpyInstance

      beforeEach(async () => {
        directory = await mkdtemp(join(tmpdir(), "add-product-"))
        log = jest.spyOn(console, "log").mockImplementation(() => {})
        process.exitCode = undefined
      })

      afterEach(async () => {
        log.mockRestore()
        process.exitCode = undefined
        await rm(directory, { recursive: true, force: true })
      })

      const run = async (spec: unknown, words: string[]) => {
        const file = join(directory, "spec.json")
        await writeFile(file, JSON.stringify(spec))
        await addProductScript({ container: getContainer(), args: [file, ...words] } as any)

        const output = log.mock.calls.map((call) => String(call[0])).join("\n")
        const json = output.split("\n").find((line) => line.startsWith("RESULT_JSON "))
        return { output, result: json ? JSON.parse(json.slice("RESULT_JSON ".length)) : null }
      }

      it("reads the file, prints the report and ends with the result as JSON", async () => {
        const { output, result } = await run(blueCascadeSpec, ["check"])

        expect(output).toContain("== Check: would add blue-cascade ==")
        expect(output).toContain("Dry run: nothing was written.")
        expect(output).toContain("Your next steps:")
        expect(result).toEqual(expect.objectContaining({ mode: "check", outcome: "create", ok: true }))
        expect(process.exitCode).toBeUndefined()
        expect(await productsByHandle("blue-cascade")).toHaveLength(0)
      })

      it("writes when it is not told to check, and takes draft or published from the words", async () => {
        const { result } = await run({ ...blueCascadeSpec, status: "draft" }, ["published"])

        expect(result).toEqual(
          expect.objectContaining({ mode: "write", outcome: "create", status: "published" })
        )
        expect((await productsByHandle("blue-cascade"))[0].status).toBe("published")
      })

      it("ends with a failing exit code when the spec is refused", async () => {
        const { output, result } = await run({ title: "No class" }, ["check"])

        expect(output).toContain("== Not added")
        expect(output).toContain("shippingClass is required")
        expect(result.ok).toBe(false)
        expect(process.exitCode).toBe(1)
      })

      it("says how it is used when no file is given", async () => {
        await addProductScript({ container: getContainer(), args: ["check"] } as any)

        expect(log.mock.calls[0][0]).toContain("Usage:")
        expect(process.exitCode).toBe(1)
      })

      it("says when the file is not JSON", async () => {
        const file = join(directory, "broken.json")
        await writeFile(file, "{ not json")
        await addProductScript({ container: getContainer(), args: [file] } as any)

        expect(String(log.mock.calls[0][0])).toContain("Cannot read")
        expect(process.exitCode).toBe(1)
      })
    })

    describe("publishing", () => {
      it("is refused while the product has no pictures, and allowed with force", async () => {
        await add(blueCascadeSpec)

        const refused = await setProductStatus(getContainer(), "blue-cascade", "published")
        expect(refused.ok).toBe(false)
        expect(refused.changed).toBe(false)
        expect(refused.problems).toEqual([
          expect.stringContaining("Published without pictures"),
        ])
        expect((await productsByHandle("blue-cascade"))[0].status).toBe("draft")

        const forced = await setProductStatus(getContainer(), "blue-cascade", "published", {
          force: true,
        })
        expect(forced).toEqual(
          expect.objectContaining({ ok: true, changed: true, from: "draft", to: "published" })
        )
        expect((await productsByHandle("blue-cascade"))[0].status).toBe("published")
      })

      it("goes through once the pictures are in, and a product can be taken back to draft", async () => {
        const created = await add(blueCascadeSpec)
        await api.post(
          `/admin/products/${created.productId}`,
          {
            images: [
              { url: "https://shop.test/static/one.jpg" },
              { url: "https://shop.test/static/two.jpg" },
            ],
          },
          { headers }
        )

        const published = await setProductStatus(getContainer(), "blue-cascade", "published")
        expect(published.ok).toBe(true)

        const { data } = await api.get("/store/products?handle=blue-cascade", {
          headers: storeHeaders,
        })
        expect(data.products).toHaveLength(1)

        const again = await setProductStatus(getContainer(), "blue-cascade", "published")
        expect(again).toEqual(expect.objectContaining({ ok: true, changed: false }))

        const back = await setProductStatus(getContainer(), "blue-cascade", "draft")
        expect(back).toEqual(expect.objectContaining({ ok: true, changed: true }))
        const hidden = await api.get("/store/products?handle=blue-cascade", {
          headers: storeHeaders,
        })
        expect(hidden.data.products).toHaveLength(0)

        const inspected = await inspectProduct(getContainer(), created.productId!)
        expect(inspected.review!.lines.join("\n")).toContain("Pictures        2")
        expect(inspected.review!.todo.join("\n")).not.toContain("upload at least two")
      })

      it("says when there is no such product, with a hint", async () => {
        await add(blueCascadeSpec)

        const missing = await setProductStatus(getContainer(), "blue-cascad", "published")
        expect(missing.ok).toBe(false)
        expect(missing.message).toContain('No product has the handle or id "blue-cascad"')
        expect(missing.message).toContain('Did you mean "blue-cascade"?')
      })
    })

    describe("the inspection", () => {
      it("reads a draft with no price and no stock the way the storefront will", async () => {
        await add(blueCascadeSpec)

        const inspected = await inspectProduct(getContainer(), "blue-cascade")
        const text = inspected.review!.lines.join("\n")

        expect(inspected).toEqual(
          expect.objectContaining({ found: true, ok: true, handle: "blue-cascade", status: "draft" })
        )
        expect(inspected.review!.problems).toEqual([])
        expect(text).toContain("Shipping class  Pallet products (pallet)")
        expect(text).toContain("Price Europe")
        expect(text).toContain("Price on request")
        expect(text).toContain("Availability    out of stock everywhere")
        expect(text).toContain("all 9 records complete")
        // The owner's search title is 71 characters, one over what a result shows.
        expect(inspected.review!.warnings).toEqual([
          "seo_title is 71 characters; search results cut it at about 60–70.",
        ])
      })

      it("finds a product by its id, and reports one that is not there", async () => {
        const created = await add(blueCascadeSpec)

        expect((await inspectProduct(getContainer(), created.productId!)).found).toBe(true)

        const missing = await inspectProduct(getContainer(), "blue-cascad")
        expect(missing.found).toBe(false)
        expect(missing.ok).toBe(false)
        expect(missing.message).toContain('Did you mean "blue-cascade"?')
      })

      it("notices German that is gone", async () => {
        await add(blueCascadeSpec)
        const translations = getContainer().resolve(Modules.TRANSLATION)
        const rows = await translations.listTranslations({ locale_code: "de-DE" }, { take: null })
        await translations.deleteTranslations([
          rows.find((row) => row.reference === "product_category")!.id,
        ])

        const inspected = await inspectProduct(getContainer(), "blue-cascade")
        expect(inspected.review!.warnings).toContain(
          "No German saved for: category One of a kind (name)."
        )
      })
    })

    describe("the catalog", () => {
      it("lists what a spec can refer to and the German the shop already uses", async () => {
        await add(blueCascadeSpec)
        await add(lamp)

        const catalog = await listCatalog(getContainer())

        expect(catalog.categories.map((c) => [c.name, c.german])).toEqual(
          expect.arrayContaining([
            ["One of a kind", "Unikate"],
            ["Lamps", "Lampen"],
          ])
        )
        expect(catalog.shippingProfiles.map((p) => p.type).sort()).toEqual(["carton", "pallet"])
        expect(catalog.salesChannels).toEqual(["Default Sales Channel"])
        expect(catalog.stockLocations).toEqual(["European Warehouse"])
        expect(catalog.storeCurrencies.sort()).toEqual(["eur", "huf"])
        expect(catalog.regions).toEqual(
          expect.arrayContaining([
            { name: "Europe", currency: "eur", countries: ["AT", "DE"] },
            { name: "Hungary", currency: "huf", countries: ["HU"] },
          ])
        )
        expect(catalog.products.map((p) => [p.handle, p.status, p.shippingClass, p.variants])).toEqual(
          expect.arrayContaining([
            ["blue-cascade", "draft", "pallet", 3],
            ["black-orchid-lamp", "draft", "carton", 4],
          ])
        )
        expect(catalog.german).toEqual(
          expect.arrayContaining([
            { kind: "badge", english: "One of a kind", german: "Einzigartig" },
            { kind: "option", english: "Planter", german: "Pflanzgefäß" },
            { kind: "choice", english: "Blue", german: "Blau" },
            { kind: "choice", english: "White", german: "Weiß" },
            { kind: "category", english: "One of a kind", german: "Unikate" },
          ])
        )
      })
    })
  },
})
