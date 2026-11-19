import { medusaIntegrationTestRunner } from "@medusajs/test-utils"
import { Modules } from "@medusajs/framework/utils"
import { createAdminHeaders } from "./helpers/admin-auth"
import { INITIAL_RATE_TABLES } from "../../src/modules/shipping-rates/lib/initial-rates"
import { deliveryPriceRange } from "../../src/modules/shipping-rates/lib/rates"
import { NEWSLETTER_MODULE } from "../../src/modules/newsletter"

jest.setTimeout(120 * 1000)

// What would be emailed is read from this mock.
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
      process.env.CONTACT_EMAIL = "shop@infinytree.test"
      delete process.env.SENDGRID_API_KEY
      delete process.env.TURNSTILE_SECRET_KEY

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

    describe("GET /store/delivery-estimate", () => {
      it("gives the cheapest and dearest zone of the product's class", async () => {
        const profile = await api.post(
          "/admin/shipping-profiles",
          { name: "Pallet products", type: "pallet" },
          { headers }
        )
        const table = INITIAL_RATE_TABLES.find(
          (t) => t.shipping_class === "pallet" && t.country_code === "at"
        )!
        await api.post("/admin/shipping-rates/tables", table, { headers })
        const { data } = await api.post(
          "/admin/products",
          {
            title: "Red Maple",
            status: "published",
            shipping_profile_id: profile.data.shipping_profile.id,
            options: [{ title: "Default", values: ["Default"] }],
            variants: [{ title: "Default", options: { Default: "Default" }, prices: [] }],
          },
          { headers }
        )

        const expected = deliveryPriceRange(table, 1)!
        const at = await api.get(
          `/store/delivery-estimate?product_id=${data.product.id}&country_code=AT&currency_code=eur`,
          { headers: storeHeaders }
        )
        expect(at.status).toBe(200)
        expect(at.data.estimate).toMatchObject({
          shipping_class: "pallet",
          country_code: "at",
          min: expected.min,
          max: expected.max,
          tax_inclusive: false,
        })

        // No rates for Germany were entered: nothing to say, still a 200.
        const de = await api.get(
          `/store/delivery-estimate?product_id=${data.product.id}&country_code=de`,
          { headers: storeHeaders }
        )
        expect(de.data.estimate).toBeNull()
      })
    })

    describe("POST /store/withdrawals", () => {
      it("saves a declaration, links the matching order and emails a receipt", async () => {
        const order = await getContainer()
          .resolve(Modules.ORDER)
          .createOrders({
            email: "Anna@Example.com",
            currency_code: "eur",
            items: [{ title: "Red Maple", quantity: 1, unit_price: 3250 }],
          })

        const response = await api.post(
          "/store/withdrawals",
          {
            name: "Anna Muster",
            email: "anna@example.com",
            order_number: `#${order.display_id}`,
            locale: "de-AT",
          },
          { headers: storeHeaders }
        )
        expect(response.status).toBe(200)
        expect(response.data.withdrawal.received_at).toBeTruthy()

        const list = await api.get("/admin/withdrawals", { headers })
        expect(list.data.withdrawals[0]).toMatchObject({
          name: "Anna Muster",
          order_id: order.id,
          order_display_id: order.display_id,
          status: "new",
        })

        const recipients = sendMock.mock.calls.map(([m]) => m.to)
        expect(recipients).toEqual(["anna@example.com", "shop@infinytree.test"])
        expect(sendMock.mock.calls[0][0].text).toContain("Eingegangen am")

        const handled = await api.post(
          `/admin/withdrawals/${list.data.withdrawals[0].id}`,
          { status: "handled" },
          { headers }
        )
        expect(handled.data.withdrawal.status).toBe("handled")
      })

      it("keeps a declaration whose order and email do not match, unlinked", async () => {
        await api.post(
          "/store/withdrawals",
          { name: "Someone", email: "x@example.com", order_number: "999999" },
          { headers: storeHeaders }
        )
        const list = await api.get("/admin/withdrawals", { headers })
        expect(list.data.withdrawals[0].order_id).toBeNull()
        expect(sendMock.mock.calls[1][0].subject).toContain("not matched")
      })

      it("refuses a declaration without a name", async () => {
        const error = await api
          .post(
            "/store/withdrawals",
            { name: "", email: "x@example.com", order_number: "1" },
            { headers: storeHeaders }
          )
          .catch((e) => e)
        expect(error.response.status).toBe(400)
      })
    })

    describe("newsletter double opt-in", () => {
      it("signs up as pending, confirms from the link and unsubscribes", async () => {
        await api.post(
          "/store/newsletter",
          { email: " Anna@Example.com ", locale: "de-DE" },
          { headers: storeHeaders }
        )
        expect(sendMock).toHaveBeenCalledTimes(1)
        const mail = sendMock.mock.calls[0][0]
        expect(mail.to).toBe("anna@example.com")
        const token = decodeURIComponent(mail.text.match(/token=([^\s]+)/)[1])

        let list = await api.get("/admin/newsletter", { headers })
        expect(list.data.subscribers[0]).toMatchObject({
          email: "anna@example.com",
          status: "pending",
        })

        const confirmed = await api.post(
          "/store/newsletter/status",
          { action: "confirm", token },
          { headers: storeHeaders }
        )
        expect(confirmed.data.found).toBe(true)
        // A used link finds nothing the second time.
        const again = await api.post(
          "/store/newsletter/status",
          { action: "confirm", token },
          { headers: storeHeaders }
        )
        expect(again.data.found).toBe(false)

        // Signing up again when confirmed sends nothing.
        await api.post(
          "/store/newsletter",
          { email: "anna@example.com" },
          { headers: storeHeaders }
        )
        expect(sendMock).toHaveBeenCalledTimes(1)

        const csv = await api.get("/admin/newsletter?format=csv", { headers })
        expect(csv.data).toContain('"anna@example.com","de-DE"')

        const [subscriber] = await getContainer()
          .resolve(NEWSLETTER_MODULE)
          .listNewsletterSubscribers({ email: "anna@example.com" })
        await api.post(
          "/store/newsletter/status",
          { action: "unsubscribe", token: subscriber.unsubscribe_token },
          { headers: storeHeaders }
        )
        list = await api.get("/admin/newsletter", { headers })
        expect(list.data.subscribers[0].status).toBe("unsubscribed")
      })
    })
  },
})
