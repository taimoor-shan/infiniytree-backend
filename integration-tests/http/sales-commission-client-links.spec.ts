import { medusaIntegrationTestRunner } from "@medusajs/test-utils"
import { MedusaContainer } from "@medusajs/framework/types"
import { Modules } from "@medusajs/framework/utils"
import { createCustomersWorkflow } from "@medusajs/medusa/core-flows"
import { SalesCommissionEvents } from "medusa-plugin-sales-commission/events"
import { reconcileClientLinks } from "medusa-plugin-sales-commission/jobs/reconcile-client-links"
import {
  CLIENT_LINK_METADATA_KEY,
  claimClientLink,
} from "medusa-plugin-sales-commission/utils/client-links"
import { createAdminHeaders } from "./helpers/admin-auth"
import { createOrder, markOrderPaid, waitFor } from "./helpers/orders"
import { PORTAL_PASSWORD, portalLogin, recordEvents } from "./helpers/portal"

jest.setTimeout(180 * 1000)

const { CLIENT_JOINED, CLIENT_NOT_LINKED, INVITE_SENT } = SalesCommissionEvents
const SHOP = "https://shop.infinytree.test"

// Set here: the test runner applies its `env` option only after medusa-config.ts
// has been read, and the plugin's storefront_url comes from there
process.env.STOREFRONT_PUBLIC_URL = SHOP

