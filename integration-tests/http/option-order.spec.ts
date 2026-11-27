import { medusaIntegrationTestRunner } from "@medusajs/test-utils"
import { Modules, ProductStatus } from "@medusajs/framework/utils"
import {
  createProductsWorkflow,
  createSalesChannelsWorkflow,
  linkSalesChannelsToApiKeyWorkflow,
} from "@medusajs/medusa/core-flows"
import { createAdminHeaders } from "./helpers/admin-auth"
import {
  OPTION_ORDER_KEY,
  optionOrderChanges,
  sortProductOptions,
  type OrderOption,
} from "../../src/admin/lib/option-order"

jest.setTimeout(120 * 1000)

/**
 * The "Option order" box in the admin saves the order of a product's options
 * in its metadata (`option_order`) and the order of each option's values as
 * Medusa's value ranks (`POST /admin/product-options/:id` with `ranks`). The
 * storefront reads both from the product it fetches. This pins what Medusa does
 * with what the box sends, and what the storefront's request gets back.
 */
medusaIntegrationTestRunner({
  inApp: true,
  env: {},
  testSuite: ({ api, getContainer }) => {
    let headers: Record<string, string>
    let storeHeaders: Record<string, string>
    let productId: string

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

      const key = await container.resolve(Modules.API_KEY).createApiKeys({
        title: "storefront",
        type: "publishable",
        created_by: admin.user.id,
      })
      await linkSalesChannelsToApiKeyWorkflow(container).run({
        input: { id: key.id, add: [salesChannel.id] },
      })
      storeHeaders = { "x-publishable-api-key": key.token }

      const {
        result: [product],
      } = await createProductsWorkflow(container).run({
        input: {
          products: [
            {
              title: "Rose Royale",
              handle: "rose-royale",
              status: ProductStatus.PUBLISHED,
              // What the product already holds, which saving the order must not touch.
              metadata: { seo_title: "Rose Royale" },
              sales_channels: [{ id: salesChannel.id }],
              options: [
                { title: "Pot", values: ["White", "Gold", "Bronze"] },
                { title: "Plant", values: ["White", "Purple"] },
              ],
              variants: [
                {
                  title: "White / White",
                  options: { Pot: "White", Plant: "White" },
                  manage_inventory: false,
                  prices: [{ currency_code: "eur", amount: 100 }],
                },
                {
                  title: "Bronze / Purple",
                  options: { Pot: "Bronze", Plant: "Purple" },
                  manage_inventory: false,
                  prices: [{ currency_code: "eur", amount: 100 }],
                },
              ],
            },
          ],
        },
      })
      productId = product.id
    })

    /** What the box reads: the product's options with their value ranks. */
    const adminOptions = async () => {
      const { data } = await api.get(
        `/admin/products/${productId}?fields=id,metadata,*options,*options.values`,
        { headers }
      )
      return {
        metadata: data.product.metadata,
        options: data.product.options.map((option: any) => ({
          id: option.id,
          title: option.title,
          is_exclusive: option.is_exclusive,
          values: option.values.map((v: any) => ({ id: v.id, value: v.value, rank: v.rank })),
        })) as OrderOption[],
      }
    }

    /** What the box sends on Save. */
    const saveOrder = async (shown: OrderOption[]) => {
      const saved = await adminOptions()
      for (const { optionId, ranks } of optionOrderChanges(shown, saved).ranks) {
        const res = await api.post(`/admin/product-options/${optionId}`, { ranks }, { headers })
        expect(res.status).toBe(200)
      }
      const res = await api.post(
        `/admin/products/${productId}`,
        { metadata: { [OPTION_ORDER_KEY]: shown.map((o) => o.id) } },
        { headers }
      )
      expect(res.status).toBe(200)
    }

    /** The fields the storefront's `listProducts()` asks for, as far as options go. */
    const storefrontProduct = async () => {
      const { data } = await api.get(
        "/store/products?handle=rose-royale&fields=*variants.prices,+images.variants.id,+options.values.rank,+metadata,+tags,*categories",
        { headers: storeHeaders }
      )
      return data.products[0]
    }

    it("the options of a product made in the admin are its own (exclusive)", async () => {
      const { options } = await adminOptions()
      expect(options.map((o) => o.is_exclusive)).toEqual([true, true])
    })

    it("saving the order stores the option ids and ranks the values, and the storefront reads both", async () => {
      const held = await adminOptions()
      const pot = held.options.find((o) => o.title === "Pot")!
      const plant = held.options.find((o) => o.title === "Plant")!
      const byValue = (o: OrderOption, ...values: string[]) =>
        values.map((value) => o.values.find((v) => v.value === value)!)

      // Plant first; pots Bronze, White, Gold; plants Purple, White.
      const shown: OrderOption[] = [
        { ...plant, values: byValue(plant, "Purple", "White") },
        { ...pot, values: byValue(pot, "Bronze", "White", "Gold") },
      ]
      await saveOrder(shown)

      const after = await adminOptions()
      expect(after.metadata).toEqual({
        seo_title: "Rose Royale",
        option_order: [plant.id, pot.id],
      })
      // What the box opens with next time is what was saved.
      const reopened = sortProductOptions(after.options, after.metadata)
      expect(reopened.map((o) => o.title)).toEqual(["Plant", "Pot"])
      expect(reopened[1].values.map((v) => v.value)).toEqual(["Bronze", "White", "Gold"])
      expect(optionOrderChanges(reopened, after)).toEqual({ optionOrder: null, ranks: [] })

      const product = await storefrontProduct()
      expect(product.metadata.option_order).toEqual([plant.id, pot.id])
      const storePot = product.options.find((o: any) => o.id === pot.id)
      const ranks = Object.fromEntries(storePot.values.map((v: any) => [v.value, v.rank]))
      expect(ranks).toEqual({ Bronze: 1, White: 2, Gold: 3 })
      // The variants keep their values.
      expect(product.variants).toHaveLength(2)
    })

    it("ranking the values twice in a row works, and keeps the values", async () => {
      const held = await adminOptions()
      const pot = held.options.find((o) => o.title === "Pot")!
      await saveOrder([{ ...pot, values: [...pot.values].reverse() }, ...held.options.filter((o) => o !== pot)])
      const again = await adminOptions()
      const pot2 = sortProductOptions(again.options, again.metadata)[0]
      await saveOrder([{ ...pot2, values: [...pot2.values].reverse() }, ...again.options.filter((o) => o.id !== pot2.id)])

      const final = await adminOptions()
      const finalPot = sortProductOptions(final.options, final.metadata)[0]
      expect(finalPot.values.map((v) => v.id).sort()).toEqual(pot.values.map((v) => v.id).sort())
      expect(finalPot.values.map((v) => v.rank)).toEqual([1, 2, 3])
    })
  },
})
