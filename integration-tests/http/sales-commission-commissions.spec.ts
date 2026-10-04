import { medusaIntegrationTestRunner } from "@medusajs/test-utils"
import { MedusaContainer } from "@medusajs/framework/types"
import { Modules } from "@medusajs/framework/utils"
import {
  cancelOrderWorkflow,
  refundPaymentWorkflow,
} from "@medusajs/medusa/core-flows"
import { reconcileCommissions } from "medusa-plugin-sales-commission/jobs/reconcile-commissions"
import {
  recordOrderCommissionWorkflow,
  voidOrderCommissionWorkflow,
} from "medusa-plugin-sales-commission/workflows"
import { createAdminHeaders } from "./helpers/admin-auth"
import {
  createOrder,
  createPaymentCollection,
  markOrderPaid,
  ORDER_TOTAL,
  waitFor,
} from "./helpers/orders"

jest.setTimeout(120 * 1000)

// Independent of the plugin's own helper: sv-SE formats dates as YYYY-MM-DD
const budapestMonth = (date: Date | string) =>
  new Date(date).toLocaleString("sv-SE", { timeZone: "Europe/Budapest" }).slice(0, 7)

medusaIntegrationTestRunner({
  inApp: true,
  env: {},
  testSuite: ({ api, getContainer }) => {
    let container: MedusaContainer
    let headers: Record<string, string>
    let customer: { id: string; email: string }
    let peterId: string
    let johnId: string

    const entriesOf = (orderId: string) =>
      container.resolve("salesCommission").listCommissionEntries(
        { order_id: orderId },
        { order: { type: "ASC" } }
      )

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

    it("records direct and Level 2 commission when the order is paid", async () => {
      const order = await createOrder(container, customer)
      const payment = await markOrderPaid(container, order.id)

      const entries = await waitFor(async () => {
        const found = await entriesOf(order.id)
        return found.length === 2 && found
      })
      const { captured_at } = await container
        .resolve(Modules.PAYMENT)
        .retrievePayment(payment.id, { select: ["captured_at"] })

      expect(entries).toEqual([
        expect.objectContaining({
          type: "direct",
          sales_rep_id: peterId,
          customer_id: customer.id,
          client_name: "Green Office Kft.",
          currency_code: "eur",
          base_amount: 180,
          rate: 10,
          amount: 18,
          payment_id: payment.id,
          earned_at: new Date(captured_at!),
          period: budapestMonth(captured_at!),
          voided_at: null,
        }),
        expect.objectContaining({
          type: "level2",
          sales_rep_id: johnId,
          source_sales_rep_id: peterId,
          base_amount: 180,
          rate: 5,
          amount: 9,
        }),
      ])
    })

    it("counts an order placed earlier on the day the client was assigned", async () => {
      const buyer = await container.resolve(Modules.CUSTOMER).createCustomers({
        email: "late-assign@greenoffice.example",
        company_name: "Late Assign Kft.",
      })
      const order = await createOrder(container, buyer)
      await api.post(
        `/admin/customers/${buyer.id}/sales-rep-assignment`,
        { sales_rep_id: peterId, commission_rate: 10 },
        { headers }
      )
      await markOrderPaid(container, order.id)

      const entries = await waitFor(async () => {
        const found = await entriesOf(order.id)
        return found.length === 2 && found
      })

      expect(entries.map((e) => [e.type, e.sales_rep_id, e.amount])).toEqual([
        ["direct", peterId, 18],
        ["level2", johnId, 9],
      ])
    })

    it("counts Level 2 for an order placed earlier on the day the referral was set", async () => {
      const createRep = async (name: string, email: string) =>
        (await api.post("/admin/sales-reps", { name, email }, { headers })).data
          .sales_rep.id
      const annaId = await createRep("Anna Kiss", "anna@example.com")
      const gaborId = await createRep("Gabor Toth", "gabor@example.com")
      const buyer = await container.resolve(Modules.CUSTOMER).createCustomers({
        email: "late-referral@greenoffice.example",
        company_name: "Late Referral Kft.",
      })
      const order = await createOrder(container, buyer)
      await api.post(
        `/admin/customers/${buyer.id}/sales-rep-assignment`,
        { sales_rep_id: gaborId, commission_rate: 10 },
        { headers }
      )
      await api.post(
        `/admin/sales-reps/${gaborId}/referral`,
        { referrer_sales_rep_id: annaId, level2_rate: 5 },
        { headers }
      )
      await markOrderPaid(container, order.id)

      const entries = await waitFor(async () => {
        const found = await entriesOf(order.id)
        return found.length === 2 && found
      })

      expect(entries.map((e) => [e.type, e.sales_rep_id])).toEqual([
        ["direct", gaborId],
        ["level2", annaId],
      ])
    })

    it("records an order only once", async () => {
      const order = await createOrder(container, customer)
      await markOrderPaid(container, order.id)
      await waitFor(async () => (await entriesOf(order.id)).length === 2)

      await recordOrderCommissionWorkflow(container).run({
        input: { order_id: order.id },
      })

      expect(await entriesOf(order.id)).toHaveLength(2)
    })

    it("records nothing before the payment is captured", async () => {
      const order = await createOrder(container, customer)
      await createPaymentCollection(container, order.id)

      await recordOrderCommissionWorkflow(container).run({
        input: { order_id: order.id },
      })

      expect(await entriesOf(order.id)).toEqual([])
    })

    it("ignores orders from customers without a rep", async () => {
      const other = await container.resolve(Modules.CUSTOMER).createCustomers({
        email: "other@example.com",
      })
      const order = await createOrder(container, other)
      await markOrderPaid(container, order.id)

      await recordOrderCommissionWorkflow(container).run({
        input: { order_id: order.id },
      })

      expect(await entriesOf(order.id)).toEqual([])
    })

    it("voids the commission when a paid order is canceled", async () => {
      const order = await createOrder(container, customer)
      await markOrderPaid(container, order.id)
      await waitFor(async () => (await entriesOf(order.id)).length === 2)

      await cancelOrderWorkflow(container).run({ input: { order_id: order.id } })

      const entries = await waitFor(async () => {
        const found = await entriesOf(order.id)
        return found.every((e) => e.voided_at) && found
      })
      expect(entries.map((e) => [e.void_reason, e.void_period])).toEqual([
        ["order_canceled", budapestMonth(new Date())],
        ["order_canceled", budapestMonth(new Date())],
      ])
    })

    it("voids the commission when the order is fully refunded", async () => {
      const order = await createOrder(container, customer)
      const payment = await markOrderPaid(container, order.id)
      await waitFor(async () => (await entriesOf(order.id)).length === 2)

      await refundPaymentWorkflow(container).run({
        input: { payment_id: payment.id, amount: ORDER_TOTAL },
      })

      const entries = await waitFor(async () => {
        const found = await entriesOf(order.id)
        return found.every((e) => e.voided_at) && found
      })
      expect(entries.map((e) => e.void_reason)).toEqual([
        "order_refunded",
        "order_refunded",
      ])
    })

    it("keeps the commission on a partial refund", async () => {
      const order = await createOrder(container, customer)
      const payment = await markOrderPaid(container, order.id)
      await waitFor(async () => (await entriesOf(order.id)).length === 2)

      await refundPaymentWorkflow(container).run({
        input: { payment_id: payment.id, amount: 50 },
      })
      await voidOrderCommissionWorkflow(container).run({
        input: { order_id: order.id, reason: "order_refunded" },
      })

      expect((await entriesOf(order.id)).map((e) => e.voided_at)).toEqual([
        null,
        null,
      ])
    })

    it("reconciles a captured payment whose event never arrived", async () => {
      const order = await createOrder(container, customer)
      const collection = await createPaymentCollection(container, order.id)
      const paymentModule = container.resolve(Modules.PAYMENT)
      const session = await paymentModule.createPaymentSession(collection.id, {
        provider_id: "pp_system_default",
        currency_code: "eur",
        amount: ORDER_TOTAL,
        data: {},
      })
      const payment = await paymentModule.authorizePaymentSession(session.id, {})
      // Module-level capture emits no payment.captured event
      await paymentModule.capturePayment({ payment_id: payment!.id })
      expect(await entriesOf(order.id)).toEqual([])

      const result = await reconcileCommissions(container, {
        since: new Date(Date.now() - 60 * 60 * 1000),
      })

      expect(result.recorded).toBeGreaterThanOrEqual(1)
      expect(await entriesOf(order.id)).toHaveLength(2)
    })

    it("reconciles a cancellation whose event never arrived", async () => {
      const order = await createOrder(container, customer)
      await markOrderPaid(container, order.id)
      await waitFor(async () => (await entriesOf(order.id)).length === 2)
      await container.resolve(Modules.ORDER).updateOrders(order.id, {
        status: "canceled",
        canceled_at: new Date(),
      })

      await reconcileCommissions(container, {
        since: new Date(Date.now() - 60 * 60 * 1000),
      })

      expect((await entriesOf(order.id)).map((e) => e.void_reason)).toEqual([
        "order_canceled",
        "order_canceled",
      ])
    })
  },
})