medusaIntegrationTestRunner({
  inApp: true,
  env: {},
  testSuite: ({ api, getContainer }) => {
    let container: MedusaContainer
    let headers: Record<string, string>
    let peter: { id: string; code: string }
    let john: { id: string; code: string }
    let events: ReturnType<typeof recordEvents> | undefined
    let publishableKey: string
    let counter = 0

    const service = () => container.resolve("salesCommission")
    const adminGet = (path: string) => api.get(path, { headers })
    const adminPost = (path: string, body = {}) => api.post(path, body, { headers })
    const failure = (promise: Promise<unknown>) =>
      promise.then(
        () => {
          throw new Error("expected the request to fail")
        },
        (e) => e.response
      )
    const eventsOf = (name: string) => (events?.seen ?? []).filter((e) => e.name === name)
    /** Only this customer's: an event that is late from the test before can't be mistaken for it */
    const eventsFor = (name: string, customerId: string) =>
      eventsOf(name).filter((e) => e.data.customer_id === customerId)

    const createRep = async (name: string, email: string, body: Record<string, unknown> = {}) => {
      const { sales_rep } = (await adminPost("/admin/sales-reps", { name, email, ...body })).data
      return { id: sales_rep.id as string, code: sales_rep.client_link_code as string }
    }

    /**
     * A new account, made the way the storefront makes it: Medusa's customer
     * account workflow, with the code in the metadata. Returns the customer.
     */
    const signUp = async (
      code: string | null,
      overrides: Record<string, unknown> = {}
    ): Promise<{ id: string; email: string }> => {
      counter += 1
      const { result } = await createCustomersWorkflow(container).run({
        input: {
          customersData: [
            {
              email: `client${counter}@green.example`,
              first_name: "Eva",
              last_name: "Szabo",
              company_name: `Green Office ${counter} Kft.`,
              has_account: true,
              ...(code === null ? {} : { metadata: { [CLIENT_LINK_METADATA_KEY]: code } }),
              ...overrides,
            },
          ],
        },
      })
      return result[0] as { id: string; email: string }
    }

    /**
     * Lets the subscriber finish with an account that was just made. Tests that
     * add a code to an account afterwards, as a lost sign-up event looks, must
     * not have the subscriber arrive late and see it.
     */
    const settle = () => new Promise((resolve) => setTimeout(resolve, 600))

    /** The claim the subscriber wrote for a customer */
    const claimOf = (customerId: string) =>
      waitFor(async () => (await service().listLinkClaims({ customer_id: customerId }))[0])
    const assignmentsOf = (customerId: string) =>
      service().listClientAssignments({ customer_id: customerId })

    beforeEach(async () => {
      container = getContainer()
      ;({ headers } = await createAdminHeaders(container))
      if (!events) {
        events = recordEvents(container, [CLIENT_JOINED, CLIENT_NOT_LINKED, INVITE_SENT])
      }
      events.clear()
      counter = 0

      const user = await container.resolve(Modules.USER).createUsers({ email: "keys@infinytree.test" })
      const key = await container
        .resolve(Modules.API_KEY)
        .createApiKeys({ title: "storefront", type: "publishable", created_by: user.id })
      publishableKey = key.token

      john = await createRep("John Smith", "john@example.com", { default_client_rate: 8 })
      peter = await createRep("Peter Nagy", "peter@example.com", { default_client_rate: 10 })
      await adminPost(`/admin/sales-reps/${peter.id}/referral`, {
        referrer_sales_rep_id: john.id,
        level2_rate: 5,
      })
    })

    describe("a rep's link", () => {
      it("exists from the day the rep is made, with a code that reads out loud", async () => {
        expect(peter.code).toMatch(/^[ABCDEFGHJKMNPQRSTUVWXYZ2-9]{8}$/)
        expect(john.code).not.toBe(peter.code)

        const { client_link } = (await adminGet(`/admin/sales-reps/${peter.id}/client-link`)).data

        expect(client_link).toEqual(
          expect.objectContaining({
            code: peter.code,
            link: `${SHOP}/?ref=${peter.code}`,
            active: true,
            reason: null,
            rate: 10,
            claims: [],
          })
        )
      })

      it("keeps the standard rate and refuses one outside 0 to 100", async () => {
        const rep = (await adminGet(`/admin/sales-reps/${peter.id}`)).data.sales_rep
        expect(rep.default_client_rate).toBe(10)

        await adminPost(`/admin/sales-reps/${peter.id}`, { default_client_rate: 7.5 })
        expect(
          (await adminGet(`/admin/sales-reps/${peter.id}`)).data.sales_rep.default_client_rate
        ).toBe(7.5)

        for (const default_client_rate of [-1, 100.5, "ten"]) {
          const response = await failure(
            adminPost(`/admin/sales-reps/${peter.id}`, { default_client_rate })
          )
          expect(response.status).toBe(400)
        }

        await adminPost(`/admin/sales-reps/${peter.id}`, { default_client_rate: null })
        expect(
          (await adminGet(`/admin/sales-reps/${peter.id}`)).data.sales_rep.default_client_rate
        ).toBeNull()
      })

      it("is off without a rate, or while the rep is deactivated, and says why", async () => {
        await adminPost(`/admin/sales-reps/${peter.id}`, { default_client_rate: null })
        let { client_link } = (await adminGet(`/admin/sales-reps/${peter.id}/client-link`)).data
        expect(client_link).toEqual(expect.objectContaining({ active: false, reason: "no_rate", rate: null }))

        await adminPost(`/admin/sales-reps/${peter.id}`, { default_client_rate: 10, is_active: false })
        ;({ client_link } = (await adminGet(`/admin/sales-reps/${peter.id}/client-link`)).data)
        expect(client_link).toEqual(expect.objectContaining({ active: false, reason: "rep_inactive" }))
      })

      it("is replaced by a new one, and the old link stops working at once", async () => {
        const { client_link } = (await adminPost(`/admin/sales-reps/${peter.id}/client-link`)).data

        expect(client_link.code).not.toBe(peter.code)
        expect(client_link.link).toBe(`${SHOP}/?ref=${client_link.code}`)

        const old = await signUp(peter.code)
        expect((await claimOf(old.id)).outcome).toBe("unknown_code")
        const fresh = await signUp(client_link.code)
        expect((await claimOf(fresh.id)).outcome).toBe("credited")
      })

      it("is made for a rep from before client links the first time the owner looks, and kept after", async () => {
        await service().updateSalesReps({ id: peter.id, client_link_code: null })

        const first = (await adminGet(`/admin/sales-reps/${peter.id}/client-link`)).data.client_link
        expect(first.code).toMatch(/^[ABCDEFGHJKMNPQRSTUVWXYZ2-9]{8}$/)
        expect(first.link).toBe(`${SHOP}/?ref=${first.code}`)

        const second = (await adminGet(`/admin/sales-reps/${peter.id}/client-link`)).data.client_link
        expect(second.code).toBe(first.code)
        expect((await service().retrieveSalesRep(peter.id)).client_link_code).toBe(first.code)
      })

      it("is looked up for a rep who exists, and for nobody else", async () => {
        const missing = await failure(adminGet("/admin/sales-reps/srep_missing/client-link"))
        expect(missing.status).toBe(404)

        const regenerate = await failure(adminPost("/admin/sales-reps/srep_missing/client-link"))
        expect(regenerate.status).toBe(404)
      })
    })

    describe("the public lookup", () => {
      it("shows whose link it is, however the code is typed", async () => {
        for (const typed of [peter.code, peter.code.toLowerCase(), ` ${peter.code.slice(0, 4)}-${peter.code.slice(4)} `]) {
          const response = await api.get(`/sales-links/${encodeURIComponent(typed)}`)

          expect(response.status).toBe(200)
          expect(response.data).toEqual({ link: { rep_name: "Peter Nagy" } })
          expect(response.headers["cache-control"]).toBe("no-store")
        }
      })

      it("answers the same for a code nobody has, a malformed one, and a rep who is deactivated", async () => {
        await adminPost(`/admin/sales-reps/${john.id}`, { is_active: false })

        for (const code of ["ZZZZZZZZ", "x", "no spaces?!", john.code]) {
          const response = await failure(api.get(`/sales-links/${encodeURIComponent(code)}`))

          expect(response.status).toBe(404)
          expect(response.data).toEqual(expect.objectContaining({ code: "link_invalid" }))
        }
      })
    })

    describe("a new client who follows the link", () => {
      it("is linked to the rep at the standard rate, and the rep is told", async () => {
        const client = await signUp(peter.code)

        const claim = await claimOf(client.id)
        const [assignment] = await assignmentsOf(client.id)

        expect(claim).toEqual(
          expect.objectContaining({
            outcome: "credited",
            code: peter.code,
            sales_rep_id: peter.id,
            assignment_id: assignment.id,
            client_email: client.email,
          })
        )
        expect(assignment).toEqual(
          expect.objectContaining({
            sales_rep_id: peter.id,
            customer_id: client.id,
            commission_rate: 10,
            source: "link",
            link_code: peter.code,
            ends_at: null,
            created_by: null,
          })
        )

        const joined = await waitFor(async () => eventsFor(CLIENT_JOINED, client.id)[0])
        expect(joined.data).toEqual(
          expect.objectContaining({
            customer_id: client.id,
            rep_name: "Peter Nagy",
            rep_email: "peter@example.com",
            rate: 10,
            locale: null,
          })
        )
        expect(eventsFor(CLIENT_NOT_LINKED, client.id)).toHaveLength(0)
      })

      it("is linked when they sign up through the store API, as the storefront does", async () => {
        const email = "walk-in@green.example"
        const { token } = (await api.post("/auth/customer/emailpass/register", {
          email,
          password: PORTAL_PASSWORD,
        })).data
        const created = await api.post(
          "/store/customers",
          {
            email,
            first_name: "Eva",
            last_name: "Szabo",
            company_name: "Walk-in Kft.",
            metadata: { [CLIENT_LINK_METADATA_KEY]: peter.code },
          },
          {
            headers: {
              authorization: `Bearer ${token}`,
              "x-publishable-api-key": publishableKey,
            },
          }
        )

        const customerId = created.data.customer.id
        expect((await claimOf(customerId)).outcome).toBe("credited")
        expect((await adminGet(`/admin/customers/${customerId}/sales-rep-assignment`)).data.current).toEqual(
          expect.objectContaining({
            commission_rate: 10,
            source: "link",
            sales_rep: expect.objectContaining({ id: peter.id }),
          })
        )
      })

      it("earns the rep commission, and Level 2 for the rep above, on every paid order", async () => {
        const client = await signUp(peter.code)
        await claimOf(client.id)

        const order = await createOrder(container, client)
        await markOrderPaid(container, order.id)
        const entries = await waitFor(async () => {
          const found = await service().listCommissionEntries({ order_id: order.id }, { order: { type: "ASC" } })
          return found.length === 2 && found
        })

        expect(entries.map((e) => [e.type, e.sales_rep_id, e.rate, e.amount])).toEqual([
          ["direct", peter.id, 10, 18],
          ["level2", john.id, 5, 9],
        ])
      })

      it("is read from a code typed any way: upper or lower case, with spaces or hyphens", async () => {
        const typed = ` ${peter.code.slice(0, 4).toLowerCase()}-${peter.code.slice(4).toLowerCase()} `
        const client = await signUp(typed)

        const claim = await claimOf(client.id)
        expect(claim).toEqual(expect.objectContaining({ outcome: "credited", code: peter.code }))
      })

      it("is nobody's when no rep has the code, and nobody is told", async () => {
        const client = await signUp("ZZZZZZZZ")

        const claim = await claimOf(client.id)
        expect(claim).toEqual(
          expect.objectContaining({ outcome: "unknown_code", sales_rep_id: null, assignment_id: null })
        )
        expect(await assignmentsOf(client.id)).toHaveLength(0)
        expect(eventsFor(CLIENT_JOINED, client.id)).toHaveLength(0)
        expect(eventsFor(CLIENT_NOT_LINKED, client.id)).toHaveLength(0)
      })

      it("is ignored when what came with them isn't shaped like a code, or when there is none", async () => {
        for (const junk of ["x", "<script>", "a".repeat(40), ""]) {
          const client = await signUp(junk)
          expect(await claimClientLink(container, client.id)).toEqual({ status: "no_code" })
          expect(await service().listLinkClaims({ customer_id: client.id })).toHaveLength(0)
        }
        const plain = await signUp(null)
        expect(await claimClientLink(container, plain.id)).toEqual({ status: "no_code" })
        expect(await claimClientLink(container, "cus_missing")).toEqual({ status: "no_customer" })
      })

      it("is not linked when they only checked out as a guest", async () => {
        const guest = await signUp(peter.code, { has_account: false })

        expect(await claimClientLink(container, guest.id)).toEqual({ status: "no_account" })
        expect(await service().listLinkClaims({ customer_id: guest.id })).toHaveLength(0)
        expect(await assignmentsOf(guest.id)).toHaveLength(0)
      })

      it("is not linked while the rep is deactivated, and the owner is told", async () => {
        await adminPost(`/admin/sales-reps/${peter.id}`, { is_active: false })
        const client = await signUp(peter.code)

        expect((await claimOf(client.id)).outcome).toBe("rep_inactive")
        expect(await assignmentsOf(client.id)).toHaveLength(0)
        const event = await waitFor(async () => eventsFor(CLIENT_NOT_LINKED, client.id)[0])
        expect(event.data).toEqual(
          expect.objectContaining({ customer_id: client.id, rep_name: "Peter Nagy", outcome: "rep_inactive" })
        )
        expect(eventsFor(CLIENT_JOINED, client.id)).toHaveLength(0)
      })

      it("is not linked while the rep has no standard rate, the owner is told, and a rate set later changes nothing", async () => {
        await adminPost(`/admin/sales-reps/${peter.id}`, { default_client_rate: null })
        const client = await signUp(peter.code)

        expect((await claimOf(client.id)).outcome).toBe("no_rate")
        const event = await waitFor(async () => eventsFor(CLIENT_NOT_LINKED, client.id)[0])
        expect(event.data.outcome).toBe("no_rate")

        // The answer stands: setting a rate doesn't pull them in afterwards ...
        await adminPost(`/admin/sales-reps/${peter.id}`, { default_client_rate: 10 })
        expect(await claimClientLink(container, client.id)).toEqual(
          expect.objectContaining({ status: "handled" })
        )
        expect(await assignmentsOf(client.id)).toHaveLength(0)

        // ... the owner assigns them by hand, as for any customer
        await adminPost(`/admin/customers/${client.id}/sales-rep-assignment`, {
          sales_rep_id: peter.id,
          commission_rate: 12,
        })
        const [assignment] = await assignmentsOf(client.id)
        expect(assignment).toEqual(
          expect.objectContaining({ source: "admin", link_code: null, commission_rate: 12 })
        )
      })

      it("is not linked to a rep on their own account, however the email is written", async () => {
        const own = await signUp(peter.code, { email: "PETER@example.com" })

        expect((await claimOf(own.id)).outcome).toBe("own_account")
        const event = await waitFor(async () => eventsFor(CLIENT_NOT_LINKED, own.id)[0])
        expect(event.data.outcome).toBe("own_account")
        expect(await assignmentsOf(own.id)).toHaveLength(0)
      })

      it("is not linked when the person already ordered here under the same email", async () => {
        const guest = await container.resolve(Modules.CUSTOMER).createCustomers({
          email: "returning@green.example",
          company_name: "Returning Kft.",
          has_account: false,
        })
        await createOrder(container, guest)

        const client = await signUp(peter.code, { email: "Returning@Green.example" })

        expect((await claimOf(client.id)).outcome).toBe("existing_client")
        expect(await assignmentsOf(client.id)).toHaveLength(0)
        // Nobody is told: this is not a client who should have been linked
        expect(eventsFor(CLIENT_NOT_LINKED, client.id)).toHaveLength(0)
        expect(eventsFor(CLIENT_JOINED, client.id)).toHaveLength(0)
      })

      it("is not taken from the rep they already have", async () => {
        const anna = await createRep("Anna Kiss", "anna@example.com", { default_client_rate: 9 })
        const earlier = await container.resolve(Modules.CUSTOMER).createCustomers({
          email: "kept@green.example",
          company_name: "Kept Kft.",
          has_account: false,
        })
        await adminPost(`/admin/customers/${earlier.id}/sales-rep-assignment`, {
          sales_rep_id: anna.id,
          commission_rate: 9,
        })

        const client = await signUp(peter.code, { email: "kept@green.example" })

        expect((await claimOf(client.id)).outcome).toBe("existing_client")
        expect(await assignmentsOf(client.id)).toHaveLength(0)
        const kept = await assignmentsOf(earlier.id)
        expect(kept).toHaveLength(1)
        expect(kept[0]).toEqual(expect.objectContaining({ sales_rep_id: anna.id, ends_at: null }))
      })

      it("is never an existing customer who adds a code to their account later", async () => {
        const existing = await signUp(null)
        await settle()
        await createOrder(container, existing)
        await container
          .resolve(Modules.CUSTOMER)
          .updateCustomers(existing.id, { metadata: { [CLIENT_LINK_METADATA_KEY]: peter.code } })

        await reconcileClientLinks(container, { since: new Date(Date.now() - 86_400_000) })

        const claims = await service().listLinkClaims({ customer_id: existing.id })
        expect(claims.map((c) => c.outcome)).toEqual(["existing_client"])
        expect(await assignmentsOf(existing.id)).toHaveLength(0)
      })

      it("is answered once: the same sign-up handled again changes nothing", async () => {
        const client = await signUp(peter.code)
        await claimOf(client.id)
        await waitFor(async () => eventsFor(CLIENT_JOINED, client.id).length === 1)

        const again = await claimClientLink(container, client.id)
        const concurrently = await Promise.all([
          claimClientLink(container, client.id),
          claimClientLink(container, client.id),
        ])

        expect(again.status).toBe("handled")
        expect(concurrently.map((r) => r.status)).toEqual(["handled", "handled"])
        expect(await service().listLinkClaims({ customer_id: client.id })).toHaveLength(1)
        expect(await assignmentsOf(client.id)).toHaveLength(1)
        expect(eventsFor(CLIENT_JOINED, client.id)).toHaveLength(1)
      })

      it("is not taken over by a second link followed later", async () => {
        const client = await signUp(peter.code)
        await claimOf(client.id)
        await container
          .resolve(Modules.CUSTOMER)
          .updateCustomers(client.id, { metadata: { [CLIENT_LINK_METADATA_KEY]: john.code } })

        await reconcileClientLinks(container, { since: new Date(Date.now() - 86_400_000) })

        const [assignment] = await assignmentsOf(client.id)
        expect(assignment.sales_rep_id).toBe(peter.id)
        expect(await service().listLinkClaims({ customer_id: client.id })).toHaveLength(1)
      })

      it("is linked by the nightly job when the sign-up event was lost, and only those with a code", async () => {
        // Created without a code (no claim), then given one without a creation event: as a lost event looks
        const lost = await signUp(null)
        const plain = await signUp(null)
        await settle()
        await container
          .resolve(Modules.CUSTOMER)
          .updateCustomers(lost.id, { metadata: { [CLIENT_LINK_METADATA_KEY]: peter.code } })
        expect(await service().listLinkClaims({ customer_id: lost.id })).toHaveLength(0)

        const result = await reconcileClientLinks(container, { since: new Date(Date.now() - 86_400_000) })

        expect(result).toEqual({ claimed: 1 })
        expect((await claimOf(lost.id)).outcome).toBe("credited")
        expect(await service().listLinkClaims({ customer_id: plain.id })).toHaveLength(0)

        // Running it again finds nothing new
        expect(await reconcileClientLinks(container, { since: new Date(Date.now() - 86_400_000) })).toEqual({
          claimed: 0,
        })
      })

      it("finishes a claim whose assignment was made but whose record was not written", async () => {
        const client = await signUp(null)
        await settle()
        await container
          .resolve(Modules.CUSTOMER)
          .updateCustomers(client.id, { metadata: { [CLIENT_LINK_METADATA_KEY]: peter.code } })
        // What a crash between the two steps leaves: the assignment, no claim
        await service().createClientAssignments({
          sales_rep_id: peter.id,
          customer_id: client.id,
          commission_rate: 10,
          starts_at: new Date(Date.now() - 3_600_000),
          source: "link",
          link_code: peter.code,
        })

        const result = await claimClientLink(container, client.id)

        expect(result).toEqual(expect.objectContaining({ status: "claimed", outcome: "credited" }))
        const [claim] = await service().listLinkClaims({ customer_id: client.id })
        const assignments = await assignmentsOf(client.id)
        expect(assignments).toHaveLength(1)
        expect(claim.assignment_id).toBe(assignments[0].id)
      })
    })

    describe("what the rep sees", () => {
      let token: string

      beforeEach(async () => {
        token = await portalLogin({
          api,
          container,
          headers,
          repId: peter.id,
          email: "peter@example.com",
        })
      })

      const portal = (path = "/sales-portal/client-link") =>
        api.get(path, { headers: { authorization: `Bearer ${token}` } })

      it("needs a signed-in rep", async () => {
        expect((await failure(api.get("/sales-portal/client-link"))).status).toBe(401)
      })

      it("shows the code and how far each client who came through the link has got", async () => {
        const client = await signUp(peter.code)
        await claimOf(client.id)

        let view = (await portal()).data.client_link
        expect(view).toEqual(
          expect.objectContaining({
            code: peter.code,
            active: true,
            reason: null,
            rate: 10,
            summary: { registered: 1, ordered: 0, paid: 0 },
          })
        )
        expect(view.referred).toEqual([
          expect.objectContaining({ name: "Green Office 1 Kft.", status: "registered" }),
        ])

        const order = await createOrder(container, client)
        view = (await portal()).data.client_link
        expect(view.summary).toEqual({ registered: 0, ordered: 1, paid: 0 })

        await markOrderPaid(container, order.id)
        await waitFor(async () => (await service().listCommissionEntries({ order_id: order.id })).length > 0)
        view = (await portal()).data.client_link
        expect(view.summary).toEqual({ registered: 0, ordered: 0, paid: 1 })
      })

      it("shows only clients who came through the link, and never what identifies them", async () => {
        const viaLink = await signUp(peter.code)
        await claimOf(viaLink.id)
        const byHand = await signUp(null)
        await adminPost(`/admin/customers/${byHand.id}/sales-rep-assignment`, {
          sales_rep_id: peter.id,
          commission_rate: 10,
        })
        const johns = await signUp(john.code)
        await claimOf(johns.id)

        const { referred } = (await portal()).data.client_link

        expect(referred).toHaveLength(1)
        expect(Object.keys(referred[0]).sort()).toEqual(["id", "joined_at", "name", "status"])
        expect(JSON.stringify(referred)).not.toContain("@green.example")
      })

      it("drops a client the owner moved to another rep", async () => {
        const client = await signUp(peter.code)
        await claimOf(client.id)
        await adminPost(`/admin/customers/${client.id}/sales-rep-assignment`, {
          sales_rep_id: john.id,
          commission_rate: 8,
        })

        expect((await portal()).data.client_link.referred).toHaveLength(0)
      })

      it("says when the link is off, and why", async () => {
        await adminPost(`/admin/sales-reps/${peter.id}`, { default_client_rate: null })

        expect((await portal()).data.client_link).toEqual(
          expect.objectContaining({ active: false, reason: "no_rate", rate: null })
        )
      })

      it("makes the code on the first visit for a rep who has none, and keeps it after", async () => {
        await service().updateSalesReps({ id: peter.id, client_link_code: null })

        const first = (await portal()).data.client_link.code
        const second = (await portal()).data.client_link.code

        expect(first).toMatch(/^[A-Z0-9]{8}$/)
        expect(second).toBe(first)
      })

      it("remembers the language of the portal, so the rep's emails come in it", async () => {
        await portal("/sales-portal/client-link?locale=hu-HU")
        const client = await signUp(peter.code)
        await claimOf(client.id)

        const joined = await waitFor(async () => eventsFor(CLIENT_JOINED, client.id)[0])
        expect(joined.data.locale).toBe("hu-HU")
        expect((await service().retrieveSalesRep(peter.id)).locale).toBe("hu-HU")

        // Something that isn't a language tag is not remembered
        await portal("/sales-portal/client-link?locale=not%20a%20language")
        expect((await service().retrieveSalesRep(peter.id)).locale).toBe("hu-HU")
      })
    })


    describe("a rep who joins by invitation", () => {
      /** Peter invites Gabor, who applies. Returns the application's id. */
      const gaborApplies = async () => {
        const token = await portalLogin({
          api,
          container,
          headers,
          repId: peter.id,
          email: "peter@example.com",
        })
        const invited = await api.post(
          "/sales-portal/recruits",
          { name: "Gabor Szabo", email: "gabor@example.com", locale: "hu-HU" },
          { headers: { authorization: `Bearer ${token}` } }
        )
        const id = invited.data.recruit.id as string
        const sent = await waitFor(async () =>
          eventsOf(INVITE_SENT).find((e) => e.data.invite_id === id)
        )
        await api.post(`/sales-invites/${sent.data.token}/apply`, {
          name: "Szabó Gábor",
          phone: "+36 30 555 0142",
          company: "Szabó Bt.",
          requested_currency_code: "HUF",
          accept_terms: true,
        })

        return id
      }
      const approve = (id: string, body: Record<string, unknown> = {}) =>
        adminPost(`/admin/sales-commission/applications/${id}/approve`, {
          level2_rate: 2,
          level2_months: 24,
          payout_currency_code: null,
          ...body,
        })

      it("gets a link of their own, the rate the owner chose, and their language", async () => {
        const id = await gaborApplies()

        await approve(id, { client_rate: 7.5 })

        const [gabor] = await service().listSalesReps({ email: "gabor@example.com" })
        expect(Number(gabor.default_client_rate)).toBe(7.5)
        expect(gabor.client_link_code).toMatch(/^[ABCDEFGHJKMNPQRSTUVWXYZ2-9]{8}$/)
        expect(gabor.client_link_code).not.toBe(peter.code)
        expect(gabor.locale).toBe("hu-HU")

        // The first client through his link is credited at his rate, not Peter's
        const client = await signUp(gabor.client_link_code)
        expect((await claimOf(client.id)).outcome).toBe("credited")
        const [assignment] = await assignmentsOf(client.id)
        expect(assignment).toEqual(
          expect.objectContaining({ sales_rep_id: gabor.id, commission_rate: 7.5, source: "link" })
        )
      })

      it("keeps the link off until the owner sets a rate, when the approval has none", async () => {
        const id = await gaborApplies()

        await approve(id)

        const [gabor] = await service().listSalesReps({ email: "gabor@example.com" })
        expect(gabor.default_client_rate).toBeNull()
        expect(gabor.client_link_code).toMatch(/^[A-Z0-9]{8}$/)

        const client = await signUp(gabor.client_link_code)
        expect((await claimOf(client.id)).outcome).toBe("no_rate")
        expect(await assignmentsOf(client.id)).toHaveLength(0)
      })

      it("refuses a rate outside 0 to 100", async () => {
        const id = await gaborApplies()

        const response = await failure(approve(id, { client_rate: 101 }))

        expect(response.status).toBe(400)
        expect(await service().listSalesReps({ email: "gabor@example.com" })).toHaveLength(0)
      })
    })

    describe("what the owner sees", () => {
      it("lists who came through the link and what became of each, newest first", async () => {
        const first = await signUp(peter.code)
        await claimOf(first.id)
        await adminPost(`/admin/sales-reps/${peter.id}`, { default_client_rate: null })
        const second = await signUp(peter.code)
        await claimOf(second.id)

        const { client_link } = (await adminGet(`/admin/sales-reps/${peter.id}/client-link`)).data

        expect(client_link.claims.map((c) => [c.client_email, c.outcome])).toEqual([
          [second.email, "no_rate"],
          [first.email, "credited"],
        ])
      })

      it("says on the rep's clients which came through the link", async () => {
        const viaLink = await signUp(peter.code)
        await claimOf(viaLink.id)
        const byHand = await signUp(null)
        await adminPost(`/admin/customers/${byHand.id}/sales-rep-assignment`, {
          sales_rep_id: peter.id,
          commission_rate: 10,
        })

        const { clients } = (await adminGet(`/admin/sales-reps/${peter.id}/clients`)).data

        expect(Object.fromEntries(clients.map((c) => [c.customer_id, c.source]))).toEqual({
          [viaLink.id]: "link",
          [byHand.id]: "admin",
        })
      })

      it("refuses to delete a rep who has clients from the link", async () => {
        const client = await signUp(peter.code)
        await claimOf(client.id)

        const response = await failure(api.delete(`/admin/sales-reps/${peter.id}`, { headers }))

        expect(response.status).toBe(400)
        expect(response.data.code).toBe("rep_delete_blocked")
      })
    })
  },
})
