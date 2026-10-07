import { medusaIntegrationTestRunner } from "@medusajs/test-utils"
import { MedusaContainer } from "@medusajs/framework/types"
import { Modules } from "@medusajs/framework/utils"
import { createAdminHeaders } from "./helpers/admin-auth"
import { createOrder, markOrderPaid, waitFor } from "./helpers/orders"

jest.setTimeout(120 * 1000)

// Independent of the plugin's own helper: sv-SE formats dates as YYYY-MM-DD
const budapestMonth = (date: Date) =>
  date.toLocaleString("sv-SE", { timeZone: "Europe/Budapest" }).slice(0, 7)

medusaIntegrationTestRunner({
  inApp: true,
  env: {},
  testSuite: ({ api, getContainer }) => {
    let container: MedusaContainer
    let headers: Record<string, string>
    let actorId: string
    let peterId: string
    let johnId: string
    let orderDisplayId: number
    const period = budapestMonth(new Date())

    beforeEach(async () => {
      container = getContainer()
      ;({ headers, actorId } = await createAdminHeaders(container))

      const customer = await container.resolve(Modules.CUSTOMER).createCustomers({
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

      // Net value 180: Peter earns 18, John 9 (Level 2)
      const order = await createOrder(container, customer)
      orderDisplayId = order.display_id
      await markOrderPaid(container, order.id)
      await waitFor(async () => {
        const entries = await container
          .resolve("salesCommission")
          .listCommissionEntries({ order_id: order.id })
        return entries.length === 2
      })
    })

    const adjust = (body: Record<string, unknown>) =>
      api.post(`/admin/sales-reps/${peterId}/adjustments`, body, { headers })
    const pay = (body: Record<string, unknown>) =>
      api.post(
        `/admin/sales-reps/${peterId}/payouts`,
        {
          currency_code: "eur",
          period,
          paid_at: "2026-12-02",
          reference: "Bank transfer 2026-12-02",
          ...body,
        },
        { headers }
      )
    const statement = (repId = peterId) =>
      api.get(`/admin/sales-reps/${repId}/statement?period=${period}`, { headers })

    describe("adjustments", () => {
      it.each([
        ["no reason", { reason: "  ", amount: -5 }],
        ["a zero amount", { reason: "Partial return", amount: 0 }],
        // Adjustments can't be deleted, so a bad one would stay in the report
        ["a currency that doesn't exist", { reason: "Typo", amount: -5, currency_code: "xyz" }],
        ["cents the currency doesn't have", { reason: "Rounding", amount: -5.005 }],
        ["decimals in a whole-number currency", { reason: "Rounding", amount: -5.5, currency_code: "huf" }],
      ])("rejects an adjustment with %s", async (_, body) => {
        const error = await adjust({ currency_code: "eur", period, ...body }).catch(
          (e) => e.response
        )

        expect(error.status).toBe(400)
      })

      it("records an adjustment with who made it", async () => {
        const { data } = await adjust({
          currency_code: "eur",
          period,
          amount: -5,
          reason: "Partial return on the olive trees",
        })
        const { data: list } = await api.get(
          `/admin/sales-reps/${peterId}/adjustments`,
          { headers }
        )

        expect(data.adjustment).toEqual(
          expect.objectContaining({ amount: -5, created_by: actorId })
        )
        expect(list.adjustments).toHaveLength(1)
      })
    })

    describe("statement", () => {
      it("lists the month's commission and adjustments with totals", async () => {
        await adjust({
          currency_code: "eur",
          period,
          amount: -5,
          reason: "Partial return on the olive trees",
        })

        const { data } = await statement()

        expect(data.lines.map((l) => [l.kind, l.amount])).toEqual([
          ["direct", 18],
          ["adjustment", -5],
        ])
        expect(data.totals).toEqual([
          {
            currency_code: "eur",
            turnover: 180,
            level2_turnover: 0,
            direct: 18,
            level2: 0,
            adjustments: -5,
            total: 13,
            paid: 0,
            opening: 0,
            closing: 13,
            status: "unpaid",
          },
        ])
      })

      it("shows the referrer's Level 2 commission", async () => {
        const { data } = await statement(johnId)

        expect(data.totals[0]).toEqual(
          expect.objectContaining({ level2_turnover: 180, level2: 9, total: 9 })
        )
      })

      it.each([
        [18, "paid"],
        [5, "partial"],
      ])("a payout of %p marks the month %s", async (amount, status) => {
        await pay({ amount })

        const { data } = await statement()

        expect([data.totals[0].paid, data.totals[0].status]).toEqual([
          amount,
          status,
        ])
      })

      it.each([
        ["isn't positive", { amount: 0 }],
        ["is in a currency that doesn't exist", { amount: 18, currency_code: "xyz" }],
        ["has cents the currency doesn't have", { amount: 18.005 }],
        ["has decimals in a whole-number currency", { amount: 1800.5, currency_code: "huf" }],
      ])("rejects a payout that %s", async (_, body) => {
        const error = await pay(body).catch((e) => e.response)

        expect(error.status).toBe(400)
      })

      it("reopens the month when a payout is deleted", async () => {
        const { data } = await pay({ amount: 18 })

        await api.delete(`/admin/sales-commission/payouts/${data.payout.id}`, {
          headers,
        })

        expect((await statement()).data.totals[0].status).toBe("unpaid")
      })

      it("exports the statement as CSV", async () => {
        // arraybuffer: axios strips a leading BOM when it decodes text
        const response = await api.get(
          `/admin/sales-reps/${peterId}/statement?period=${period}&format=csv`,
          { headers, responseType: "arraybuffer" }
        )
        const bytes = Buffer.from(response.data)
        const text = bytes.toString("utf8")

        expect(response.headers["content-type"]).toContain("text/csv")
        expect([...bytes.subarray(0, 3)]).toEqual([0xef, 0xbb, 0xbf])
        expect(text).toContain(`#${orderDisplayId}`)
        expect(text).toContain("Green Office Kft.")
      })
    })

    describe("monthly report", () => {
      it("has a row per rep and currency", async () => {
        const { data } = await api.get(
          `/admin/sales-commission/report?period=${period}`,
          { headers }
        )

        expect(
          data.rows.map((r) => [r.sales_rep_name, r.currency_code, r.direct, r.level2, r.total])
        ).toEqual([
          ["John Smith", "eur", 0, 9, 9],
          ["Peter Nagy", "eur", 18, 0, 18],
        ])
      })

      it("exports as CSV", async () => {
        const response = await api.get(
          `/admin/sales-commission/report?period=${period}&format=csv`,
          { headers }
        )
        const [header, ...rows] = response.data.replace("﻿", "").trim().split("\r\n")

        expect(response.headers["content-disposition"]).toContain(
          `commission-report-${period}.csv`
        )
        expect(header).toBe(
          "Period,Sales rep,Email,Currency,Turnover,Level 2 turnover,Direct commission,Level 2 commission,Adjustments,Earned this month,Paid this month,Owed at start,Owed at end,Status"
        )
        expect(rows).toEqual([
          `${period},John Smith,john@example.com,EUR,0,180,0,9,0,9,0,0,9,unpaid`,
          `${period},Peter Nagy,peter@example.com,EUR,180,0,18,0,0,18,0,0,18,unpaid`,
        ])
      })

      it("rejects a malformed month", async () => {
        const error = await api
          .get("/admin/sales-commission/report?period=2026-13", { headers })
          .catch((e) => e.response)

        expect(error.status).toBe(400)
      })
    })
  },
})
