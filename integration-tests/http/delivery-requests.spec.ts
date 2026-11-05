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
    })

    afterAll(() => {
      delete process.env.RESEND_API_KEY
    })

    const createCart = async (items: { title: string; quantity: number; unit_price: number }[]) => {
      const cart = await getContainer()
        .resolve(Modules.CART)
        .createCarts({ currency_code: "eur", items })
      return cart.id
    }

    const body = (cartId: string, extra: Record<string, unknown> = {}) => ({
      cart_id: cartId,
      email: "Anna@Example.gr",
      first_name: "Anna",
      last_name: "Papadopoulou",
      company: "Olive Interiors",
      phone: "+30 210 1234567",
      address_1: "Ermou 10",
      postal_code: "10563",
      city: "Athens",
      country_code: "GR",
      message: "Third floor, no lift.",
      locale: "en",
      ...extra,
    })

    it("saves the cart, address and contact and emails the shop", async () => {
      const cartId = await createCart([
        { title: "Cherry Blossom", quantity: 2, unit_price: 1250 },
      ])

      const res = await api.post("/store/delivery-requests", body(cartId), {
        headers: storeHeaders,
      })
      expect(res.status).toBe(200)
      expect(res.data.id).toMatch(/^dreq_/)

      const { data } = await api.get("/admin/delivery-requests", { headers })
      expect(data.count).toBe(1)
      const [saved] = data.requests
      expect(saved).toMatchObject({
        status: "new",
        email: "anna@example.gr",
        country_code: "gr",
        city: "Athens",
        currency_code: "eur",
        item_subtotal: 2500,
        message: "Third floor, no lift.",
      })
      expect(saved.items).toEqual([
        expect.objectContaining({ title: "Cherry Blossom", quantity: 2, unit_price: 1250 }),
      ])

      expect(sendMock).toHaveBeenCalledTimes(1)
      const email = sendMock.mock.calls[0][0]
      expect(email.replyTo).toBe("anna@example.gr")
      expect(email.subject).toBe("Delivery quote request: Greece — Olive Interiors")
      expect(email.text).toContain("2 × Cherry Blossom")
    })

    it("updates the same cart's request when it is sent again", async () => {
      const cartId = await createCart([
        { title: "Bonsai", quantity: 1, unit_price: 900 },
      ])
      await api.post("/store/delivery-requests", body(cartId), { headers: storeHeaders })
      await api.post(
        "/store/delivery-requests",
        body(cartId, { city: "Thessaloniki", postal_code: "54624" }),
        { headers: storeHeaders }
      )

      const { data } = await api.get("/admin/delivery-requests", { headers })
      expect(data.count).toBe(1)
      expect(data.requests[0].city).toBe("Thessaloniki")
      expect(sendMock).toHaveBeenCalledTimes(2)
      expect(sendMock.mock.calls[1][0].subject).toMatch(/^Updated delivery/)
    })

    it("refuses an empty or unknown cart and a bad body", async () => {
      const empty = await createCart([])
      const emptyRes = await api
        .post("/store/delivery-requests", body(empty), { headers: storeHeaders })
        .catch((e) => e.response)
      expect(emptyRes.status).toBe(400)

      const unknown = await api
        .post("/store/delivery-requests", body("cart_nope"), { headers: storeHeaders })
        .catch((e) => e.response)
      expect(unknown.status).toBe(404)

      const bad = await api
        .post(
          "/store/delivery-requests",
          body(empty, { email: "not-an-email", country_code: "Greece" }),
          { headers: storeHeaders }
        )
        .catch((e) => e.response)
      expect(bad.status).toBe(400)
      expect(sendMock).not.toHaveBeenCalled()
    })

    it("saves the request even when the email fails", async () => {
      sendMock.mockRejectedValue(new Error("network down"))
      const cartId = await createCart([{ title: "Maple", quantity: 1, unit_price: 700 }])
      const res = await api.post("/store/delivery-requests", body(cartId), {
        headers: storeHeaders,
      })
      expect(res.status).toBe(200)
    })

    it("marks a request handled, searches and deletes", async () => {
      const cartId = await createCart([{ title: "Orchid", quantity: 3, unit_price: 100 }])
      const { data: created } = await api.post("/store/delivery-requests", body(cartId), {
        headers: storeHeaders,
      })

      const { data: updated } = await api.post(
        `/admin/delivery-requests/${created.id}`,
        { status: "handled" },
        { headers }
      )
      expect(updated.request.status).toBe("handled")

      const found = await api.get("/admin/delivery-requests?q=athens", { headers })
      expect(found.data.count).toBe(1)
      const none = await api.get("/admin/delivery-requests?q=madrid", { headers })
      expect(none.data.count).toBe(0)

      await api.delete(`/admin/delivery-requests/${created.id}`, { headers })
      const after = await api.get("/admin/delivery-requests", { headers })
      expect(after.data.count).toBe(0)

      const again = await api
        .delete(`/admin/delivery-requests/${created.id}`, { headers })
        .catch((e) => e.response)
      expect(again.status).toBe(404)
    })
  },
})
