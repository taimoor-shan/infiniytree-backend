import { medusaIntegrationTestRunner } from "@medusajs/test-utils"
import { MedusaContainer } from "@medusajs/framework/types"
import { Modules } from "@medusajs/framework/utils"
import { cancelOrderWorkflow } from "@medusajs/medusa/core-flows"
import { createAdminHeaders } from "./helpers/admin-auth"
import { createOrder, markOrderPaid, waitFor } from "./helpers/orders"
import { PORTAL_PASSWORD, portalLogin } from "./helpers/portal"

jest.setTimeout(120 * 1000)

const PDF_BYTES = Buffer.from("%PDF-1.4 signed contract")

medusaIntegrationTestRunner({
  inApp: true,
  env: {},
  testSuite: ({ api, getContainer }) => {
    let container: MedusaContainer
    let headers: Record<string, string>

    const service = () => container.resolve("salesCommission")

    const createRep = async (name: string, email: string) =>
      (await api.post("/admin/sales-reps", { name, email }, { headers })).data
        .sales_rep.id as string
    const remove = (id: string) =>
      api.delete(`/admin/sales-reps/${id}`, { headers })
    const check = async (id: string) =>
      (await api.get(`/admin/sales-reps/${id}/deletion`, { headers })).data
    const failure = (promise: Promise<unknown>) =>
      promise.then(
        () => {
          throw new Error("expected the request to fail")
        },
        (e) => e.response
      )
    const customerOf = (email: string, company: string) =>
      container
        .resolve(Modules.CUSTOMER)
        .createCustomers({ email, company_name: company })
    const assign = (customerId: string, repId: string) =>
      api.post(
        `/admin/customers/${customerId}/sales-rep-assignment`,
        { sales_rep_id: repId, commission_rate: 10 },
        { headers }
      )
    const endAssignment = (customerId: string) =>
      api.delete(`/admin/customers/${customerId}/sales-rep-assignment`, {
        headers,
      })
    const invite = (
      recruiterId: string,
      email: string,
      status: string,
      extra: Record<string, unknown> = {}
    ) =>
      service().createRepInvites({
        recruiter_sales_rep_id: recruiterId,
        email,
        name: "Candidate",
        token_hash: `hash-${email}`,
        status,
        expires_at: new Date(Date.now() + 86_400_000),
        ...extra,
      } as any)

    beforeEach(async () => {
      container = getContainer()
      ;({ headers } = await createAdminHeaders(container))
    })

    describe("a rep with nothing on record", () => {
      it("can be deleted, and is gone from the detail and the list", async () => {
        const id = await createRep("Peter Nagy", "peter@example.com")

        expect(await check(id)).toEqual({ can_delete: true, blockers: [] })

        const { status, data } = await remove(id)

        expect(status).toBe(200)
        expect(data).toEqual({ id, object: "sales_rep", deleted: true })
        expect((await failure(api.get(`/admin/sales-reps/${id}`, { headers }))).status).toBe(404)
        const { data: list } = await api.get("/admin/sales-reps", { headers })
        expect(list.sales_reps.map((rep: any) => rep.id)).not.toContain(id)
      })

      it("answers 404 for a rep that is gone or never was", async () => {
        const id = await createRep("Peter Nagy", "peter@example.com")
        await remove(id)

        expect((await failure(remove(id))).status).toBe(404)
        expect((await failure(check(id))).status).toBe(404)
        expect((await failure(remove("srep_missing"))).status).toBe(404)
      })

      it("frees the email for a new rep", async () => {
        const id = await createRep("Peter Nagy", "peter@example.com")
        await remove(id)

        const again = await createRep("Peter Nagy", "peter@example.com")

        expect(again).not.toBe(id)
      })

      it("leaves other reps alone", async () => {
        const peter = await createRep("Peter Nagy", "peter@example.com")
        const john = await createRep("John Smith", "john@example.com")
        const customer = await customerOf("buyer@greenoffice.example", "Green Office Kft.")
        await assign(customer.id, john)

        await remove(peter)

        const { data } = await api.get(`/admin/sales-reps/${john}/clients`, { headers })
        expect(data.clients).toHaveLength(1)
        expect((await check(john)).can_delete).toBe(false)
      })
    })

    describe("money on record", () => {
      it("keeps a rep who earned commission, and says so", async () => {
        const peter = await createRep("Peter Nagy", "peter@example.com")
        const customer = await customerOf("buyer@greenoffice.example", "Green Office Kft.")
        await assign(customer.id, peter)
        const order = await createOrder(container, customer)
        await markOrderPaid(container, order.id)
        await waitFor(
          async () =>
            (await service().listCommissionEntries({ order_id: order.id })).length === 1
        )
        await endAssignment(customer.id)

        const refusal = await failure(remove(peter))

        expect(refusal.status).toBe(400)
        expect(refusal.data.code).toBe("rep_delete_blocked")
        expect(refusal.data.message).toContain("1 commission entry")
        expect((await check(peter)).blockers).toEqual([
          expect.objectContaining({ code: "money", count: 1 }),
        ])
        expect((await api.get(`/admin/sales-reps/${peter}`, { headers })).status).toBe(200)
      })

      it("keeps a rep who has an adjustment or a payout", async () => {
        const withAdjustment = await createRep("Adjusted Rep", "adjusted@example.com")
        await api.post(
          `/admin/sales-reps/${withAdjustment}/adjustments`,
          { currency_code: "eur", period: "2026-01", amount: 5, reason: "Welcome bonus" },
          { headers }
        )
        const withPayout = await createRep("Paid Rep", "paid@example.com")
        await api.post(
          `/admin/sales-reps/${withPayout}/payouts`,
          {
            currency_code: "eur",
            amount: 10,
            paid_at: "2026-01-15",
            bonus_reason: "Paid ahead",
          },
          { headers }
        )

        const first = await failure(remove(withAdjustment))
        const second = await failure(remove(withPayout))

        expect(first.status).toBe(400)
        expect(first.data.message).toContain("1 adjustment")
        expect(second.status).toBe(400)
        expect(second.data.message).toContain("1 payout")
      })
    })

    describe("clients", () => {
      it("keeps a rep with a current client, and deletes them once the client is moved on", async () => {
        const peter = await createRep("Peter Nagy", "peter@example.com")
        const customer = await customerOf("buyer@greenoffice.example", "Green Office Kft.")
        await assign(customer.id, peter)

        const refusal = await failure(remove(peter))

        expect(refusal.data.message).toContain("1 current client")
        expect((await check(peter)).blockers[0].code).toBe("clients")

        await endAssignment(customer.id)
        expect((await remove(peter)).status).toBe(200)
        // The ended assignment went with the rep
        expect(await service().listClientAssignments({ sales_rep_id: peter })).toEqual([])
      })

      it("keeps a rep while an unpaid order of an old client would still earn them commission", async () => {
        const peter = await createRep("Peter Nagy", "peter@example.com")
        const customer = await customerOf("buyer@greenoffice.example", "Green Office Kft.")
        await assign(customer.id, peter)
        const order = await createOrder(container, customer)
        await new Promise((resolve) => setTimeout(resolve, 20))
        // Ended just after the order was placed. Through the API an assignment
        // ends at the start of the day, which is before this order
        const [row] = await service().listClientAssignments({ sales_rep_id: peter })
        await service().updateClientAssignments({
          id: row.id,
          ends_at: new Date(Date.now() - 5),
        })

        const refusal = await failure(remove(peter))

        expect(refusal.data.message).toContain("1 unpaid order")
        expect((await check(peter)).blockers.map((b: any) => b.code)).toEqual([
          "unpaid_orders",
        ])

        await cancelOrderWorkflow(container).run({ input: { order_id: order.id } })
        expect((await remove(peter)).status).toBe(200)
      })
    })

    describe("recruits", () => {
      const refer = (referredId: string, referrerId: string) =>
        api.post(
          `/admin/sales-reps/${referredId}/referral`,
          { referrer_sales_rep_id: referrerId, level2_rate: 5 },
          { headers }
        )

      it("keeps a referrer whose Level 2 link is running, and deletes them once it is ended", async () => {
        const john = await createRep("John Smith", "john@example.com")
        const peter = await createRep("Peter Nagy", "peter@example.com")
        await refer(peter, john)

        const refusal = await failure(remove(john))

        expect(refusal.data.message).toContain("Level 2 referrer of 1 rep")

        await api.delete(`/admin/sales-reps/${peter}/referral`, { headers })
        expect((await remove(john)).status).toBe(200)
        // The ended link went with the referrer
        expect(await service().listRepReferrals({ referrer_sales_rep_id: john })).toEqual([])
      })

      it("doesn't count a link that has run out", async () => {
        const john = await createRep("John Smith", "john@example.com")
        const peter = await createRep("Peter Nagy", "peter@example.com")
        await refer(peter, john)
        const [link] = await service().listRepReferrals({ referrer_sales_rep_id: john })
        await service().updateRepReferrals({
          id: link.id,
          expires_at: new Date(Date.now() - 86_400_000),
        })

        expect((await remove(john)).status).toBe(200)
      })

      it("deletes the rep a link points at, and the link with them", async () => {
        const john = await createRep("John Smith", "john@example.com")
        const peter = await createRep("Peter Nagy", "peter@example.com")
        await refer(peter, john)

        expect((await remove(peter)).status).toBe(200)

        expect(await service().listRepReferrals({ referred_sales_rep_id: peter })).toEqual([])
        // John is free of the link again
        expect((await check(john)).can_delete).toBe(true)
      })

      it("keeps a recruiter whose recruit's application waits for the owner", async () => {
        const john = await createRep("John Smith", "john@example.com")
        await invite(john, "candidate@example.com", "applied")

        const refusal = await failure(remove(john))

        expect(refusal.data.message).toContain("1 application")
        expect((await check(john)).blockers[0].code).toBe("applications")
      })
    })

    describe("what goes with the rep", () => {
      it("withdraws the invitations they sent and removes the rest of what is theirs", async () => {
        const john = await createRep("John Smith", "john@example.com")
        const peter = await createRep("Peter Nagy", "peter@example.com")
        await invite(john, "open@example.com", "invited")
        await invite(john, "canceled@example.com", "canceled")
        await invite(john, "declined@example.com", "declined")
        // The recruit became a rep: that stays as the record of where they came from
        await invite(john, "approved@example.com", "approved", { sales_rep_id: peter })
        // The application that made John a rep goes with him
        await invite(peter, "john@example.com", "approved", { sales_rep_id: john })
        await api.post(
          `/admin/sales-reps/${john}/contracts`,
          {
            file_name: "contract.pdf",
            mime_type: "application/pdf",
            content_base64: PDF_BYTES.toString("base64"),
          },
          { headers }
        )

        expect((await remove(john)).status).toBe(200)

        const sent = await service().listRepInvites(
          { recruiter_sales_rep_id: john },
          { withDeleted: true }
        )
        const byEmail = Object.fromEntries(sent.map((row) => [row.email, row]))
        expect(byEmail["open@example.com"]).toEqual(
          expect.objectContaining({
            status: "canceled",
            deleted_at: expect.anything(),
          })
        )
        expect(byEmail["canceled@example.com"].deleted_at).not.toBeNull()
        expect(byEmail["declined@example.com"].deleted_at).not.toBeNull()
        expect(byEmail["approved@example.com"]).toEqual(
          expect.objectContaining({ status: "approved", deleted_at: null })
        )
        const [madeJohn] = await service().listRepInvites(
          { sales_rep_id: john },
          { withDeleted: true }
        )
        expect(madeJohn.deleted_at).not.toBeNull()
        expect(await service().listSalesRepContracts({ sales_rep_id: john })).toEqual([])
        expect(
          await service().listSalesRepContracts({ sales_rep_id: john }, { withDeleted: true })
        ).toHaveLength(1)
      })

      it("lets the owner still open an old application whose recruiter was deleted", async () => {
        const john = await createRep("John Smith", "john@example.com")
        const peter = await createRep("Peter Nagy", "peter@example.com")
        const approved = await invite(john, "peter@example.com", "approved", {
          sales_rep_id: peter,
        })

        expect((await remove(john)).status).toBe(200)

        const { data } = await api.get(
          `/admin/sales-commission/applications/${approved.id}`,
          { headers }
        )
        expect(data.application.recruiter).toBeNull()
        expect(data.recruiter).toBeNull()
        const { data: list } = await api.get(
          "/admin/sales-commission/applications?status=approved",
          { headers }
        )
        expect(list.applications).toEqual([
          expect.objectContaining({ id: approved.id, recruiter: null }),
        ])
      })
    })

    describe("the portal login", () => {
      it("ends with the rep, even for a token that is still valid", async () => {
        const id = await createRep("Peter Nagy", "peter@example.com")
        const token = await portalLogin({
          api,
          container,
          headers,
          repId: id,
          email: "peter@example.com",
        })
        const portal = (bearer: string) =>
          api.get("/sales-portal/me", { headers: { authorization: `Bearer ${bearer}` } })
        expect((await portal(token)).status).toBe(200)

        await remove(id)

        expect((await failure(portal(token))).status).toBe(403)
      })

      it("doesn't keep the email from the next rep, who gets in on their own password", async () => {
        const first = await createRep("Peter Nagy", "peter@example.com")
        await portalLogin({
          api,
          container,
          headers,
          repId: first,
          email: "peter@example.com",
        })
        await remove(first)
        const second = await createRep("Peter Nagy Jr", "peter@example.com")

        const granted = await api.post(
          `/admin/sales-reps/${second}/portal-access`,
          {},
          { headers }
        )

        expect(granted.status).toBe(200)
        // The password the first rep set no longer works
        const old = await failure(
          api.post("/auth/sales_rep/emailpass", {
            email: "peter@example.com",
            password: PORTAL_PASSWORD,
          })
        )
        expect(old.status).toBe(401)
        // The second rep sets their own and sees their own portal
        const token = await portalLogin({
          api,
          container,
          headers,
          repId: second,
          email: "peter@example.com",
          grant: false,
        })
        const { data } = await api.get("/sales-portal/me", {
          headers: { authorization: `Bearer ${token}` },
        })
        expect(data.sales_rep.id).toBe(second)
      })
    })
  },
})
