import { medusaIntegrationTestRunner } from "@medusajs/test-utils"
import { MedusaContainer } from "@medusajs/framework/types"
import { ContainerRegistrationKeys, Modules } from "@medusajs/framework/utils"
import {
  cancelOrderWorkflow,
  generateResetPasswordTokenWorkflow,
} from "@medusajs/medusa/core-flows"
import { createAdminHeaders } from "./helpers/admin-auth"
import { createOrder, markOrderPaid, waitFor } from "./helpers/orders"

jest.setTimeout(180 * 1000)

// A test value for this app only
const PASSWORD = "portal-test-password-1"
const EMAILS = {
  peter: "peter@example.com",
  anna: "anna@example.com",
  john: "john@example.com",
}

// Independent of the plugin's own helper: sv-SE formats as "YYYY-MM-DD HH:mm:ss"
const budapestMonth = (date: Date) =>
  date.toLocaleString("sv-SE", { timeZone: "Europe/Budapest" }).slice(0, 7)

medusaIntegrationTestRunner({
  inApp: true,
  env: {},
  testSuite: ({ api, getContainer }) => {
    const period = budapestMonth(new Date())
    let container: MedusaContainer
    let headers: Record<string, string>
    let ids: { peter: string; anna: string; john: string }
    let tokens: { peter: string; anna: string; john: string }
    let greenOffice: { id: string }
    let bluePlants: { id: string }
    let greenOrderNumber: number

    const post = (path: string, body = {}) => api.post(path, body, { headers })
    const get = (path: string, token: string) =>
      api.get(path, { headers: { authorization: `Bearer ${token}` } })
    const failure = (promise: Promise<unknown>) =>
      promise.then(
        () => {
          throw new Error("expected the request to fail")
        },
        (e) => e.response
      )

    async function createRep(name: string, email: string) {
      return (await post("/admin/sales-reps", { name, email })).data.sales_rep
        .id as string
    }

    /** Gives access, sets a first password with Medusa's reset flow, signs in */
    async function portalLogin(repId: string, email: string) {
      await post(`/admin/sales-reps/${repId}/portal-access`)
      const { http } = container.resolve(
        ContainerRegistrationKeys.CONFIG_MODULE
      ).projectConfig
      const { result: resetToken } = await generateResetPasswordTokenWorkflow(
        container
      ).run({
        input: {
          entityId: email,
          actorType: "sales_rep",
          provider: "emailpass",
          secret: http.jwtSecret,
          jwtOptions: http.jwtOptions,
        },
      })
      await api.post(
        "/auth/sales_rep/emailpass/update",
        { email, password: PASSWORD },
        { headers: { authorization: `Bearer ${resetToken}` } }
      )
      return (await api.post("/auth/sales_rep/emailpass", { email, password: PASSWORD }))
        .data.token as string
    }

    const entriesOf = (orderId: string) =>
      container.resolve("salesCommission").listCommissionEntries({ order_id: orderId })

    beforeEach(async () => {
      container = getContainer()
      ;({ headers } = await createAdminHeaders(container))

      ids = {
        peter: await createRep("Peter Nagy", EMAILS.peter),
        anna: await createRep("Anna Kiss", EMAILS.anna),
        john: await createRep("John Smith", EMAILS.john),
      }
      await post(`/admin/sales-reps/${ids.peter}/referral`, {
        referrer_sales_rep_id: ids.john,
        level2_rate: 5,
      })
      await api.post(
        `/admin/sales-reps/${ids.peter}`,
        { notes: "internal: difficult negotiator" },
        { headers }
      )

      const customers = container.resolve(Modules.CUSTOMER)
      greenOffice = await customers.createCustomers({
        email: "buyer@greenoffice.example",
        company_name: "Green Office Kft.",
        addresses: [{ address_1: "Secret street 1", city: "Budapest", country_code: "hu" }],
      })
      bluePlants = await customers.createCustomers({
        email: "buyer@blueplants.example",
        company_name: "Blue Plants Kft.",
      })
      await post(`/admin/customers/${greenOffice.id}/sales-rep-assignment`, {
        sales_rep_id: ids.peter,
        commission_rate: 10,
      })
      await post(`/admin/customers/${bluePlants.id}/sales-rep-assignment`, {
        sales_rep_id: ids.anna,
        commission_rate: 15,
      })

      // Net value 180 each: Peter earns 18 (John 9 on top), Anna earns 27
      const greenOrder = await createOrder(container, {
        id: greenOffice.id,
        email: "buyer@greenoffice.example",
      })
      greenOrderNumber = greenOrder.display_id
      const blueOrder = await createOrder(container, {
        id: bluePlants.id,
        email: "buyer@blueplants.example",
      })
      await markOrderPaid(container, greenOrder.id)
      await markOrderPaid(container, blueOrder.id)
      await waitFor(async () => (await entriesOf(greenOrder.id)).length === 2)
      await waitFor(async () => (await entriesOf(blueOrder.id)).length === 1)

      tokens = {
        peter: await portalLogin(ids.peter, EMAILS.peter),
        anna: await portalLogin(ids.anna, EMAILS.anna),
        john: await portalLogin(ids.john, EMAILS.john),
      }
    })

    describe("who gets in", () => {
      it("needs a login", async () => {
        expect((await failure(api.get("/sales-portal/me"))).status).toBe(401)
      })

      it("turns away a shop customer's login", async () => {
        const { data } = await api.post("/auth/customer/emailpass/register", {
          email: "customer@example.com",
          password: PASSWORD,
        })

        expect((await failure(get("/sales-portal/me", data.token))).status).toBe(401)
      })

      it("turns away a sales rep login that was never given access", async () => {
        const { data } = await api.post("/auth/sales_rep/emailpass/register", {
          email: "stranger@example.com",
          password: PASSWORD,
        })

        expect((await failure(get("/sales-portal/me", data.token))).status).toBe(401)
      })

      it("stops a rep whose access was ended, even with a token that is still valid", async () => {
        expect((await get("/sales-portal/me", tokens.peter)).status).toBe(200)

        await api.delete(`/admin/sales-reps/${ids.peter}/portal-access`, { headers })

        expect((await failure(get("/sales-portal/me", tokens.peter))).status).toBe(403)

        await post(`/admin/sales-reps/${ids.peter}/portal-access`)
        expect((await get("/sales-portal/me", tokens.peter)).status).toBe(200)
      })

      it("stops a rep who was deactivated", async () => {
        await post(`/admin/sales-reps/${ids.peter}`, { is_active: false })

        expect((await failure(get("/sales-portal/me", tokens.peter))).status).toBe(403)
      })
    })

    describe("GET /sales-portal/me", () => {
      it("returns the rep's profile without internal notes", async () => {
        const { data } = await get("/sales-portal/me", tokens.peter)

        expect(data).toEqual({
          sales_rep: {
            id: ids.peter,
            name: "Peter Nagy",
            email: EMAILS.peter,
            phone: null,
          },
        })
      })
    })

    describe("GET /sales-portal/summary", () => {
      it("returns the month's totals per currency", async () => {
        const { data } = await get(`/sales-portal/summary?period=${period}`, tokens.peter)

        expect(data.period).toBe(period)
        expect(data.totals).toEqual([
          {
            currency_code: "eur",
            turnover: 180,
            level2_turnover: 0,
            direct: 18,
            level2: 0,
            adjustments: 0,
            total: 18,
            paid: 0,
            opening: 0,
            closing: 18,
            status: "unpaid",
          },
        ])
      })

      it("defaults to the current month and rejects a malformed one", async () => {
        const { data } = await get("/sales-portal/summary", tokens.peter)

        expect(data.period).toBe(period)
        expect(
          (await failure(get("/sales-portal/summary?period=2026-13", tokens.peter))).status
        ).toBe(400)
      })
    })

    describe("GET /sales-portal/balance", () => {
      it("returns what the rep is owed, split into payable and not yet payable", async () => {
        const { data } = await get("/sales-portal/balance", tokens.peter)

        expect(data.approved_through).toBeNull()
        expect(data.balances).toEqual([
          expect.objectContaining({
            currency_code: "eur",
            earned: 18,
            paid: 0,
            payable: 0,
            open_earned: 18,
            to_recover: 0,
          }),
        ])
        expect(data.pending).toEqual([])
        expect(data.next_run).toBeNull()
      })

      it("shows each rep only their own balance", async () => {
        const anna = await get("/sales-portal/balance", tokens.anna)
        const john = await get("/sales-portal/balance", tokens.john)

        expect(anna.data.balances[0].earned).toBe(27)
        expect(john.data.balances[0].earned).toBe(9)
      })

      it("shows what unpaid orders would earn, without naming other reps' clients", async () => {
        await createOrder(container, {
          id: greenOffice.id,
          email: "buyer@greenoffice.example",
        })

        const peter = await get("/sales-portal/balance", tokens.peter)
        const john = await get("/sales-portal/balance", tokens.john)
        const anna = await get("/sales-portal/balance", tokens.anna)
        const johnStatement = await get(`/sales-portal/statement?period=${period}`, tokens.john)

        expect(peter.data.pending).toEqual([{ currency_code: "eur", amount: 18, orders: 1 }])
        expect(john.data.pending).toEqual([{ currency_code: "eur", amount: 9, orders: 1 }])
        expect(anna.data.pending).toEqual([])
        expect(johnStatement.data.pending).toEqual([
          expect.objectContaining({
            kind: "level2",
            status: "pending",
            referred_rep_name: "Peter Nagy",
            client_name: null,
            order_number: null,
            balance: null,
            amount: 9,
          }),
        ])
        expect(JSON.stringify(johnStatement.data)).not.toContain("Green Office")
      })

      it("lists a rep's own unpaid orders by number and client", async () => {
        const order = await createOrder(container, {
          id: greenOffice.id,
          email: "buyer@greenoffice.example",
        })

        const { data } = await get(`/sales-portal/statement?period=${period}`, tokens.peter)

        expect(data.pending).toEqual([
          expect.objectContaining({
            kind: "commission",
            status: "pending",
            order_number: order.display_id,
            client_name: "Green Office Kft.",
            net_value: 180,
            rate: 10,
            amount: 18,
            balance: null,
          }),
        ])
      })
    })

    describe("GET /sales-portal/statement", () => {
      it("shows the rep's own orders with the client, order number and net value", async () => {
        const { data } = await get(`/sales-portal/statement?period=${period}`, tokens.peter)

        expect(data.lines).toEqual([
          {
            kind: "commission",
            date: expect.any(String),
            currency_code: "eur",
            order_number: greenOrderNumber,
            customer_id: greenOffice.id,
            client_name: "Green Office Kft.",
            referred_rep_name: null,
            net_value: 180,
            rate: 10,
            amount: 18,
            status: "earned",
            balance: 18,
            order_currency_code: null,
            order_amount: null,
            fx_rate: null,
            note: null,
          },
        ])
      })

      it("shows a referrer's Level 2 per referred rep, without clients or orders", async () => {
        const { data } = await get(`/sales-portal/statement?period=${period}`, tokens.john)

        expect(data.lines).toEqual([
          {
            kind: "level2",
            date: expect.any(String),
            currency_code: "eur",
            order_number: null,
            customer_id: null,
            client_name: null,
            referred_rep_name: "Peter Nagy",
            net_value: 180,
            rate: 5,
            amount: 9,
            status: "earned",
            balance: 9,
            order_currency_code: null,
            order_amount: null,
            fx_rate: null,
            note: null,
          },
        ])
        expect(JSON.stringify(data)).not.toContain("Green Office")
      })

      it("shows adjustments with their reason and payouts with their reference", async () => {
        await post(`/admin/sales-reps/${ids.peter}/adjustments`, {
          currency_code: "eur",
          amount: -5,
          period,
          reason: "Partial return on the olive trees",
        })
        await post(`/admin/sales-reps/${ids.peter}/payouts`, {
          currency_code: "eur",
          amount: 13,
          period,
          paid_at: "2026-12-02",
          reference: "Bank transfer 2026-12-02",
        })

        const { data } = await get(`/sales-portal/statement?period=${period}`, tokens.peter)

        expect(data.lines.map((l) => [l.kind, l.amount, l.note])).toEqual(
          expect.arrayContaining([
            ["adjustment", -5, "Partial return on the olive trees"],
            ["payout", 13, "Bank transfer 2026-12-02"],
          ])
        )
        expect(data.totals[0]).toEqual(
          expect.objectContaining({ total: 13, paid: 13, status: "paid" })
        )
      })

      it("drops an order canceled in the month it was paid", async () => {
        const [entry] = await container
          .resolve("salesCommission")
          .listCommissionEntries({ customer_id: greenOffice.id, type: "direct" })
        await cancelOrderWorkflow(container).run({ input: { order_id: entry.order_id } })
        await waitFor(async () =>
          (await entriesOf(entry.order_id)).every((e) => e.voided_at)
        )

        const { data } = await get(`/sales-portal/statement?period=${period}`, tokens.peter)

        expect(data.lines).toEqual([])
      })
    })

    describe("GET /sales-portal/clients", () => {
      it("lists the rep's own clients by company name with the month's turnover", async () => {
        const { data } = await get(`/sales-portal/clients?period=${period}`, tokens.peter)

        expect(data.clients).toEqual([
          {
            customer_id: greenOffice.id,
            client_name: "Green Office Kft.",
            current: true,
            commission_rate: 10,
            since: expect.any(String),
            totals: [{ currency_code: "eur", turnover: 180, commission: 18 }],
          },
        ])
      })

      it("lists no clients for a rep who only earns Level 2", async () => {
        const { data } = await get(`/sales-portal/clients?period=${period}`, tokens.john)

        expect(data.clients).toEqual([])
      })
    })

    describe("GET /sales-portal/clients/:customer_id/orders", () => {
      it("lists the client's paid orders", async () => {
        const { data } = await get(
          `/sales-portal/clients/${greenOffice.id}/orders`,
          tokens.peter
        )

        expect(data).toEqual({
          client_name: "Green Office Kft.",
          orders: [
            {
              order_number: greenOrderNumber,
              paid_at: expect.any(String),
              net_value: 180,
              currency_code: "eur",
              rate: 10,
              commission: 18,
              status: "paid",
            },
          ],
          count: 1,
          offset: 0,
          limit: 50,
        })
      })

      it("returns 404 for another rep's client, as for one that doesn't exist", async () => {
        const other = await failure(
          get(`/sales-portal/clients/${bluePlants.id}/orders`, tokens.peter)
        )
        const missing = await failure(
          get("/sales-portal/clients/cus_missing/orders", tokens.peter)
        )

        expect(other.status).toBe(404)
        expect(missing.status).toBe(404)
        expect(other.data).toEqual(missing.data)
      })

      it("returns 404 to a rep who only earns Level 2 on the client", async () => {
        const response = await failure(
          get(`/sales-portal/clients/${greenOffice.id}/orders`, tokens.john)
        )

        expect(response.status).toBe(404)
      })
    })

    describe("GET /sales-portal/statements and /payouts", () => {
      it("lists the months with their totals, newest first", async () => {
        const { data } = await get("/sales-portal/statements", tokens.peter)

        expect(data.statements).toEqual([
          {
            period,
            approved: false,
            totals: [expect.objectContaining({ currency_code: "eur", direct: 18, total: 18 })],
          },
        ])
      })

      it("lists the rep's own payouts only", async () => {
        await post(`/admin/sales-reps/${ids.peter}/payouts`, {
          currency_code: "eur",
          amount: 18,
          period,
          paid_at: "2026-12-02",
          reference: "Bank transfer 2026-12-02",
        })

        const peters = await get("/sales-portal/payouts", tokens.peter)
        const annas = await get("/sales-portal/payouts", tokens.anna)

        expect(peters.data.payouts).toEqual([
          {
            paid_at: expect.stringContaining("2026-12-02"),
            period,
            amount: 18,
            currency_code: "eur",
            reference: "Bank transfer 2026-12-02",
          },
        ])
        expect(annas.data.payouts).toEqual([])
      })
    })

    describe("what never reaches a rep", () => {
      it("keeps addresses, emails, order contents and internal ids out of every response", async () => {
        await post(`/admin/sales-reps/${ids.peter}/payouts`, {
          currency_code: "eur",
          amount: 18,
          period,
          paid_at: "2026-12-02",
          reference: "Bank transfer",
        })
        const everyRepsPaths = [
          "/sales-portal/me",
          `/sales-portal/summary?period=${period}`,
          `/sales-portal/statement?period=${period}`,
          `/sales-portal/clients?period=${period}`,
          "/sales-portal/statements",
          "/sales-portal/payouts",
        ]
        // Only the rep who owns the client may ask for their orders
        const requests = [
          ...everyRepsPaths.flatMap((path) => [
            { path, token: tokens.peter },
            { path, token: tokens.john },
          ]),
          {
            path: `/sales-portal/clients/${greenOffice.id}/orders`,
            token: tokens.peter,
          },
        ]

        for (const { path, token } of requests) {
          const response = await get(path, token).catch((e) => e.response)
          const body = JSON.stringify(response.data)

          // A failed request would pass the checks below for nothing
          expect([path, response.status]).toEqual([path, 200])
          expect(body).not.toMatch(/Secret street|buyer@|Olive tree|difficult negotiator/)
          expect(body).not.toMatch(/order_[0-9A-Z]{20}|authid_|sce_|sca_|scpay_/)
        }
      })
    })
  },
})
