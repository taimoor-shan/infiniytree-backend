import { medusaIntegrationTestRunner } from "@medusajs/test-utils"
import { Modules } from "@medusajs/framework/utils"
import {
  createRegionsWorkflow,
  createSalesChannelsWorkflow,
  linkSalesChannelsToApiKeyWorkflow,
} from "@medusajs/medusa/core-flows"
import { createAdminHeaders } from "./helpers/admin-auth"
import { createOrder } from "./helpers/orders"

jest.setTimeout(120 * 1000)

/**
 * Medusa ties a signed-out visitor's cart to the registered customer whose
 * email they type: that is how a returning customer's order lands in their
 * account without a sign-in. The visitor has proved nothing, so the cart and
 * order routes must not hand them that customer's name, phone, company, VAT
 * number or saved addresses, whatever `fields` they ask for.
 */
medusaIntegrationTestRunner({
  inApp: true,
  env: {},
  testSuite: ({ api, getContainer }) => {
    const email = "anna@olive-interiors.example"
    const password = "olive-tree-1"
    // What only the account holder should ever see
    const secrets = [
      "Geheimgasse 7",
      "Huber",
      "+43 660 1234567",
      "Olive Interiors GmbH",
      "ATU12345678",
    ]

    let storeHeaders: Record<string, string>
    let regionId: string
    let salesChannelId: string
    let customerId: string

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

      // A registered customer with a saved address, as the sign-up leaves them
      const registration = (
        await api.post("/auth/customer/emailpass/register", { email, password })
      ).data.token
      const created = await api.post(
        "/store/customers",
        {
          email,
          first_name: "Anna",
          last_name: "Huber",
          phone: "+43 660 1234567",
          company_name: "Olive Interiors GmbH",
          metadata: { vat_number: "ATU12345678" },
        },
        { headers: { ...storeHeaders, authorization: `Bearer ${registration}` } }
      )
      customerId = created.data.customer.id

      const session = (
        await api.post("/auth/customer/emailpass", { email, password })
      ).data.token
      await api.post(
        "/store/customers/me/addresses",
        {
          first_name: "Anna",
          last_name: "Huber",
          address_1: "Geheimgasse 7",
          city: "Wien",
          postal_code: "1010",
          country_code: "at",
          phone: "+43 660 1234567",
        },
        { headers: { ...storeHeaders, authorization: `Bearer ${session}` } }
      )
    })

    /** A signed-out visitor's cart, with the customer's email typed in */
    const strangersCart = async () => {
      const { data } = await api.post(
        "/store/carts",
        { region_id: regionId, sales_channel_id: salesChannelId },
        { headers: storeHeaders }
      )
      await api.post(`/store/carts/${data.cart.id}`, { email }, { headers: storeHeaders })
      return data.cart.id as string
    }

    const leaked = (body: unknown) => {
      const text = JSON.stringify(body)
      return secrets.filter((secret) => text.includes(secret))
    }

    const everything = "fields=*customer,*customer.addresses"

    it("ties a signed-out cart to the account whose email is typed", async () => {
      const cartId = await strangersCart()

      const { data } = await api.get(`/store/carts/${cartId}`, { headers: storeHeaders })

      expect(data.cart.customer_id).toBe(customerId)
      expect(data.cart.email).toBe(email)
    })

    it("does not show that account's details on the cart", async () => {
      const cartId = await strangersCart()

      const { data } = await api.get(`/store/carts/${cartId}?${everything}`, {
        headers: storeHeaders,
      })

      expect(data.cart.customer_id).toBe(customerId)
      expect(leaked(data)).toEqual([])
    })

    it("does not show them in the cart an update answers with", async () => {
      const cartId = await strangersCart()

      const { data } = await api.post(
        `/store/carts/${cartId}?${everything}`,
        { email },
        { headers: storeHeaders }
      )

      expect(data.cart.id).toBe(cartId)
      expect(leaked(data)).toEqual([])
    })

    it("does not show them on an order placed with that email", async () => {
      const order = await createOrder(getContainer(), { id: customerId, email })

      const { data } = await api.get(`/store/orders/${order.id}?${everything}`, {
        headers: storeHeaders,
      })

      expect(data.order.id).toBe(order.id)
      expect(leaked(data)).toEqual([])
    })
  },
})
