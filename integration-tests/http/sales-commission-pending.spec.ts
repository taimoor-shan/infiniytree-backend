import { medusaIntegrationTestRunner } from "@medusajs/test-utils"
import { MedusaContainer } from "@medusajs/framework/types"
import { Modules } from "@medusajs/framework/utils"
import { cancelOrderWorkflow } from "@medusajs/medusa/core-flows"
import { createAdminHeaders } from "./helpers/admin-auth"
import {
  createOrder,
  createPaymentCollection,
  markOrderPaid,
  waitFor,
} from "./helpers/orders"

jest.setTimeout(120 * 1000)

const budapestDate = () =>
  new Date().toLocaleString("sv-SE", { timeZone: "Europe/Budapest" }).slice(0, 10)

medusaIntegrationTestRunner({
  inApp: true,
  env: {},
  testSuite: ({ api, getContainer }) => {
    let container: MedusaContainer
    let headers: Record<string, string>
    let customer: { id: string; email: string }
    let peterId: string
    let johnId: string

    const pendingOf = async (repId: string) =>
      (await api.get(`/admin/sales-reps/${repId}/balance`, { headers })).data.pending

    beforeEach(async () => {
      container = getContainer()
      ;({ headers } = await createAdminHeaders(container))

      customer = await container.resolve(Modules.CUSTOMER).createCustomers({
        email: "buyer@greenoffice.example",
        company_name: "Green Office Kft.",
      })
      const createRep = async (name: string, email: string) =>
        (await api.post("/admin/sales-reps", { name, email }, { headers })).data
          .sales_rep.id
      peterId = await createRep("Peter Nagy", "peter@example.com")
      johnId = await createRep("John Smith", "john@example.com")

      await api.post(
        `/admin/sales-reps/${peterId}/referral`,
        { referrer_sales_rep_id: johnId, level2_rate: 5 },
        { headers }
      )
      await api.post(
        `/admin/customers/${customer.id}/sales-rep-assignment`,
        { sales_rep_id: peterId, commission_rate: 10 },
        { headers }
      )
    })

    it("shows what an unpaid order would earn, for the rep and the referrer", async () => {
      const order = await createOrder(container, customer)
      await createPaymentCollection(container, order.id)

      expect(await pendingOf(peterId)).toEqual([
        { currency_code: "eur", amount: 18, orders: 1 },
      ])
      expect(await pendingOf(johnId)).toEqual([
        { currency_code: "eur", amount: 9, orders: 1 },
      ])
    })

    it("counts an order that has no payment yet", async () => {
      await createOrder(container, customer)

      expect(await pendingOf(peterId)).toEqual([
        { currency_code: "eur", amount: 18, orders: 1 },
      ])
    })

    it("adds up several unpaid orders", async () => {
      await createOrder(container, customer)
      await createOrder(container, customer)

      expect(await pendingOf(peterId)).toEqual([
        { currency_code: "eur", amount: 36, orders: 2 },
      ])
    })

    it("stops expecting an order once it is paid", async () => {
      const order = await createOrder(container, customer)
      await markOrderPaid(container, order.id)
      await waitFor(async () => {
        const entries = await container
          .resolve("salesCommission")
          .listCommissionEntries({ order_id: order.id })
        return entries.length === 2
      })

      expect(await pendingOf(peterId)).toEqual([])
    })

    it("does not expect a canceled order", async () => {
      const order = await createOrder(container, customer)
      await cancelOrderWorkflow(container).run({ input: { order_id: order.id } })

      expect(await pendingOf(peterId)).toEqual([])
    })

    it("does not expect an order from a client nobody is assigned to", async () => {
      const stranger = await container.resolve(Modules.CUSTOMER).createCustomers({
        email: "stranger@example.com",
        company_name: "Stranger Kft.",
      })
      await createOrder(container, stranger)

      expect(await pendingOf(peterId)).toEqual([])
    })

    it("shows the expected amount in the rep's payout currency at the latest rate", async () => {
      await api.post(`/admin/sales-reps/${peterId}`, { payout_currency_code: "huf" }, { headers })
      await api.post(
        "/admin/sales-commission/fx-rates",
        { rate_date: budapestDate(), rate: 400 },
        { headers }
      )
      await createOrder(container, customer)

      expect(await pendingOf(peterId)).toEqual([
        { currency_code: "huf", amount: 7200, orders: 1 },
      ])
    })

    it("leaves every rep with nothing expected when no order is unpaid", async () => {
      expect(await pendingOf(peterId)).toEqual([])
      expect(await pendingOf(johnId)).toEqual([])
    })
  },
})
