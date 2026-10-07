import { medusaIntegrationTestRunner } from "@medusajs/test-utils"
import { MedusaContainer } from "@medusajs/framework/types"
import { Modules } from "@medusajs/framework/utils"
import {
  cancelOrderWorkflow,
  refundPaymentWorkflow,
} from "@medusajs/medusa/core-flows"
import { reconcileCommissions } from "medusa-plugin-sales-commission/jobs/reconcile-commissions"
import { applyRefundToCommission } from "medusa-plugin-sales-commission/utils/refunds"
import { createAdminHeaders } from "./helpers/admin-auth"
import { createOrder, markOrderPaid, ORDER_TOTAL, waitFor } from "./helpers/orders"

jest.setTimeout(120 * 1000)

// sv-SE formats as "YYYY-MM-DD HH:mm:ss"
const budapestClock = (date = new Date()) =>
  date.toLocaleString("sv-SE", { timeZone: "Europe/Budapest" })
const thisMonth = () => budapestClock().slice(0, 7)
const lastMonth = () => {
  const [year, month] = thisMonth().split("-").map(Number)
  return month === 1 ? `${year - 1}-12` : `${year}-${String(month - 1).padStart(2, "0")}`
}

medusaIntegrationTestRunner({
  inApp: true,
  env: {},
  testSuite: ({ api, getContainer }) => {
    let container: MedusaContainer
    let headers: Record<string, string>
    let customer: { id: string; email: string }
    let peterId: string
    let johnId: string

    const service = () => container.resolve("salesCommission")
    const entriesOf = (orderId: string) =>
      service().listCommissionEntries({ order_id: orderId }, { order: { type: "ASC" } })
    const adjustmentsOf = (repId: string) =>
      service().listCommissionAdjustments(
        { sales_rep_id: repId, kind: "partial_refund" },
        { order: { created_at: "ASC" } }
      )
    const sumOf = (rows: { amount: unknown }[]) =>
      Math.round(rows.reduce((total, row) => total + Number(row.amount), 0) * 100) / 100
    const refund = (paymentId: string, amount: number) =>
      refundPaymentWorkflow(container).run({ input: { payment_id: paymentId, amount } })
    const balanceOf = async (repId: string) =>
      (await api.get(`/admin/sales-reps/${repId}/balance`, { headers })).data.balances

    /** A paid order with a direct (Peter, 18) and a Level 2 (John, 9) entry */
    const paidOrder = async () => {
      const order = await createOrder(container, customer)
      const payment = await markOrderPaid(container, order.id)
      await waitFor(async () => (await entriesOf(order.id)).length === 2)
      return { order, payment }
    }

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

    it("takes back the refunded share of the direct and Level 2 commission", async () => {
      const { order, payment } = await paidOrder()

      await refund(payment.id, 50)

      // 50 of 241.30 is 20.7%: of the 18 direct and of the 9 Level 2
      const peters = await waitFor(async () => {
        const found = await adjustmentsOf(peterId)
        return found.length === 1 && found
      })
      const johns = await waitFor(async () => {
        const found = await adjustmentsOf(johnId)
        return found.length === 1 && found
      })
      expect(peters[0]).toEqual(
        expect.objectContaining({
          amount: -3.73,
          currency_code: "eur",
          period: thisMonth(),
          order_id: order.id,
          created_by: null,
        })
      )
      expect(peters[0].reason).toBe(
        `Partial refund of order #${order.display_id}: 20.7% refunded`
      )
      expect(johns[0].amount).toBe(-1.86)
      expect(johns[0].order_id).toBeNull()
      expect(johns[0].reason).toBe("Partial refund of a referred rep's client order: 20.7% refunded")
      expect((await entriesOf(order.id)).map((e) => e.voided_at)).toEqual([null, null])
    })

    it("shows the refund to each rep as an adjustment, naming the order only to the rep who sold it", async () => {
      const { order, payment } = await paidOrder()
      await refund(payment.id, 50)
      await waitFor(async () => (await adjustmentsOf(johnId)).length === 1)

      const peters = (
        await api.get(`/admin/sales-reps/${peterId}/statement?period=${thisMonth()}`, { headers })
      ).data
      const johns = (
        await api.get(`/admin/sales-reps/${johnId}/statement?period=${thisMonth()}`, { headers })
      ).data

      const peterLine = peters.lines.find((line: any) => line.kind === "adjustment")
      expect(peterLine.amount).toBe(-3.73)
      expect(peterLine.note).toContain(`#${order.display_id}`)
      expect(peters.totals[0].closing).toBe(14.27)
      expect(johns.totals[0].closing).toBe(7.14)
      expect(
        johns.lines.find((line: any) => line.kind === "adjustment").note
      ).not.toContain(`#${order.display_id}`)
    })

    it("adds only the difference when more is refunded later", async () => {
      const { payment } = await paidOrder()

      await refund(payment.id, 50)
      await waitFor(async () => (await adjustmentsOf(peterId)).length === 1)
      await refund(payment.id, 100)
      await waitFor(async () => (await adjustmentsOf(peterId)).length === 2)

      // 150 of 241.30 is 62.2%: 11.19 of the 18, 5.59 of the 9
      expect(sumOf(await adjustmentsOf(peterId))).toBe(-11.19)
      expect(sumOf(await adjustmentsOf(johnId))).toBe(-5.59)
    })

    it("changes nothing when run again for the same refund, even at the same moment", async () => {
      const { order, payment } = await paidOrder()
      await refund(payment.id, 50)
      await waitFor(async () => (await adjustmentsOf(peterId)).length === 1)

      await Promise.all([
        applyRefundToCommission(container, order.id),
        applyRefundToCommission(container, order.id),
        reconcileCommissions(container, { since: new Date(Date.now() - 60 * 60 * 1000) }),
      ])

      expect(await adjustmentsOf(peterId)).toHaveLength(1)
      expect(await adjustmentsOf(johnId)).toHaveLength(1)
    })

    it("doesn't double count two refunds handled at once", async () => {
      const { order, payment } = await paidOrder()
      await refund(payment.id, 40)
      await refund(payment.id, 60)
      await waitFor(async () => sumOf(await adjustmentsOf(peterId)) === -7.46)

      await Promise.all([
        applyRefundToCommission(container, order.id),
        applyRefundToCommission(container, order.id),
        applyRefundToCommission(container, order.id),
      ])

      // 100 of 241.30 is 41.4%, whatever order the events arrived in
      expect(sumOf(await adjustmentsOf(peterId))).toBe(-7.46)
      expect(sumOf(await adjustmentsOf(johnId))).toBe(-3.73)
    })

    it("voids the commission when the rest is refunded, and gives back what the part refund took", async () => {
      const { order, payment } = await paidOrder()
      await refund(payment.id, 50)
      await waitFor(async () => (await adjustmentsOf(peterId)).length === 1)

      await refund(payment.id, ORDER_TOTAL - 50)

      await waitFor(async () => (await entriesOf(order.id)).every((e) => e.voided_at))
      const peters = await waitFor(async () => {
        const found = await adjustmentsOf(peterId)
        return found.length === 2 && found
      })
      expect(peters.map((a) => a.amount)).toEqual([-3.73, 3.73])
      expect(peters[1].reason).toContain("refunded in full")
      expect(sumOf(await adjustmentsOf(johnId))).toBe(0)
      // The entries were earned and voided in the same month, so nothing is left
      expect((await balanceOf(peterId)).map((b: any) => b.earned)).toEqual([0])
      expect((await balanceOf(johnId)).map((b: any) => b.earned)).toEqual([0])
    })

    it("gives back a part refund's share when the order is canceled after it", async () => {
      const { order, payment } = await paidOrder()
      await refund(payment.id, 50)
      await waitFor(async () => (await adjustmentsOf(peterId)).length === 1)

      await cancelOrderWorkflow(container).run({ input: { order_id: order.id } })

      await waitFor(async () => (await entriesOf(order.id)).every((e) => e.voided_at))
      const peters = await waitFor(async () => {
        const found = await adjustmentsOf(peterId)
        return found.length === 2 && found
      })
      expect(peters[1].reason).toContain("canceled")
      expect(sumOf(peters)).toBe(0)
    })

    it("takes back from the current month, leaving an approved month as it was", async () => {
      const { order, payment } = await paidOrder()
      const previous = lastMonth()
      for (const entry of await entriesOf(order.id)) {
        await service().updateCommissionEntries({ id: entry.id, period: previous })
      }
      await api.post("/admin/sales-commission/periods", { through: previous }, { headers })
      const before = (
        await api.get(`/admin/sales-reps/${peterId}/statement?period=${previous}`, { headers })
      ).data

      await refund(payment.id, 50)
      const [adjustment] = await waitFor(async () => {
        const found = await adjustmentsOf(peterId)
        return found.length === 1 && found
      })

      expect(adjustment.period).toBe(thisMonth())
      const after = (
        await api.get(`/admin/sales-reps/${peterId}/statement?period=${previous}`, { headers })
      ).data
      expect(after.lines).toEqual(before.lines)
      expect(after.totals).toEqual(before.totals)
      // It still counts against what the rep is owed
      const balance = (await balanceOf(peterId))[0]
      expect(balance.earned).toBe(14.27)
      expect(balance.payable).toBe(18)
    })

    it("takes back in the currency the rep is paid in, at the rate it was earned at", async () => {
      await api.post(`/admin/sales-reps/${peterId}`, { payout_currency_code: "huf" }, { headers })
      await api.post(
        "/admin/sales-commission/fx-rates",
        { rate_date: budapestClock().slice(0, 10), rate: 400 },
        { headers }
      )
      const { payment } = await paidOrder()

      await refund(payment.id, ORDER_TOTAL / 2)

      const [adjustment] = await waitFor(async () => {
        const found = await adjustmentsOf(peterId)
        return found.length === 1 && found
      })
      // Half of 18 EUR, which was 7200 HUF
      expect(adjustment.amount).toBe(-3600)
      expect(adjustment.currency_code).toBe("huf")
      expect((await balanceOf(peterId)).map((b: any) => [b.currency_code, b.earned])).toEqual([
        ["huf", 3600],
      ])
    })

    it("leaves orders without a rep alone", async () => {
      const other = await container.resolve(Modules.CUSTOMER).createCustomers({
        email: "other@example.com",
        company_name: "Nobody's Client Kft.",
      })
      const order = await createOrder(container, other)
      const payment = await markOrderPaid(container, order.id)

      await refund(payment.id, 50)
      const result = await applyRefundToCommission(container, order.id)

      expect(result).toEqual({ voided: 0, reversed: 0 })
      expect(await service().listCommissionAdjustments({})).toEqual([])
    })

    it("reconciles a refund whose event never arrived", async () => {
      const { payment } = await paidOrder()
      // Module-level refund emits no payment.refunded event
      await container.resolve(Modules.PAYMENT).refundPayment({
        payment_id: payment.id,
        amount: 50,
      })
      expect(await adjustmentsOf(peterId)).toEqual([])

      const result = await reconcileCommissions(container, {
        since: new Date(Date.now() - 60 * 60 * 1000),
      })

      expect(result.reversed).toBe(1)
      expect(sumOf(await adjustmentsOf(peterId))).toBe(-3.73)
    })
  },
})
