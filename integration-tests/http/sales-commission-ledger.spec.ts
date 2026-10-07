import { medusaIntegrationTestRunner } from "@medusajs/test-utils"
import { MedusaContainer } from "@medusajs/framework/types"
import { createAdminHeaders } from "./helpers/admin-auth"

jest.setTimeout(120 * 1000)

// Months well in the past, so they are finished whatever day the tests run
const NOV = "2025-11"
const DEC = "2025-12"

medusaIntegrationTestRunner({
  inApp: true,
  env: {},
  testSuite: ({ api, getContainer }) => {
    let container: MedusaContainer
    let headers: Record<string, string>
    let peterId: string
    let annaId: string
    let orderNumber = 0

    const service = () => container.resolve("salesCommission") as any

    /** What a commission earned in `period` looks like, as if a paid order had been recorded then. */
    const draft = (
      repId: string,
      period: string,
      amount: number,
      currency = "eur"
    ) => {
      orderNumber += 1
      return {
        sales_rep_id: repId,
        type: "direct",
        order_id: `order_ledger_${orderNumber}`,
        order_display_id: orderNumber,
        order_created_at: new Date(`${period}-10T09:00:00Z`),
        customer_id: "cus_ledger",
        client_name: "Green Office Kft.",
        source_sales_rep_id: null,
        client_assignment_id: "sca_ledger",
        rep_referral_id: null,
        currency_code: currency,
        base_amount: amount * 10,
        rate: 10,
        amount,
        settlement_currency_code: currency,
        settlement_amount: amount,
        earned_at: new Date(`${period}-15T10:00:00Z`),
        period,
      }
    }
    const earn = (repId: string, period: string, amount: number, currency = "eur") =>
      service().createCommissionEntries(draft(repId, period, amount, currency))

    const createRep = async (name: string, email: string, extra = {}) =>
      (await api.post("/admin/sales-reps", { name, email, ...extra }, { headers }))
        .data.sales_rep.id as string

    const approve = (through: string) =>
      api.post("/admin/sales-commission/periods", { through }, { headers })
    const balanceOf = async (repId: string) =>
      (await api.get(`/admin/sales-reps/${repId}/balance`, { headers })).data
    const eurOf = async (repId: string) =>
      (await balanceOf(repId)).balances.find((b) => b.currency_code === "eur")
    const payout = (repId: string, body: Record<string, unknown>) =>
      api.post(
        `/admin/sales-reps/${repId}/payouts`,
        { currency_code: "eur", paid_at: "2026-01-15", ...body },
        { headers }
      )
    const failure = (promise: Promise<unknown>) =>
      promise.then(
        () => {
          throw new Error("expected the request to fail")
        },
        (e) => e.response
      )

    beforeEach(async () => {
      container = getContainer()
      ;({ headers } = await createAdminHeaders(container))
      peterId = await createRep("Peter Nagy", "peter@example.com")
      annaId = await createRep("Anna Kiss", "anna@example.com")
    })

    describe("approving months", () => {
      it("refuses a month that has not ended", async () => {
        const { data } = await api.get("/admin/sales-commission/periods", { headers })

        const response = await failure(approve(data.current_period))

        expect(response.status).toBe(400)
        expect(response.data.message).toContain("hasn't ended")
      })

      it("makes what was earned payable, from the first month with activity", async () => {
        await earn(peterId, NOV, 1000)
        await earn(peterId, DEC, 500)
        expect((await eurOf(peterId)).payable).toBe(0)

        const { data } = await approve(DEC)

        expect(data.approved_through).toBe(DEC)
        expect(data.approvals.map((a) => a.period)).toEqual([NOV, DEC])
        expect(await eurOf(peterId)).toMatchObject({
          earned: 1500,
          payable: 1500,
          open_earned: 0,
        })
      })

      it("keeps what is earned after the approved month out of reach", async () => {
        await earn(peterId, NOV, 1000)
        await earn(peterId, DEC, 500)

        await approve(NOV)

        expect(await eurOf(peterId)).toMatchObject({
          payable: 1000,
          open_earned: 500,
        })
      })

      it("refuses a month that is already approved", async () => {
        await earn(peterId, NOV, 1000)
        await approve(DEC)

        const response = await failure(approve(NOV))

        expect(response.status).toBe(400)
        expect(response.data.message).toContain("already approved")
      })

      it("can undo the latest approval until a payout is recorded", async () => {
        await earn(peterId, NOV, 1000)
        await earn(peterId, DEC, 500)
        await approve(DEC)

        const { data } = await api.delete("/admin/sales-commission/periods/latest", {
          headers,
        })

        expect(data.approved_through).toBe(NOV)
        expect((await eurOf(peterId)).payable).toBe(1000)

        await payout(peterId, { amount: 400 })
        const refused = await failure(
          api.delete("/admin/sales-commission/periods/latest", { headers })
        )
        expect(refused.status).toBe(400)
        expect(refused.data.message).toContain("Payouts were recorded")
      })

      it("has nothing to undo before the first approval", async () => {
        const response = await failure(
          api.delete("/admin/sales-commission/periods/latest", { headers })
        )

        expect(response.status).toBe(404)
      })

      it("refuses an adjustment in an approved month", async () => {
        await earn(peterId, NOV, 1000)
        await approve(NOV)

        const response = await failure(
          api.post(
            `/admin/sales-reps/${peterId}/adjustments`,
            { currency_code: "eur", amount: -20, period: NOV, reason: "Late return" },
            { headers }
          )
        )

        expect(response.status).toBe(400)
        expect(response.data.message).toContain("already approved")
      })
    })

    describe("balance across months", () => {
      it("carries what a short payment left into the next month", async () => {
        await earn(peterId, NOV, 1000)
        await earn(peterId, DEC, 500)
        await approve(NOV)

        await payout(peterId, { amount: 800, paid_at: "2025-12-05" })
        expect((await eurOf(peterId)).payable).toBe(200)

        await approve(DEC)
        expect((await eurOf(peterId)).payable).toBe(700)
      })

      it("shows a payment beyond what is payable as an advance, recovered from the next month", async () => {
        await earn(peterId, NOV, 1000)
        await earn(peterId, DEC, 500)
        await approve(NOV)

        await payout(peterId, { amount: 1200, paid_at: "2025-12-05" })
        expect(await eurOf(peterId)).toMatchObject({ payable: 0, to_recover: 200 })

        await approve(DEC)
        expect(await eurOf(peterId)).toMatchObject({ payable: 300, to_recover: 0 })
      })

      it("keeps a refund after payout and nets it against the next month", async () => {
        const [entry] = [await earn(peterId, NOV, 400)]
        await earn(peterId, DEC, 100)
        await approve(DEC)
        await payout(peterId, { amount: 500, paid_at: "2025-12-31" })
        await service().updateCommissionEntries({
          id: entry.id,
          voided_at: new Date("2026-01-12T10:00:00Z"),
          void_period: "2026-01",
          void_reason: "order_refunded",
        })

        // January: the refund takes back 400 that was already paid
        expect(await eurOf(peterId)).toMatchObject({ payable: 0, to_recover: 0 })
        await earn(peterId, "2026-01", 500)
        await approve("2026-01")

        expect(await eurOf(peterId)).toMatchObject({ payable: 100, to_recover: 0 })
      })

      it("lists the statement with the balance carried from earlier months", async () => {
        await earn(peterId, NOV, 1000)
        await earn(peterId, DEC, 500)
        await approve(DEC)
        await payout(peterId, { amount: 800, paid_at: "2025-12-20" })

        const { data } = await api.get(
          `/admin/sales-reps/${peterId}/statement?period=${DEC}`,
          { headers }
        )

        expect(data.approved).toBe(true)
        expect(data.lines.map((l) => [l.kind, l.amount, l.balance, l.status])).toEqual([
          ["direct", 500, 1500, "payable"],
          ["payout", 800, 700, "paid"],
        ])
        expect(data.totals).toEqual([
          expect.objectContaining({
            currency_code: "eur",
            opening: 1000,
            total: 500,
            paid: 800,
            closing: 700,
            status: "partial",
          }),
        ])
      })

      it("counts every entry, however many there are", async () => {
        await service().createCommissionEntries(
          Array.from({ length: 150 }, () => draft(peterId, NOV, 1))
        )
        await approve(NOV)

        expect(await eurOf(peterId)).toMatchObject({ earned: 150, payable: 150 })
        const { data } = await api.get(
          `/admin/sales-reps/${peterId}/statement?period=${NOV}`,
          { headers }
        )
        expect(data.lines).toHaveLength(150)
      })

      it("keeps a month's balance in the report even when nothing happened in it", async () => {
        await earn(peterId, NOV, 1000)

        const { data } = await api.get(
          `/admin/sales-commission/report?period=${DEC}`,
          { headers }
        )

        expect(data.rows).toEqual([
          expect.objectContaining({
            sales_rep_name: "Peter Nagy",
            opening: 1000,
            total: 0,
            closing: 1000,
            status: "unpaid",
          }),
        ])
      })
    })

    describe("payouts", () => {
      beforeEach(async () => {
        await earn(peterId, NOV, 1000)
        await approve(NOV)
      })

      it("remembers what was payable when the payout was made", async () => {
        const { data } = await payout(peterId, { amount: 800 })

        expect(data.payout).toEqual(
          expect.objectContaining({
            amount: 800,
            payable_before: 1000,
            period: "2026-01",
            currency_code: "eur",
          })
        )
      })

      it("takes the month from the payment date unless one is given", async () => {
        const { data } = await payout(peterId, { amount: 100, paid_at: "2026-03-02" })

        expect(data.payout.period).toBe("2026-03")
      })

      it("records the part above what is payable as a bonus, and removes it with the payout", async () => {
        const { data } = await payout(peterId, {
          amount: 1200,
          bonus_reason: "Year-end bonus",
        })

        const { data: adjustments } = await api.get(
          `/admin/sales-reps/${peterId}/adjustments`,
          { headers }
        )
        expect(adjustments.adjustments).toEqual([
          expect.objectContaining({
            amount: 200,
            reason: "Bonus paid with a payout: Year-end bonus",
          }),
        ])
        expect((await eurOf(peterId)).balance).toBe(0)

        await api.delete(`/admin/sales-commission/payouts/${data.payout.id}`, { headers })

        const { data: after } = await api.get(
          `/admin/sales-reps/${peterId}/adjustments`,
          { headers }
        )
        expect(after.adjustments).toEqual([])
        expect(await eurOf(peterId)).toMatchObject({ payable: 1000, balance: 1000 })
      })

      it("refuses a bonus when the payout is not above what is payable", async () => {
        const response = await failure(
          payout(peterId, { amount: 900, bonus_reason: "Bonus" })
        )

        expect(response.status).toBe(400)
        expect(response.data.message).toContain("no bonus to record")
      })

      it("refuses a payout in a currency the rep is not paid in", async () => {
        await api.post(
          `/admin/sales-reps/${peterId}`,
          { payout_currency_code: "huf" },
          { headers }
        )

        const response = await failure(payout(peterId, { amount: 100 }))

        expect(response.status).toBe(400)
        expect(response.data.message).toContain("is paid in HUF")
      })

      it("puts a payout back when it is removed", async () => {
        const { data } = await payout(peterId, { amount: 1000 })
        expect((await eurOf(peterId)).payable).toBe(0)

        await api.delete(`/admin/sales-commission/payouts/${data.payout.id}`, { headers })

        expect((await eurOf(peterId)).payable).toBe(1000)
      })
    })

    describe("payment run", () => {
      beforeEach(async () => {
        await earn(peterId, NOV, 1000)
        await earn(annaId, NOV, 50000, "huf")
        await approve(NOV)
      })

      const getRun = async () =>
        (await api.get("/admin/sales-commission/payment-run", { headers })).data

      it("lists who is owed what, by rep name, with the months still waiting", async () => {
        const run = await getRun()

        expect(run.approved_through).toBe(NOV)
        expect(run.rows.map((r) => [r.sales_rep_name, r.currency_code, r.payable])).toEqual([
          ["Anna Kiss", "huf", 50000],
          ["Peter Nagy", "eur", 1000],
        ])
        expect(run.closed_unapproved[0]).toBe(DEC)
      })

      it("records the payouts together, one per rep and currency", async () => {
        const { data } = await api.post(
          "/admin/sales-commission/payment-run",
          {
            items: [
              { sales_rep_id: peterId, currency_code: "eur", amount: 800 },
              { sales_rep_id: annaId, currency_code: "huf", amount: 50000 },
            ],
            paid_at: "2026-01-15",
            reference: "2025-11 run",
          },
          { headers }
        )

        expect(data.payouts).toHaveLength(2)
        expect(new Set(data.payouts.map((p) => p.run_id)).size).toBe(1)
        expect(data.payouts.map((p) => [p.amount, p.payable_before, p.reference])).toEqual([
          [800, 1000, "2025-11 run"],
          [50000, 50000, "2025-11 run"],
        ])
        expect((await getRun()).rows.map((r) => [r.sales_rep_name, r.payable])).toEqual([
          ["Peter Nagy", 200],
        ])
      })

      it("records nothing when one item is wrong", async () => {
        const response = await failure(
          api.post(
            "/admin/sales-commission/payment-run",
            {
              items: [
                { sales_rep_id: peterId, currency_code: "eur", amount: 800 },
                { sales_rep_id: "srep_missing", currency_code: "eur", amount: 10 },
              ],
              paid_at: "2026-01-15",
            },
            { headers }
          )
        )

        expect(response.status).toBe(404)
        expect((await getRun()).rows).toHaveLength(2)
      })

      it("refuses two payouts for the same rep and currency", async () => {
        const response = await failure(
          api.post(
            "/admin/sales-commission/payment-run",
            {
              items: [
                { sales_rep_id: peterId, currency_code: "eur", amount: 100 },
                { sales_rep_id: peterId, currency_code: "EUR", amount: 100 },
              ],
              paid_at: "2026-01-15",
            },
            { headers }
          )
        )

        expect(response.status).toBe(400)
        expect(response.data.message).toContain("one payout per rep and currency")
      })

      it("refuses an empty run and a zero amount", async () => {
        const empty = await failure(
          api.post(
            "/admin/sales-commission/payment-run",
            { items: [], paid_at: "2026-01-15" },
            { headers }
          )
        )
        const zero = await failure(
          api.post(
            "/admin/sales-commission/payment-run",
            {
              items: [{ sales_rep_id: peterId, currency_code: "eur", amount: 0 }],
              paid_at: "2026-01-15",
            },
            { headers }
          )
        )

        expect([empty.status, zero.status]).toEqual([400, 400])
      })

      it("shows a rep paid ahead so the advance is netted before anything is paid", async () => {
        await payout(peterId, { amount: 1300 })

        const run = await getRun()

        expect(run.rows.map((r) => [r.sales_rep_name, r.payable, r.to_recover])).toEqual([
          ["Anna Kiss", 50000, 0],
          ["Peter Nagy", 0, 300],
        ])
      })
    })

    describe("balances of every rep", () => {
      it("lists what each rep with activity is owed per currency", async () => {
        await earn(peterId, NOV, 1000)
        await earn(peterId, DEC, 200, "huf")
        await approve(NOV)

        const { data } = await api.get("/admin/sales-commission/balances", { headers })

        expect(data.approved_through).toBe(NOV)
        expect(
          data.balances[peterId].map((b) => [b.currency_code, b.payable, b.open_earned])
        ).toEqual([
          ["eur", 1000, 0],
          ["huf", 0, 200],
        ])
        expect(data.balances[annaId]).toBeUndefined()
      })
    })
  },
})
