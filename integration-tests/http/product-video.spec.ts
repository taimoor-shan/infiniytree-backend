import { medusaIntegrationTestRunner } from "@medusajs/test-utils"
import { Modules, ProductStatus } from "@medusajs/framework/utils"
import {
  createProductsWorkflow,
  createSalesChannelsWorkflow,
  linkSalesChannelsToApiKeyWorkflow,
} from "@medusajs/medusa/core-flows"
import { createAdminHeaders } from "./helpers/admin-auth"
import { readProductVideo, videoMetadata } from "../../src/admin/lib/product-video"

jest.setTimeout(120 * 1000)

const SEO_TITLE = "Blue Cascade | One-of-a-Kind Artificial Floral Arrangement"
const VIDEO = "/static/1730000000000-blue-cascade.mp4"
const STILL = "/static/1730000000001-blue-cascade-still.jpg"

/**
 * The "Product video" box in the admin saves the video in the product's
 * metadata with the ordinary product update, and the storefront reads it back
 * from the product it fetches. This is the contract in between: what Medusa
 * does with the metadata the box sends, and what the storefront's request gets.
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
              title: "Blue Cascade",
              handle: "blue-cascade",
              status: ProductStatus.PUBLISHED,
              // What the product already holds, which saving a video must not touch.
              metadata: { seo_title: SEO_TITLE, short_description: "One of a kind." },
              sales_channels: [{ id: salesChannel.id }],
              options: [{ title: "Planter", values: ["Blue"] }],
              variants: [
                {
                  title: "Blue",
                  options: { Planter: "Blue" },
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

    const save = (form: Parameters<typeof videoMetadata>[0]) =>
      api.post(
        `/admin/products/${productId}`,
        { metadata: videoMetadata(form) },
        { headers }
      )

    const adminMetadata = async () =>
      (
        await api.get(`/admin/products/${productId}?fields=id,+metadata`, {
          headers,
        })
      ).data.product.metadata

    const storefrontMetadata = async () => {
      const { data } = await api.get(
        "/store/products?handle=blue-cascade&fields=id,handle,+metadata",
        { headers: storeHeaders }
      )
      return data.products[0]?.metadata
    }

    it("a product starts without a video", async () => {
      expect(readProductVideo(await adminMetadata())).toEqual({
        video: "",
        poster: "",
      })
    })

    it("saving a video adds its two keys and leaves the rest of the metadata alone", async () => {
      const response = await save({ video: VIDEO, poster: STILL })
      expect(response.status).toBe(200)

      expect(await adminMetadata()).toEqual({
        seo_title: SEO_TITLE,
        short_description: "One of a kind.",
        video_url: VIDEO,
        video_poster: STILL,
      })
    })

    it("the storefront's product request returns them", async () => {
      await save({ video: VIDEO, poster: STILL })

      expect(readProductVideo(await storefrontMetadata())).toEqual({
        video: VIDEO,
        poster: STILL,
      })
    })

    it("a video without a still image saves no still image", async () => {
      await save({ video: VIDEO, poster: "" })

      const metadata = await adminMetadata()
      expect(metadata.video_url).toBe(VIDEO)
      expect(metadata).not.toHaveProperty("video_poster")
    })

    it("replacing the video keeps the still image until it is changed too", async () => {
      await save({ video: VIDEO, poster: STILL })
      await save({ video: "/static/1730000000002-new.mp4", poster: STILL })

      expect(readProductVideo(await adminMetadata())).toEqual({
        video: "/static/1730000000002-new.mp4",
        poster: STILL,
      })
    })

    it("taking the still image away keeps the video", async () => {
      await save({ video: VIDEO, poster: STILL })
      await save({ video: VIDEO, poster: "" })

      const metadata = await adminMetadata()
      expect(metadata.video_url).toBe(VIDEO)
      expect(metadata).not.toHaveProperty("video_poster")
    })

    it("taking the video away removes both keys and nothing else", async () => {
      await save({ video: VIDEO, poster: STILL })
      // The still image is still in the form when the video is cleared; the box
      // sends it blank too, because alone it does nothing.
      const response = await save({ video: "", poster: STILL })
      expect(response.status).toBe(200)

      const metadata = await adminMetadata()
      expect(metadata).toEqual({
        seo_title: SEO_TITLE,
        short_description: "One of a kind.",
      })
      expect(await storefrontMetadata()).toEqual(metadata)
    })

    it("saving a product without a video does not add keys", async () => {
      await save({ video: "", poster: "" })

      expect(await adminMetadata()).toEqual({
        seo_title: SEO_TITLE,
        short_description: "One of a kind.",
      })
    })
  },
})
