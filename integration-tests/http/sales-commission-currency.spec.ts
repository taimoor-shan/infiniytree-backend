import { medusaIntegrationTestRunner } from "@medusajs/test-utils"
import { MedusaContainer } from "@medusajs/framework/types"
import { Modules } from "@medusajs/framework/utils"
import { reconcileCommissions } from "medusa-plugin-sales-commission/jobs/reconcile-commissions"
import { createAdminHeaders } from "./helpers/admin-auth"
import { createOrder, markOrderPaid, waitFor } from "./helpers/orders"

jest.setTimeout(120 * 1000)

// sv-SE formats dates as YYYY-MM-DD
const budapestDate = (date = new Date()) =>
  date.toLocaleString("sv-SE", { timeZone: "Europe/Budapest" }).slice(0, 10)

const nextMonth = (period: string) => {
  const [year, month] = period.split("-").map(Number)
  return new Date(Date.UTC(year, month, 1)).toISOString().slice(0, 7)
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

    const entriesOf = (orderId: string) =>
      container
        .resolve("salesCommission")
        .listCommissionEntries({ order_id: orderId }, { order: { type: "ASC" } })

    const addRate = (rate: number, rate_date = budapestDate()) =>
      api.post("/admin/sales-commission/fx-rates", { rate_date, rate }, { headers })
    const failure = (promise: Promise<unknown>) =>
      promise.then(
        () => {
          throw new Error("expected the request to fail")
        },
        (e) => e.response
      )
    const setPayoutCurrency = (repId: string, payout_currency_code: string | null) =>
      api.post(`/admin/sales-reps/${repId}`, { payout_currency_code }, { headers })
    const currentPeriod = async () =>
      (await api.get("/admin/sales-commission/periods", { headers })).data.current_period

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

    describe("a rep paid in forint", () => {
      beforeEach(async () => {
        await setPayoutCurrency(peterId, "huf")
        await addRate(400)
      })

      it("converts the commission once, at the day's rate, and stores the rate", async () => {
        const order = await createOrder(container, customer)
        await markOrderPaid(container, order.id)

        const [direct] = await waitFor(async () => {
          const found = await entriesOf(order.id)
          return found.length === 2 && found
        })

        expect(direct).toEqual(
          expect.objectContaining({
            sales_rep_id: peterId,
            currency_code: "eur",
            amount: 18,
            settlement_currency_code: "huf",
            settlement_amount: 7200,
            fx_rate: 400,
            fx_rate_date: budapestDate(),
            fx_source: "manual",
          })
        )
      })

      it("shows the statement in forint with what the order paid and the rate", async () => {
        const order = await createOrder(container, customer)
        await markOrderPaid(container, order.id)
        await waitFor(async () => (await entriesOf(order.id)).length === 2)

        const { data } = await api.get(
          `/admin/sales-reps/${peterId}/statement?period=${await currentPeriod()}`,
          { headers }
        )

        expect(data.lines).toEqual([
          expect.objectContaining({
            kind: "direct",
            currency_code: "huf",
            amount: 7200,
            base_amount: 72000,
            order_currency_code: "eur",
            order_amount: 18,
            order_base_amount: 180,
            fx_rate: 400,
            balance: 7200,
          }),
        ])
        expect(data.totals).toEqual([
          expect.objectContaining({
            currency_code: "huf",
            turnover: 72000,
            direct: 7200,
            closing: 7200,
          }),
        ])
      })

      it("gives the rep one balance, in forint", async () => {
        const order = await createOrder(container, customer)
        await markOrderPaid(container, order.id)
        await waitFor(async () => (await entriesOf(order.id)).length === 2)

        const { data } = await api.get(`/admin/sales-reps/${peterId}/balance`, { headers })

        expect(data.balances.map((b) => [b.currency_code, b.earned])).toEqual([["huf", 7200]])
      })

      it("takes a reversal back at the rate the commission was earned at", async () => {
        const order = await createOrder(container, customer)
        await markOrderPaid(container, order.id)
        const [direct] = await waitFor(async () => {
          const found = await entriesOf(order.id)
          return found.length === 2 && found
        })

        // The rate moves; what was earned doesn't
        await addRate(500, budapestDate(new Date(Date.now() + 86_400_000)))
        const voidPeriod = nextMonth(await currentPeriod())
        await container.resolve("salesCommission").updateCommissionEntries({
          id: direct.id,
          voided_at: new Date(),
          void_period: voidPeriod,
          void_reason: "order_refunded",
        })

        const { data } = await api.get(
          `/admin/sales-reps/${peterId}/statement?period=${voidPeriod}`,
          { headers }
        )

        expect(data.lines).toEqual([
          expect.objectContaining({
            kind: "reversal",
            currency_code: "huf",
            amount: -7200,
            fx_rate: 400,
          }),
        ])
        expect(data.totals[0]).toEqual(
          expect.objectContaining({ opening: 7200, total: -7200, closing: 0 })
        )
      })

      it("is paid and adjusted in forint only", async () => {
        const payout = await failure(
          api.post(
            `/admin/sales-reps/${peterId}/payouts`,
            { currency_code: "eur", amount: 10, paid_at: "2026-01-15" },
            { headers }
          )
        )
        const adjustment = await failure(
          api.post(
            `/admin/sales-reps/${peterId}/adjustments`,
            { currency_code: "eur", amount: 10, period: await currentPeriod(), reason: "Fix" },
            { headers }
          )
        )

        expect([payout.status, adjustment.status]).toEqual([400, 400])
        expect(payout.data.message).toContain("is paid in HUF")
      })
    })

    it("keeps the order's currency for a rep without a payout currency", async () => {
      await addRate(400)
      const order = await createOrder(container, customer)
      await markOrderPaid(container, order.id)

      const [direct] = await waitFor(async () => {
        const found = await entriesOf(order.id)
        return found.length === 2 && found
      })

      expect(direct).toEqual(
        expect.objectContaining({
          settlement_currency_code: "eur",
          settlement_amount: 18,
          fx_rate: null,
          fx_source: null,
        })
      )
    })

    it("converts Level 2 into the referrer's own payout currency", async () => {
      await setPayoutCurrency(johnId, "huf")
      await addRate(400)
      const order = await createOrder(container, customer)
      await markOrderPaid(container, order.id)

      const entries = await waitFor(async () => {
        const found = await entriesOf(order.id)
        return found.length === 2 && found
      })

      expect(
        entries.map((e) => [e.type, e.settlement_currency_code, e.settlement_amount])
      ).toEqual([
        ["direct", "eur", 18],
        ["level2", "huf", 3600],
      ])
    })

    it("uses the last published rate on a day without one", async () => {
      await setPayoutCurrency(peterId, "huf")
      await addRate(395, budapestDate(new Date(Date.now() - 2 * 86_400_000)))
      const order = await createOrder(container, customer)
      await markOrderPaid(container, order.id)

      const [direct] = await waitFor(async () => {
        const found = await entriesOf(order.id)
        return found.length === 2 && found
      })

      expect(direct).toEqual(
        expect.objectContaining({
          fx_rate: 395,
          fx_rate_date: budapestDate(new Date(Date.now() - 2 * 86_400_000)),
          settlement_amount: 7110,
        })
      )
    })

    it("records nothing without a rate, and records it once one is added", async () => {
      await setPayoutCurrency(peterId, "huf")
      const order = await createOrder(container, customer)
      await markOrderPaid(container, order.id)
      await new Promise((resolve) => setTimeout(resolve, 1500))

      expect(await entriesOf(order.id)).toEqual([])

      await addRate(400)
      await reconcileCommissions(container, { since: new Date(Date.now() - 86_400_000) })

      const entries = await entriesOf(order.id)
      expect(entries.map((e) => [e.type, e.sales_rep_id, e.amount])).toEqual([
        ["direct", peterId, 18],
        ["level2", johnId, 9],
      ])
      expect(entries[0].settlement_amount).toBe(7200)
    })

    describe("exchange rates", () => {
      it("lists the latest rates, newest first, and says whether the ECB is fetched", async () => {
        await addRate(395, "2026-09-01")
        await addRate(400, "2026-09-02")

        const { data } = await api.get("/admin/sales-commission/fx-rates", { headers })

        expect(data.auto_fetch).toBe(false)
        expect(data.rates).toEqual([
          { rate_date: "2026-09-02", rate: 400, source: "manual" },
          { rate_date: "2026-09-01", rate: 395, source: "manual" },
        ])
      })

      it("won't change a day that has a rate", async () => {
        await addRate(395, "2026-09-01")

        const response = await failure(addRate(401, "2026-09-01"))

        expect(response.status).toBe(400)
        expect(response.data.message).toContain("already exists")
      })

      it("rejects a rate that isn't above zero or a malformed day", async () => {
        const zero = await failure(addRate(0))
        const day = await failure(addRate(400, "1 September"))

        expect([zero.status, day.status]).toEqual([400, 400])
      })
    })

    describe("choosing the currency", () => {
      it("accepts euro or forint, in any case, and rejects others", async () => {
        const upper = await setPayoutCurrency(peterId, "HUF")
        const other = await failure(setPayoutCurrency(peterId, "usd"))

        expect(upper.data.sales_rep.payout_currency_code).toBe("huf")
        expect(other.status).toBe(400)
      })

      it("can go back to paying each currency as earned", async () => {
        await setPayoutCurrency(peterId, "huf")

        const { data } = await setPayoutCurrency(peterId, null)

        expect(data.sales_rep.payout_currency_code).toBeNull()
      })

      it("is set when a rep is created", async () => {
        const { data } = await api.post(
          "/admin/sales-reps",
          { name: "Eva Toth", email: "eva@example.com", payout_currency_code: "huf" },
          { headers }
        )

        expect(data.sales_rep.payout_currency_code).toBe("huf")
      })
    })
  },
})
