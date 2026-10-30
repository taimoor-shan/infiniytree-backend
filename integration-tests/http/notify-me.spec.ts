import { medusaIntegrationTestRunner } from "@medusajs/test-utils"
import { Modules } from "@medusajs/framework/utils"
import { createAdminHeaders } from "./helpers/admin-auth"

jest.setTimeout(120 * 1000)

// The shop is emailed through Resend; the tests look at what would be sent.
const sendMock = jest.fn()
jest.mock("resend", () => ({
  Resend: jest.fn().mockImplementation(() => ({
    emails: { send: (...args: unknown[]) => sendMock(...args) },
  })),
}))

medusaIntegrationTestRunner({
  inApp: true,
  env: {},
  testSuite: ({ api, getContainer }) => {
    let headers: Record<string, string>
    let storeHeaders: Record<string, string>
    let shippingProfileId: string

    type Created = {
      id: string
      variants: { id: string; title: string }[]
    }

    beforeEach(async () => {
      sendMock.mockReset()
      sendMock.mockResolvedValue({ data: { id: "email_1" }, error: null })
      process.env.RESEND_API_KEY = "re_test"
      delete process.env.SENDGRID_API_KEY

      const container = getContainer()
      const admin = await createAdminHeaders(container)
      headers = admin.headers

      const key = await container.resolve(Modules.API_KEY).createApiKeys({
        title: "storefront",
        type: "publishable",
        created_by: admin.user.id,
      })
      storeHeaders = { "x-publishable-api-key": key.token }

      const profile = await api.post(
        "/admin/shipping-profiles",
        { name: "Default Shipping Profile", type: "default" },
        { headers }
      )
      shippingProfileId = profile.data.shipping_profile.id
    })

    afterAll(() => {
      delete process.env.RESEND_API_KEY
    })

    // A product whose planter is out of stock in every colour.
    const createProduct = async (title: string): Promise<Created> => {
      const { data } = await api.post(
        "/admin/products",
        {
          title,
          status: "published",
          shipping_profile_id: shippingProfileId,
          options: [
            { title: "Planter", values: ["Blue", "Gold"], is_exclusive: true },
          ],
          variants: ["Blue", "Gold"].map((planter, rank) => ({
            title: planter,
            options: { Planter: planter },
            manage_inventory: true,
            allow_backorder: false,
            variant_rank: rank,
            inventory_items: [],
            prices: [],
          })),
        },
        { headers }
      )
      const { data: full } = await api.get(
        `/admin/products/${data.product.id}?fields=id,*variants`,
        { headers }
      )
      return full.product
    }

    const signUp = (body: Record<string, unknown>) =>
      api.post("/store/notify-me", body, { headers: storeHeaders })

    const failure = (promise: Promise<unknown>) =>
      promise.then(
        () => {
          throw new Error("expected the request to fail")
        },
        (error) => error.response
      )

    const list = async (query = "") =>
      (await api.get(`/admin/notify-me${query}`, { headers })).data

    describe("signing up", () => {
      it("saves the signup and lists it in the admin", async () => {
        const product = await createProduct("Blue Cascade")
        const blue = product.variants.find((v) => v.title === "Blue")!

        const response = await signUp({
          email: "Jane@Example.com",
          productId: product.id,
          variantId: blue.id,
          productUrl: "https://shop.test/en-hu/products/blue-cascade",
        })

        expect(response.status).toBe(200)
        expect(response.data).toEqual({ success: true })

        const { requests, count } = await list()

        expect(count).toBe(1)
        expect(requests[0]).toEqual(
          expect.objectContaining({
            id: expect.stringMatching(/^nmr_/),
            // Stored lower-case, so the same person is never listed twice.
            email: "jane@example.com",
            product_id: product.id,
            variant_id: blue.id,
            product_title: "Blue Cascade",
            variant_title: "Blue",
            product_url: "https://shop.test/en-hu/products/blue-cascade",
          })
        )
      })

      it("takes a signup for the product itself, with no variant", async () => {
        const product = await createProduct("Blue Cascade")

        await signUp({ email: "jane@example.com", productId: product.id })

        const { requests } = await list()

        expect(requests).toHaveLength(1)
        expect(requests[0]).toEqual(
          expect.objectContaining({
            product_id: product.id,
            variant_id: null,
            product_title: "Blue Cascade",
            variant_title: null,
          })
        )
      })

      it("takes the names from the catalog, not from the request", async () => {
        const product = await createProduct("Blue Cascade")

        await signUp({
          email: "jane@example.com",
          productId: product.id,
          productTitle: "Something else",
          variantTitle: "Something else",
        })

        const { requests } = await list()

        expect(requests[0].product_title).toBe("Blue Cascade")
        expect(requests[0].variant_title).toBeNull()
      })

      it("is one signup however often the same person asks", async () => {
        const product = await createProduct("Blue Cascade")
        const body = { email: "jane@example.com", productId: product.id }

        const first = await signUp(body)
        const again = await signUp({ ...body, email: "JANE@example.com" })

        expect(first.status).toBe(200)
        expect(again.status).toBe(200)
        expect((await list()).count).toBe(1)
      })

      it("keeps a signup per variant and for the whole product apart", async () => {
        const product = await createProduct("Blue Cascade")
        const [blue, gold] = product.variants
        const email = "jane@example.com"

        await signUp({ email, productId: product.id, variantId: blue.id })
        await signUp({ email, productId: product.id, variantId: gold.id })
        await signUp({ email, productId: product.id })
        await signUp({ email: "joe@example.com", productId: product.id })

        expect((await list()).count).toBe(4)
      })

      it("refuses a product that does not exist", async () => {
        const response = await failure(
          signUp({ email: "jane@example.com", productId: "prod_missing" })
        )

        expect(response.status).toBe(404)
        expect((await list()).count).toBe(0)
      })

      it("refuses a variant that belongs to another product", async () => {
        const product = await createProduct("Blue Cascade")
        const other = await createProduct("Red Maple")

        const response = await failure(
          signUp({
            email: "jane@example.com",
            productId: product.id,
            variantId: other.variants[0].id,
          })
        )

        expect(response.status).toBe(400)
        expect((await list()).count).toBe(0)
      })

      it("refuses an address that is not an email", async () => {
        const product = await createProduct("Blue Cascade")

        const response = await failure(
          signUp({ email: "not-an-email", productId: product.id })
        )

        expect(response.status).toBe(400)
        expect((await list()).count).toBe(0)
      })
    })

    describe("the email to the shop", () => {
      it("tells the shop about a new signup, naming the product and the person", async () => {
        const product = await createProduct("Blue Cascade")
        const gold = product.variants.find((v) => v.title === "Gold")!

        await signUp({
          email: "jane@example.com",
          productId: product.id,
          variantId: gold.id,
        })

        expect(sendMock).toHaveBeenCalledTimes(1)
        expect(sendMock).toHaveBeenCalledWith(
          expect.objectContaining({
            to: "info@infinytree.com",
            replyTo: "jane@example.com",
            subject: "Restock request: Blue Cascade — Gold",
            text: expect.stringContaining("Customer: jane@example.com"),
          })
        )
      })

      it("does not email the shop again for a repeat signup", async () => {
        const product = await createProduct("Blue Cascade")
        const body = { email: "jane@example.com", productId: product.id }

        await signUp(body)
        await signUp(body)

        expect(sendMock).toHaveBeenCalledTimes(1)
      })

      it("still saves the signup when the email is refused", async () => {
        const product = await createProduct("Blue Cascade")
        sendMock.mockResolvedValueOnce({
          data: null,
          error: { message: "domain not verified" },
        })

        const response = await signUp({
          email: "jane@example.com",
          productId: product.id,
        })

        expect(response.status).toBe(200)
        expect((await list()).count).toBe(1)
      })

      it("still saves the signup when sending the email throws", async () => {
        const product = await createProduct("Blue Cascade")
        sendMock.mockRejectedValueOnce(new Error("network down"))

        const response = await signUp({
          email: "jane@example.com",
          productId: product.id,
        })

        expect(response.status).toBe(200)
        expect((await list()).count).toBe(1)
      })

      it("still saves the signup when no email key is set", async () => {
        const product = await createProduct("Blue Cascade")
        delete process.env.RESEND_API_KEY

        const response = await signUp({
          email: "jane@example.com",
          productId: product.id,
        })

        expect(response.status).toBe(200)
        expect(sendMock).not.toHaveBeenCalled()
        expect((await list()).count).toBe(1)
      })
    })

    describe("admin list", () => {
      it("is only for signed-in admins", async () => {
        const response = await failure(api.get("/admin/notify-me"))

        expect(response.status).toBe(401)
      })

      it("searches by email or product name and filters by product", async () => {
        const cascade = await createProduct("Blue Cascade")
        const maple = await createProduct("Red Maple")

        await signUp({ email: "jane@example.com", productId: cascade.id })
        await signUp({ email: "joe@example.com", productId: cascade.id })
        await signUp({ email: "jane@example.com", productId: maple.id })

        expect((await list("?q=jane")).count).toBe(2)
        expect((await list("?q=maple")).count).toBe(1)
        expect((await list(`?product_id=${cascade.id}`)).count).toBe(2)
        expect((await list("?q=nobody")).count).toBe(0)
      })

      it("lists the newest first and pages", async () => {
        const product = await createProduct("Blue Cascade")

        for (const name of ["a", "b", "c"]) {
          await signUp({ email: `${name}@example.com`, productId: product.id })
        }

        const first = await list("?limit=2&offset=0")
        const second = await list("?limit=2&offset=2")

        expect(first.count).toBe(3)
        expect(first.requests.map((r: any) => r.email)).toEqual([
          "c@example.com",
          "b@example.com",
        ])
        expect(second.requests.map((r: any) => r.email)).toEqual([
          "a@example.com",
        ])
      })
    })

    describe("admin delete", () => {
      it("removes a signup", async () => {
        const product = await createProduct("Blue Cascade")
        await signUp({ email: "jane@example.com", productId: product.id })
        const { requests } = await list()

        const response = await api.delete(`/admin/notify-me/${requests[0].id}`, {
          headers,
        })

        expect(response.status).toBe(200)
        expect(response.data).toEqual({ id: requests[0].id })
        expect((await list()).count).toBe(0)
      })

      it("answers 404 for a signup that is already gone", async () => {
        const response = await failure(
          api.delete("/admin/notify-me/nmr_missing", { headers })
        )

        expect(response.status).toBe(404)
      })
    })
  },
})
