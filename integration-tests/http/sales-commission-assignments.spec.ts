import { medusaIntegrationTestRunner } from "@medusajs/test-utils"
import { ContainerRegistrationKeys, Modules } from "@medusajs/framework/utils"
import { createAdminHeaders } from "./helpers/admin-auth"

jest.setTimeout(120 * 1000)

medusaIntegrationTestRunner({
  inApp: true,
  env: {},
  testSuite: ({ api, getContainer }) => {
    let headers: Record<string, string>
    let actorId: string
    let customerId: string
    let peterId: string
    let annaId: string

    beforeEach(async () => {
      ;({ headers, actorId } = await createAdminHeaders(getContainer()))

      const customer = await getContainer()
        .resolve(Modules.CUSTOMER)
        .createCustomers({
          email: "buyer@greenoffice.example",
          first_name: "Eva",
          last_name: "Szabo",
          company_name: "Green Office Kft.",
        })
      customerId = customer.id

      const peter = await api.post(
        "/admin/sales-reps",
        { name: "Peter Nagy", email: "peter@example.com" },
        { headers }
      )
      const anna = await api.post(
        "/admin/sales-reps",
        { name: "Anna Kiss", email: "anna@example.com" },
        { headers }
      )
      peterId = peter.data.sales_rep.id
      annaId = anna.data.sales_rep.id
    })

    const assign = (body: Record<string, unknown>, id = customerId) =>
      api.post(`/admin/customers/${id}/sales-rep-assignment`, body, { headers })
    const getAssignment = () =>
      api.get(`/admin/customers/${customerId}/sales-rep-assignment`, {
        headers,
      })

    it("assigns a customer to a rep", async () => {
      await assign({ sales_rep_id: peterId, commission_rate: 10 })

      const { data } = await getAssignment()

      expect(data.current).toEqual(
        expect.objectContaining({
          customer_id: customerId,
          commission_rate: 10,
          ends_at: null,
          created_by: actorId,
          sales_rep: expect.objectContaining({ id: peterId, name: "Peter Nagy" }),
        })
      )
      expect(data.history).toHaveLength(1)
    })

    it("closes the open assignment and opens a new one when the rate changes", async () => {
      await assign({ sales_rep_id: peterId, commission_rate: 10 })
      await assign({ sales_rep_id: peterId, commission_rate: 12.5 })

      const { data } = await getAssignment()
      const [latest, earlier] = data.history

      expect(data.current.commission_rate).toBe(12.5)
      expect(data.history).toHaveLength(2)
      expect(earlier.commission_rate).toBe(10)
      expect(earlier.ends_at).toBe(latest.starts_at)
      expect(earlier.ended_by).toBe(actorId)
    })

    it("moves a client to another rep and keeps the history", async () => {
      await assign({ sales_rep_id: peterId, commission_rate: 10 })
      await assign({ sales_rep_id: annaId, commission_rate: 8 })

      const { data } = await getAssignment()

      expect(data.current.sales_rep.id).toBe(annaId)
      expect(data.history.map((a) => a.sales_rep.id)).toEqual([annaId, peterId])
    })

    it("rejects an inactive rep", async () => {
      await api.post(`/admin/sales-reps/${peterId}`, { is_active: false }, { headers })

      const error = await assign({ sales_rep_id: peterId, commission_rate: 10 })
        .catch((e) => e.response)

      expect(error.status).toBe(400)
    })

    it.each([-1, 100.01])("rejects a rate of %p%%", async (rate) => {
      const error = await assign({ sales_rep_id: peterId, commission_rate: rate })
        .catch((e) => e.response)

      expect(error.status).toBe(400)
    })

    it("rejects an assignment that changes nothing", async () => {
      await assign({ sales_rep_id: peterId, commission_rate: 10 })

      const error = await assign({ sales_rep_id: peterId, commission_rate: 10 })
        .catch((e) => e.response)

      expect(error.status).toBe(400)
    })

    it("returns 404 for an unknown customer", async () => {
      const error = await assign(
        { sales_rep_id: peterId, commission_rate: 10 },
        "cus_missing"
      ).catch((e) => e.response)

      expect(error.status).toBe(404)
    })

    it("ends the current assignment", async () => {
      await assign({ sales_rep_id: peterId, commission_rate: 10 })

      await api.delete(`/admin/customers/${customerId}/sales-rep-assignment`, {
        headers,
      })
      const { data } = await getAssignment()

      expect(data.current).toBeNull()
      expect(data.history[0].ends_at).not.toBeNull()
      expect(data.history[0].ended_by).toBe(actorId)
    })

    it("returns 404 when ending an assignment that does not exist", async () => {
      const error = await api
        .delete(`/admin/customers/${customerId}/sales-rep-assignment`, { headers })
        .catch((e) => e.response)

      expect(error.status).toBe(404)
    })

    it("lists a rep's clients with their company names", async () => {
      await assign({ sales_rep_id: peterId, commission_rate: 10 })

      const { data } = await api.get(`/admin/sales-reps/${peterId}/clients`, {
        headers,
      })

      expect(data.clients).toEqual([
        expect.objectContaining({
          customer_id: customerId,
          commission_rate: 10,
          ends_at: null,
          customer: expect.objectContaining({ company_name: "Green Office Kft." }),
        }),
      ])
    })

    it("links customers to their assignment history", async () => {
      await assign({ sales_rep_id: peterId, commission_rate: 10 })
      await assign({ sales_rep_id: annaId, commission_rate: 8 })

      const query = getContainer().resolve(ContainerRegistrationKeys.QUERY)
      const {
        data: [customer],
      } = await query.graph({
        entity: "customer",
        fields: ["id", "client_assignment.*"],
        filters: { id: customerId },
      })

      expect(customer.client_assignment).toHaveLength(2)
    })
  },
})
