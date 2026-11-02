import { medusaIntegrationTestRunner } from "@medusajs/test-utils"
import {
  ContainerRegistrationKeys,
  Modules,
  ProductStatus,
} from "@medusajs/framework/utils"
import {
  createInventoryLevelsWorkflow,
  createPriceListsWorkflow,
  createProductCategoriesWorkflow,
  createProductsWorkflow,
  createRegionsWorkflow,
  createSalesChannelsWorkflow,
  createShippingProfilesWorkflow,
  createStockLocationsWorkflow,
} from "@medusajs/medusa/core-flows"
import { createAdminHeaders } from "./helpers/admin-auth"

jest.setTimeout(180 * 1000)

const FRONT = "https://shop.test/static/front.jpg"
const SIDE = "https://shop.test/static/side.jpg"
const GOLD = "https://shop.test/static/gold.jpg"

const PRODUCT_FIELDS = [
  "id",
  "title",
  "handle",
  "status",
  "subtitle",
  "description",
  "thumbnail",
  "weight",
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
  "images.variants.id",
  "options.id",
  "options.title",
  "options.values.id",
  "options.values.value",
  "variants.id",
  "variants.title",
  "variants.sku",
  "variants.barcode",
  "variants.ean",
  "variants.allow_backorder",
  "variants.manage_inventory",
  "variants.thumbnail",
  "variants.metadata",
  "variants.variant_rank",
  "variants.options.value",
  "variants.options.option.title",
  "variants.images.id",
  "variants.images.url",
  "variants.inventory_items.inventory_item_id",
  "variants.price_set.prices.currency_code",
  "variants.price_set.prices.amount",
  "variants.price_set.prices.price_rules.attribute",
  "variants.price_set.prices.price_rules.value",
]

/**
 * The "Duplicate" button on the product page makes a draft copy of a product
 * under a new title. This is the contract behind it: what the copy keeps, what
 * it starts without, and that the original is left as it was.
 */
