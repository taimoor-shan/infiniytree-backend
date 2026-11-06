import { medusaIntegrationTestRunner } from "@medusajs/test-utils"
import { Modules } from "@medusajs/framework/utils"
import {
  createRegionsWorkflow,
  createSalesChannelsWorkflow,
  linkSalesChannelsToApiKeyWorkflow,
} from "@medusajs/medusa/core-flows"
import { createAdminHeaders } from "./helpers/admin-auth"

jest.setTimeout(120 * 1000)

/**
 * The checkout recognises a returning customer by email: it asks whether the
 * email has an account (so it can leave out the password fields), and puts a
 * signed-out visitor's cart on that account before the order is placed, so the
 * order lands in their history and their sales rep is credited.
 */
medusaIntegrationTestRunner({
  inApp: true,
  env: {},
  testSuite: ({ api, getContainer }) => {
    const password = "olive-tree-1"
    let storeHeaders: Record<string, string>
    let regionId: string
    let salesChannelId: string
    // Each test asks from its own address, so the limit of one can't reach another
    let visitor = 0
    const asVisitor = (headers: Record<string, string> = {}) => {
      visitor += 1
      return { ...storeHeaders, "x-forwarded-for": `198.51.100.${visitor}`, ...headers }
    }

    beforeEach(async () => {
      const container = getContainer()
      const admin = await createAdminHeaders(container)

      const {
        result: [salesChannel],
      } = await createSalesChannelsWorkflow(container).run({
        input: { salesChannelsData: [{ name: "Webshop" }] },
      })
      salesChannelId = salesChannel.id

      const {
        result: [region],
      } = await createRegionsWorkflow(container).run({
        input: {
          regions: [{ name: "Austria", currency_code: "eur", countries: ["at"] }],
        },
      })
      regionId = region.id

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

    /** An account, made the way the storefront's sign-up makes one */
    const signUp = async (email: string) => {
      const registration = (
        await api.post("/auth/customer/emailpass/register", { email, password })
      ).data.token
      const { data } = await api.post(
        "/store/customers",
        { email, first_name: "Anna", last_name: "Huber" },
        { headers: { ...storeHeaders, authorization: `Bearer ${registration}` } }
      )
      return data.customer.id as string
    }

    const signIn = async (email: string) =>
      (await api.post("/auth/customer/emailpass", { email, password })).data.token as string

    const newCart = async (headers = storeHeaders) =>
      (
        await api.post(
          "/store/carts",
          { region_id: regionId, sales_channel_id: salesChannelId },
          { headers }
        )
      ).data.cart.id as string

    const typeEmail = (cartId: string, email: string, headers = storeHeaders) =>
      api.post(`/store/carts/${cartId}`, { email }, { headers })

    const ownerOf = async (cartId: string) =>
      (await api.get(`/store/carts/${cartId}`, { headers: storeHeaders })).data.cart
        .customer_id as string

    const accountStatus = (email: string, headers = asVisitor()) =>
      api
        .post("/store/checkout/account-status", { email }, { headers })
        .catch((e) => e.response)

    const attach = (cartId: string, headers = storeHeaders) =>
      api
        .post(`/store/carts/${cartId}/attach-account`, {}, { headers })
        .catch((e) => e.response)

    describe("POST /store/checkout/account-status", () => {
      it("says an email has an account, whatever its capitals and spaces", async () => {
        await signUp("anna@olive-interiors.example")

        const res = await accountStatus("  Anna@Olive-Interiors.example ")

        expect(res.status).toBe(200)
        expect(res.data).toEqual({ has_account: true })
      })

      it("says an email with only a guest record, or none, has no account", async () => {
        await getContainer()
          .resolve(Modules.CUSTOMER)
          .createCustomers({ email: "guest@olive-interiors.example" })

        expect((await accountStatus("guest@olive-interiors.example")).data).toEqual({
          has_account: false,
        })
        expect((await accountStatus("nobody@olive-interiors.example")).data).toEqual({
          has_account: false,
        })
      })

      it("refuses something that is not an email", async () => {
        expect((await accountStatus("not-an-email")).status).toBe(400)
      })

      it("turns a visitor away after 20 checks in ten minutes, and only them", async () => {
        const one = asVisitor()
        for (let i = 0; i < 20; i++) {
          expect((await accountStatus(`n${i}@example.com`, one)).status).toBe(200)
        }

        expect((await accountStatus("n21@example.com", one)).status).toBe(429)
        expect((await accountStatus("n21@example.com", asVisitor())).status).toBe(200)
      })
    })

    describe("POST /store/carts/:id/attach-account", () => {
      it("moves a signed-out cart onto the account when Medusa left it on a guest", async () => {
        const annaId = await signUp("anna@olive-interiors.example")
        const cartId = await newCart()
        // A first, mistyped email gives the cart a guest record, and Medusa then
        // makes a second guest for the corrected one instead of using the account
        await typeEmail(cartId, "ana@olive-interiors.example")
        await typeEmail(cartId, "anna@olive-interiors.example")
        expect(await ownerOf(cartId)).not.toBe(annaId)

        const res = await attach(cartId)

        expect(res.status).toBe(200)
        expect(await ownerOf(cartId)).toBe(annaId)
      })

      it("moves it off another account whose email was typed first", async () => {
        const annaId = await signUp("anna@olive-interiors.example")
        const bertId = await signUp("bert@olive-interiors.example")
        const cartId = await newCart()
        await typeEmail(cartId, "bert@olive-interiors.example")
        await typeEmail(cartId, "anna@olive-interiors.example")
        expect(await ownerOf(cartId)).toBe(bertId)

        await attach(cartId)

        expect(await ownerOf(cartId)).toBe(annaId)
      })

      it("leaves a cart whose email has no account where it is", async () => {
        const cartId = await newCart()
        await typeEmail(cartId, "newcomer@olive-interiors.example")
        const guestId = await ownerOf(cartId)

        await attach(cartId)

        expect(await ownerOf(cartId)).toBe(guestId)
      })

      it("never moves a signed-in customer's cart", async () => {
        await signUp("anna@olive-interiors.example")
        const bertId = await signUp("bert@olive-interiors.example")
        const bert = {
          ...storeHeaders,
          authorization: `Bearer ${await signIn("bert@olive-interiors.example")}`,
        }
        const cartId = await newCart(bert)
        await typeEmail(cartId, "anna@olive-interiors.example", bert)

        await attach(cartId, bert)

        expect(await ownerOf(cartId)).toBe(bertId)
      })

      it("answers 404 for a cart that does not exist", async () => {
        expect((await attach("cart_does_not_exist")).status).toBe(404)
      })
    })
  },
})
