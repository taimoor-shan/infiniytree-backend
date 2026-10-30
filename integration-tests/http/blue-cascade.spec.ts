import { medusaIntegrationTestRunner } from "@medusajs/test-utils"
import { Modules, ProductStatus } from "@medusajs/framework/utils"
import {
  createProductCategoriesWorkflow,
  createSalesChannelsWorkflow,
  createStockLocationsWorkflow,
  linkSalesChannelsToApiKeyWorkflow,
  linkSalesChannelsToStockLocationWorkflow,
} from "@medusajs/medusa/core-flows"
import { createAdminHeaders } from "./helpers/admin-auth"
import { addBlueCascade } from "../../src/scripts/add-blue-cascade"

jest.setTimeout(120 * 1000)

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
  "*variants.prices",
].join(",")

medusaIntegrationTestRunner({
  inApp: true,
  env: {},
  testSuite: ({ api, getContainer }) => {
    let headers: Record<string, string>
    let storeHeaders: Record<string, string>
    let salesChannelId: string

    beforeEach(async () => {
      const container = getContainer()
      const admin = await createAdminHeaders(container)
      headers = admin.headers

      // What the shop already has: the default sales channel the storefront
      // reads from, with a stock location, as the Medusa admin sets it up.
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

      const {
        result: [location],
      } = await createStockLocationsWorkflow(container).run({
        input: { locations: [{ name: "Warehouse" }] },
      })
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

    const createOneOfAKindCategory = async (name: string) => {
      const {
        result: [category],
      } = await createProductCategoriesWorkflow(getContainer()).run({
        input: {
          product_categories: [
            { name, handle: "on-of-kind", is_active: true },
          ],
        },
      })
      return category
    }

    const readProduct = async (id: string) =>
      (await api.get(`/admin/products/${id}?fields=${PRODUCT_FIELDS}`, { headers }))
        .data.product

    const listProductsByHandle = async () =>
      (
        await api.get("/admin/products?handle=blue-cascade&limit=10", {
          headers,
        })
      ).data.products

    describe("the product", () => {
      let product: any

      beforeEach(async () => {
        await createOneOfAKindCategory("On of kind")
        const { productId } = await addBlueCascade(getContainer())
        product = await readProduct(productId)
      })

      it("carries the name, badge and texts as given", () => {
        expect(product).toEqual(
          expect.objectContaining({
            title: "Blue Cascade",
            handle: "blue-cascade",
            status: "published",
            subtitle: "One of a kind",
          })
        )
        // Four paragraphs with a blank line between them.
        expect(product.description.split("\n\n")).toEqual([
          "Blue Cascade is a dramatic one-of-a-kind floral arrangement created for interiors that call for a bold and memorable statement.",
          "Its abundant composition combines layered blooms, rich textures and a flowing silhouette that creates depth, movement and elegance from every angle.",
          "Designed for hotels, boutiques, restaurants, reception areas, showrooms and high-end private interiors, Blue Cascade offers the visual impact of a grand floral installation without the maintenance of fresh flowers.",
          "No watering, no replacement, no daily care — just a lasting botanical statement.",
        ])
      })

      it("keeps the short description, details, dimensions and SEO text in its metadata", () => {
        const { metadata } = product

        expect(metadata.short_description).toBe(
          "Blue Cascade is a one-of-a-kind floral composition designed to create an unforgettable visual impact. Rich blue tones, layered textures and an abundant cascading form make it an exceptional decorative centerpiece for refined interiors."
        )
        // The same shape as the other products' key features: texts by language.
        expect(JSON.parse(metadata.key_features)).toEqual([
          { en: "One-of-a-kind artificial floral composition" },
          { en: "Hand-assembled decorative arrangement" },
          { en: "Maintenance-free" },
          { en: "Suitable for indoor use" },
          {
            en: "Ideal for hospitality, retail, commercial and residential interiors",
          },
          { en: "Unique composition with a bold cascading silhouette" },
        ])
        expect(JSON.parse(metadata.approx_dimensions)).toEqual({
          height: "160–180",
          width: "140–170",
          depth: "80–100",
          unit: "cm",
        })
        expect(metadata.seo_title).toBe(
          "Blue Cascade | One-of-a-Kind Artificial Floral Arrangement | InfinYtree"
        )
        expect(metadata.seo_description).toBe(
          "Discover Blue Cascade, a one-of-a-kind large-scale artificial floral arrangement designed to bring bold elegance and lasting impact to exceptional interiors."
        )
      })

      it("has a Planter option with Blue, Gold and White, one variant each", () => {
        expect(product.options).toHaveLength(1)
        expect(product.options[0].title).toBe("Planter")
        expect(product.options[0].values.map((v: any) => v.value)).toEqual(
          expect.arrayContaining(["Blue", "Gold", "White"])
        )
        expect(product.options[0].values).toHaveLength(3)

        const byRank = [...product.variants].sort(
          (a: any, b: any) => a.variant_rank - b.variant_rank
        )
        expect(byRank.map((v: any) => v.title)).toEqual([
          "Blue",
          "Gold",
          "White",
        ])
      })

      it("has no price on any variant, not even a zero", () => {
        for (const variant of product.variants) {
          expect(variant.prices).toEqual([])
        }
      })

      it("is out of stock in every planter: stock is tracked and nothing is in stock", async () => {
        const container = getContainer()

        for (const variant of product.variants) {
          expect(variant.manage_inventory).toBe(true)
          expect(variant.allow_backorder).toBe(false)
        }

        const inventory = container.resolve(Modules.INVENTORY)
        // One inventory item per variant, so stock can be added in the admin.
        expect(await inventory.listInventoryItems({})).toHaveLength(3)
        expect(await inventory.listInventoryLevels({})).toHaveLength(0)

        // What the storefront reads.
        const { data } = await api.get(
          "/store/products?handle=blue-cascade&fields=*variants,+variants.inventory_quantity",
          { headers: storeHeaders }
        )
        expect(data.products).toHaveLength(1)
        expect(
          data.products[0].variants.map((v: any) => v.inventory_quantity ?? 0)
        ).toEqual([0, 0, 0])
      })

      it("sells in the default sales channel", () => {
        expect(product.sales_channels.map((c: any) => c.id)).toEqual([
          salesChannelId,
        ])
      })

      it("ships on a pallet: the Pallet product class", () => {
        expect(product.shipping_profile).toEqual(
          expect.objectContaining({ name: "Pallet product", type: "pallet" })
        )
      })

      it("sits in the existing One of a kind category, with its spelling corrected and its handle kept", () => {
        expect(product.categories).toHaveLength(1)
        expect(product.categories[0]).toEqual(
          expect.objectContaining({
            name: "One of a kind",
            handle: "on-of-kind",
          })
        )
      })
    })

    describe("the category", () => {
      it("is created when the shop has none", async () => {
        const { productId } = await addBlueCascade(getContainer())
        const product = await readProduct(productId)

        expect(product.categories).toHaveLength(1)
        expect(product.categories[0].name).toBe("One of a kind")
      })

      it("is left as it is when it is already spelled right", async () => {
        const existing = await createOneOfAKindCategory("One of a kind")
        const { productId } = await addBlueCascade(getContainer())
        const product = await readProduct(productId)

        expect(product.categories.map((c: any) => c.id)).toEqual([existing.id])
      })
    })

    describe("running it more than once", () => {
      it("leaves the product alone, with what was edited in the admin, and adds nothing", async () => {
        const first = await addBlueCascade(getContainer())
        expect(first.created).toBe(true)

        await api.post(
          `/admin/products/${first.productId}`,
          { title: "Blue Cascade XL" },
          { headers }
        )

        const second = await addBlueCascade(getContainer())

        expect(second).toEqual({ created: false, productId: first.productId })
        expect(await listProductsByHandle()).toHaveLength(1)
        expect((await readProduct(first.productId)).title).toBe(
          "Blue Cascade XL"
        )

        const profiles = (
          await api.get("/admin/shipping-profiles?name=Pallet product", {
            headers,
          })
        ).data.shipping_profiles
        expect(profiles).toHaveLength(1)
      })
    })

    describe("as a draft", () => {
      it("is not published", async () => {
        const { productId } = await addBlueCascade(getContainer(), {
          status: ProductStatus.DRAFT,
        })

        expect((await readProduct(productId)).status).toBe("draft")

        const { data } = await api.get(
          "/store/products?handle=blue-cascade",
          { headers: storeHeaders }
        )
        expect(data.products).toHaveLength(0)
      })
    })
  },
})