medusaIntegrationTestRunner({
  inApp: true,
  env: {},
  testSuite: ({ api, getContainer }) => {
    let headers: Record<string, string>
    let regionId: string
    let salesChannelId: string
    let shippingProfileId: string
    let categoryId: string
    let collectionId: string
    let typeId: string
    let tagIds: string[]
    let locationId: string
    let priceListId: string
    let source: any

    const query = () => getContainer().resolve(ContainerRegistrationKeys.QUERY)

    const readProduct = async (id: string): Promise<any> =>
      (
        await query().graph({
          entity: "product",
          fields: PRODUCT_FIELDS,
          filters: { id },
        })
      ).data[0]

    const variantNamed = (product: any, title: string) =>
      product.variants.find((variant: any) => variant.title === title)

    /** The variants as [title, rank], in the order they are shown in. */
    const ranks = (product: any) =>
      [...product.variants]
        .sort((a: any, b: any) => a.variant_rank - b.variant_rank)
        .map((variant: any) => [variant.title, variant.variant_rank])

    /**
     * The prices of a variant, as plain text that is easy to compare. The
     * pricing module gives a variant's own prices here, never a price list's.
     */
    const priceSummary = (variant: any) =>
      variant.price_set.prices
        .map(
          (price: any) =>
            `${price.currency_code} ${Number(price.amount)}` +
            (price.price_rules?.length
              ? ` ${price.price_rules
                  .map((rule: any) => `${rule.attribute}=${rule.value}`)
                  .join(",")}`
              : "")
        )
        .sort()

    /** Each picture that is tied to a variant, as "address -> variant title". */
    const ties = (product: any) =>
      product.images
        .flatMap((image: any) =>
          (image.variants ?? []).map(
            (tied: any) =>
              `${image.url} -> ${
                product.variants.find((variant: any) => variant.id === tied.id)
                  .title
              }`
          )
        )
        .sort()

    /** The pictures a variant shows: its own, and those tied to no variant. */
    const shown = (variant: any) =>
      variant.images.map((image: any) => image.url).sort()

    /** The amounts of every price that belongs to the sale price list. */
    const salePrices = async () =>
      (
        await getContainer()
          .resolve(Modules.PRICING)
          .listPrices({ price_list_id: [priceListId] }, { take: null })
      )
        .map((price) => Number(price.amount))
        .sort()

    const duplicate = (body: Record<string, unknown>, id = source.id) =>
      api.post(`/admin/products/${id}/duplicate`, body, { headers })

    const failure = (promise: Promise<unknown>) =>
      promise.then(
        () => {
          throw new Error("expected the request to fail")
        },
        (error) => error.response
      )

    const duplicateAs = async (title = "Blue Cascade II") =>
      readProduct((await duplicate({ title })).data.product.id)

    beforeEach(async () => {
      const container = getContainer()
      const admin = await createAdminHeaders(container)
      headers = admin.headers

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
        result: [region],
      } = await createRegionsWorkflow(container).run({
        input: {
          regions: [{ name: "Europe", currency_code: "eur", countries: ["at"] }],
        },
      })
      regionId = region.id

      const {
        result: [profile],
      } = await createShippingProfilesWorkflow(container).run({
        input: { data: [{ name: "Pallet products", type: "pallet" }] },
      })
      shippingProfileId = profile.id

      const {
        result: [category],
      } = await createProductCategoriesWorkflow(container).run({
        input: {
          product_categories: [
            { name: "One of a kind", handle: "one-of-a-kind", is_active: true },
          ],
        },
      })
      categoryId = category.id

      const products = container.resolve(Modules.PRODUCT)
      const [type] = await products.createProductTypes([{ value: "Arrangement" }])
      const [collection] = await products.createProductCollections([
        { title: "Signature" },
      ])
      const tags = await products.createProductTags([
        { value: "blue" },
        { value: "large" },
      ])
      typeId = type.id
      collectionId = collection.id
      tagIds = tags.map((tag) => tag.id)

      const {
        result: [location],
      } = await createStockLocationsWorkflow(container).run({
        input: { locations: [{ name: "Warehouse" }] },
      })
      locationId = location.id

      const {
        result: [created],
      } = await createProductsWorkflow(container).run({
        input: {
          products: [
            {
              title: "Blue Cascade",
              handle: "blue-cascade",
              subtitle: "One of a kind",
              description: "A dramatic floral arrangement.",
              status: ProductStatus.PUBLISHED,
              thumbnail: FRONT,
              weight: 12,
              material: "Polyester",
              metadata: {
                short_description: "Rich blue tones.",
                seo_title: "Blue Cascade | InfinYtree",
                video_url: "/static/blue-cascade.mp4",
              },
              type_id: typeId,
              collection_id: collectionId,
              tag_ids: tagIds,
              category_ids: [categoryId],
              sales_channels: [{ id: salesChannelId }],
              shipping_profile_id: shippingProfileId,
              images: [{ url: FRONT }, { url: SIDE }, { url: GOLD }],
              options: [{ title: "Planter", values: ["Blue", "Gold"] }],
              variants: [
                {
                  title: "Blue",
                  sku: "BC-BLUE",
                  barcode: "0123456789",
                  ean: "4000000000000",
                  options: { Planter: "Blue" },
                  manage_inventory: true,
                  allow_backorder: false,
                  metadata: { note: "first" },
                  prices: [
                    { currency_code: "eur", amount: 3250 },
                    // The price the region shows, as the admin saves it.
                    {
                      currency_code: "eur",
                      amount: 3250,
                      rules: { region_id: regionId },
                    } as any,
                  ],
                },
                {
                  title: "Gold",
                  sku: "BC-GOLD",
                  options: { Planter: "Gold" },
                  manage_inventory: true,
                  allow_backorder: true,
                  // Without a price a variant reads "Price on request".
                  prices: [],
                },
              ],
            },
          ],
        },
      })

      source = await readProduct(created.id)
      const blue = variantNamed(source, "Blue")
      const gold = variantNamed(source, "Gold")

      // A sale: a price of a price list, which a copy must not inherit.
      const {
        result: [priceList],
      } = await createPriceListsWorkflow(container).run({
        input: {
          price_lists_data: [
            {
              title: "Sale",
              description: "Sale",
              type: "sale",
              status: "active",
              prices: [
                { variant_id: blue.id, currency_code: "eur", amount: 2990 },
              ],
            } as any,
          ],
        } as any,
      })
      priceListId = priceList.id

      // The gold variant shows its own picture, as the admin sets it.
      const goldImage = source.images.find((image: any) => image.url === GOLD)
      await products.addImageToVariant([
        { image_id: goldImage.id, variant_id: gold.id },
      ])
      await products.updateProductVariants(gold.id, { thumbnail: GOLD })

      // The order the variants are shown in, as set by hand in the admin.
      await products.updateProductVariants(blue.id, { variant_rank: 0 } as any)
      await products.updateProductVariants(gold.id, { variant_rank: 1 } as any)

      // Stock the original has, which the copy must not share.
      await createInventoryLevelsWorkflow(container).run({
        input: {
          inventory_levels: [
            {
              inventory_item_id: blue.inventory_items[0].inventory_item_id,
              location_id: locationId,
              stocked_quantity: 7,
            },
          ],
        },
      })

      // The German of the product, as the Translate Product button or the
      // translation script saves it.
      await container.resolve(Modules.TRANSLATION).createTranslations([
        {
          reference: "product",
          reference_id: source.id,
          locale_code: "de-DE",
          translations: {
            title: "Kunstblumen-Arrangement Blue Cascade",
            subtitle: "Einzigartig",
            description: "Ein dramatisches Blumenarrangement.",
          },
        },
        {
          reference: "product",
          reference_id: source.id,
          locale_code: "hu-HU",
          translations: { title: "Blue Cascade (magyar)" },
        },
        {
          reference: "product_option",
          reference_id: source.options[0].id,
          locale_code: "de-DE",
          translations: { title: "Pflanzgefäß" },
        },
        {
          reference: "product_option_value",
          reference_id: source.options[0].values.find(
            (value: any) => value.value === "Gold"
          ).id,
          locale_code: "de-DE",
          translations: { value: "Gold" },
        },
        {
          reference: "product_variant",
          reference_id: gold.id,
          locale_code: "de-DE",
          translations: { title: "Gold (Pflanzgefäß)" },
        },
      ])

      // The original as it now is, with everything set above.
      source = await readProduct(created.id)
    })

    describe("the new product", () => {
      it("is a draft under the new title, with a handle made from it", async () => {
        const response = await duplicate({ title: "Blue Cascade II" })

        expect(response.status).toBe(200)
        expect(response.data.product).toEqual({
          id: expect.stringMatching(/^prod_/),
          title: "Blue Cascade II",
          handle: "blue-cascade-ii",
          status: "draft",
        })
        expect(response.data.product.id).not.toBe(source.id)

        const copy = await readProduct(response.data.product.id)
        expect(copy).toEqual(
          expect.objectContaining({
            title: "Blue Cascade II",
            handle: "blue-cascade-ii",
            status: "draft",
          })
        )
      })

      it("takes the next free handle when the title has been used", async () => {
        await duplicate({ title: "Blue Cascade II" })
        const second = await duplicate({ title: "Blue Cascade II" })
        const third = await duplicate({ title: "Blue Cascade II" })

        expect(second.data.product.handle).toBe("blue-cascade-ii-2")
        expect(third.data.product.handle).toBe("blue-cascade-ii-3")
      })

      it("keeps the texts, measurements and metadata", async () => {
        const copy = await duplicateAs()

        expect(copy).toEqual(
          expect.objectContaining({
            subtitle: "One of a kind",
            description: "A dramatic floral arrangement.",
            thumbnail: FRONT,
            weight: 12,
            material: "Polyester",
            metadata: {
              short_description: "Rich blue tones.",
              seo_title: "Blue Cascade | InfinYtree",
              video_url: "/static/blue-cascade.mp4",
            },
          })
        )
      })

      it("is in the same type, collection, categories, tags, sales channel and shipping class", async () => {
        const copy = await duplicateAs()

        expect(copy.type_id).toBe(typeId)
        expect(copy.collection_id).toBe(collectionId)
        expect(copy.categories.map((c: any) => c.id)).toEqual([categoryId])
        expect(copy.tags.map((t: any) => t.id).sort()).toEqual([...tagIds].sort())
        expect(copy.sales_channels.map((c: any) => c.id)).toEqual([
          salesChannelId,
        ])
        expect(copy.shipping_profile.id).toBe(shippingProfileId)
      })

      it("has the same pictures in the same order", async () => {
        const copy = await duplicateAs()

        expect(
          [...copy.images]
            .sort((a: any, b: any) => a.rank - b.rank)
            .map((image: any) => image.url)
        ).toEqual([FRONT, SIDE, GOLD])
        // Its own picture records: deleting one product's picture leaves the other's.
        const sourceImageIds = source.images.map((image: any) => image.id)
        for (const image of copy.images) {
          expect(sourceImageIds).not.toContain(image.id)
        }
      })

      it("has the same options and variants, each on the same choices", async () => {
        const copy = await duplicateAs()

        expect(copy.options.map((o: any) => o.title)).toEqual(["Planter"])
        expect(
          copy.options[0].values.map((v: any) => v.value).sort()
        ).toEqual(["Blue", "Gold"])

        const blue = variantNamed(copy, "Blue")
        const gold = variantNamed(copy, "Gold")
        expect(blue.options.map((o: any) => `${o.option.title}=${o.value}`)).toEqual(
          ["Planter=Blue"]
        )
        expect(gold.options.map((o: any) => `${o.option.title}=${o.value}`)).toEqual(
          ["Planter=Gold"]
        )
        expect(blue).toEqual(
          expect.objectContaining({
            manage_inventory: true,
            allow_backorder: false,
            metadata: { note: "first" },
          })
        )
        expect(gold.allow_backorder).toBe(true)
        // The same order. The query does not promise one; the rank does, and
        // the copy has the original's ranks.
        expect(ranks(copy)).toEqual([["Blue", 0], ["Gold", 1]])
        expect(ranks(copy)).toEqual(ranks(source))
      })

      it("starts without the SKU, barcode and EAN, which only one variant can have", async () => {
        const copy = await duplicateAs()

        for (const variant of copy.variants) {
          expect(variant.sku).toBeNull()
          expect(variant.barcode).toBeNull()
          expect(variant.ean).toBeNull()
        }
        // The original keeps them.
        expect(variantNamed(await readProduct(source.id), "Blue").sku).toBe(
          "BC-BLUE"
        )
      })

      it("keeps the prices, including the region's, but not the sale price of a price list", async () => {
        const copy = await duplicateAs()

        expect(priceSummary(variantNamed(copy, "Blue"))).toEqual([
          "eur 3250",
          `eur 3250 region_id=${regionId}`,
        ])
        // No price stays "Price on request".
        expect(priceSummary(variantNamed(copy, "Gold"))).toEqual([])

        // The sale price list still holds the original's one price, and the
        // copy has none of it.
        expect(await salePrices()).toEqual([2990])
      })

      it("ties the same pictures to the same variants and gives each variant its thumbnail", async () => {
        const copy = await duplicateAs()

        // Only the gold picture is tied to a variant. The other two are tied
        // to none, which makes every variant show them: they must stay that
        // way, not be tied to each variant one by one.
        expect(ties(copy)).toEqual([`${GOLD} -> Gold`])
        expect(ties(copy)).toEqual(ties(await readProduct(source.id)))

        expect(shown(variantNamed(copy, "Gold"))).toEqual([FRONT, GOLD, SIDE])
        expect(shown(variantNamed(copy, "Blue"))).toEqual([FRONT, SIDE])

        expect(variantNamed(copy, "Gold").thumbnail).toBe(GOLD)
        expect(variantNamed(copy, "Blue").thumbnail).toBeNull()
      })

      it("has stock of its own: none, whatever the original has", async () => {
        const copy = await duplicateAs()
        const container = getContainer()

        const sourceItems = source.variants.map(
          (variant: any) => variant.inventory_items[0].inventory_item_id
        )
        const copyItems = copy.variants.map(
          (variant: any) => variant.inventory_items[0].inventory_item_id
        )
        for (const item of copyItems) {
          expect(sourceItems).not.toContain(item)
        }

        const inventory = container.resolve(Modules.INVENTORY)
        expect(
          await inventory.listInventoryLevels({ inventory_item_id: copyItems })
        ).toEqual([])
        const original = await inventory.listInventoryLevels({
          inventory_item_id: sourceItems,
        })
        expect(original.map((level) => Number(level.stocked_quantity))).toEqual([7])
      })

      it("has the original's translations, except the product's own title", async () => {
        const copy = await duplicateAs()
        const translations = getContainer().resolve(Modules.TRANSLATION)

        const copyGold = copy.options[0].values.find(
          (value: any) => value.value === "Gold"
        )
        const rows = await translations.listTranslations(
          {
            reference_id: [
              copy.id,
              copy.options[0].id,
              copyGold.id,
              variantNamed(copy, "Gold").id,
            ],
          },
          { take: null }
        )

        const summary = rows
          .map((row) => ({
            reference: row.reference,
            reference_id: row.reference_id,
            locale_code: row.locale_code,
            translations: row.translations,
          }))
          .sort((a, b) => a.reference.localeCompare(b.reference))

        expect(summary).toEqual([
          {
            reference: "product",
            reference_id: copy.id,
            locale_code: "de-DE",
            // The German title names the original, so it is left for the copy's own.
            translations: {
              subtitle: "Einzigartig",
              description: "Ein dramatisches Blumenarrangement.",
            },
          },
          {
            reference: "product_option",
            reference_id: copy.options[0].id,
            locale_code: "de-DE",
            translations: { title: "Pflanzgefäß" },
          },
          {
            reference: "product_option_value",
            reference_id: copyGold.id,
            locale_code: "de-DE",
            translations: { value: "Gold" },
          },
          {
            reference: "product_variant",
            reference_id: variantNamed(copy, "Gold").id,
            locale_code: "de-DE",
            translations: { title: "Gold (Pflanzgefäß)" },
          },
        ])

        // The original keeps all of its own.
        const original = await translations.listTranslations(
          { reference: "product", reference_id: source.id },
          { take: null }
        )
        expect(original).toHaveLength(2)
      })
    })

    describe("the original", () => {
      it("is left exactly as it was", async () => {
        const before = await readProduct(source.id)

        await duplicate({ title: "Blue Cascade II" })

        expect(await readProduct(source.id)).toEqual(before)
      })
    })

    describe("a copy that cannot be finished", () => {
      it("leaves no half-made product behind and does not touch the original", async () => {
        // The one thing that has to be faked: the translation module failing
        // after the product, its variants and its pictures have been saved.
        const translations = getContainer().resolve(Modules.TRANSLATION)
        const failing = jest
          .spyOn(translations, "createTranslations")
          .mockRejectedValueOnce(new Error("The translation module is down"))
        const before = await readProduct(source.id)

        const response = await failure(duplicate({ title: "Blue Cascade II" }))
        failing.mockRestore()

        expect(response.status).toBe(500)
        const { data } = await api.get("/admin/products?limit=50", { headers })
        expect(data.products.map((product: any) => product.handle)).toEqual([
          "blue-cascade",
        ])
        expect(await readProduct(source.id)).toEqual(before)

        // And the same title can be tried again.
        const retry = await duplicate({ title: "Blue Cascade II" })
        expect(retry.data.product.handle).toBe("blue-cascade-ii")
      })
    })

    describe("a request that cannot be served", () => {
      it("is refused with a message for a product that does not exist", async () => {
        const response = await failure(
          duplicate({ title: "Blue Cascade II" }, "prod_does_not_exist")
        )

        expect(response.status).toBe(404)
        expect(response.data.message).toMatch(
          /Product with id: prod_does_not_exist was not found/
        )
      })

      it("is refused for someone who is not logged in to the admin", async () => {
        const response = await failure(
          api.post(`/admin/products/${source.id}/duplicate`, {
            title: "Blue Cascade II",
          })
        )

        expect(response.status).toBe(401)
        const { data } = await api.get("/admin/products?limit=50", { headers })
        expect(data.products).toHaveLength(1)
      })

      it("is refused without a title", async () => {
        for (const body of [{}, { title: "" }, { title: "   " }]) {
          const response = await failure(duplicate(body))

          expect(response.status).toBe(400)
        }

        // Nothing was made.
        const { data } = await api.get("/admin/products?limit=50", { headers })
        expect(data.products.map((product: any) => product.handle)).toEqual([
          "blue-cascade",
        ])
      })
    })
  },
})
