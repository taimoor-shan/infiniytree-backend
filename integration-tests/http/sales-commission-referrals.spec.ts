import { medusaIntegrationTestRunner } from "@medusajs/test-utils"
import { createAdminHeaders } from "./helpers/admin-auth"

jest.setTimeout(120 * 1000)

medusaIntegrationTestRunner({
  inApp: true,
  env: {},
  testSuite: ({ api, getContainer }) => {
    let headers: Record<string, string>
    let actorId: string
    let johnId: string
    let peterId: string
    let annaId: string

    beforeEach(async () => {
      ;({ headers, actorId } = await createAdminHeaders(getContainer()))

      const create = async (name: string, email: string) =>
        (await api.post("/admin/sales-reps", { name, email }, { headers })).data
          .sales_rep.id
      johnId = await create("John Smith", "john@example.com")
      peterId = await create("Peter Nagy", "peter@example.com")
      annaId = await create("Anna Kiss", "anna@example.com")
    })

    const setReferrer = (repId: string, body: Record<string, unknown>) =>
      api.post(`/admin/sales-reps/${repId}/referral`, body, { headers })
    const getRep = (repId: string) =>
      api.get(`/admin/sales-reps/${repId}`, { headers })

    it("links a rep to their referrer with a Level 2 rate", async () => {
      await setReferrer(peterId, { referrer_sales_rep_id: johnId, level2_rate: 5 })

      const peter = (await getRep(peterId)).data
      const john = (await getRep(johnId)).data

      expect(peter.referral).toEqual(
        expect.objectContaining({
          level2_rate: 5,
          ends_at: null,
          created_by: actorId,
          referrer: expect.objectContaining({ id: johnId, name: "John Smith" }),
        })
      )
      expect(john.referred_reps).toEqual([
        expect.objectContaining({
          level2_rate: 5,
          referred: expect.objectContaining({ id: peterId, name: "Peter Nagy" }),
        }),
      ])
    })

    it("replaces the referrer and keeps the previous link on record", async () => {
      await setReferrer(peterId, { referrer_sales_rep_id: johnId, level2_rate: 5 })
      await setReferrer(peterId, { referrer_sales_rep_id: annaId, level2_rate: 4 })

      const peter = (await getRep(peterId)).data
      const john = (await getRep(johnId)).data

      expect(peter.referral.referrer.id).toBe(annaId)
      expect(peter.referral.level2_rate).toBe(4)
      expect(john.referred_reps).toEqual([])
    })

    it("rejects a rep referring themselves", async () => {
      const error = await setReferrer(peterId, {
        referrer_sales_rep_id: peterId,
        level2_rate: 5,
      }).catch((e) => e.response)

      expect(error.status).toBe(400)
    })

    it("rejects a referral loop", async () => {
      await setReferrer(peterId, { referrer_sales_rep_id: johnId, level2_rate: 5 })

      const error = await setReferrer(johnId, {
        referrer_sales_rep_id: peterId,
        level2_rate: 5,
      }).catch((e) => e.response)

      expect(error.status).toBe(400)
    })

    it("rejects a referral that changes nothing", async () => {
      await setReferrer(peterId, { referrer_sales_rep_id: johnId, level2_rate: 5 })

      const error = await setReferrer(peterId, {
        referrer_sales_rep_id: johnId,
        level2_rate: 5,
      }).catch((e) => e.response)

      expect(error.status).toBe(400)
    })

    it("rejects an inactive referrer", async () => {
      await api.post(`/admin/sales-reps/${johnId}`, { is_active: false }, { headers })

      const error = await setReferrer(peterId, {
        referrer_sales_rep_id: johnId,
        level2_rate: 5,
      }).catch((e) => e.response)

      expect(error.status).toBe(400)
    })

    it("rejects a Level 2 rate above 100%", async () => {
      const error = await setReferrer(peterId, {
        referrer_sales_rep_id: johnId,
        level2_rate: 101,
      }).catch((e) => e.response)

      expect(error.status).toBe(400)
    })

    it("returns 404 for an unknown referrer", async () => {
      const error = await setReferrer(peterId, {
        referrer_sales_rep_id: "srep_missing",
        level2_rate: 5,
      }).catch((e) => e.response)

      expect(error.status).toBe(404)
    })

    it("ends a referral", async () => {
      await setReferrer(peterId, { referrer_sales_rep_id: johnId, level2_rate: 5 })

      await api.delete(`/admin/sales-reps/${peterId}/referral`, { headers })

      expect((await getRep(peterId)).data.referral).toBeNull()
    })

    it("returns 404 when ending a referral that does not exist", async () => {
      const error = await api
        .delete(`/admin/sales-reps/${peterId}/referral`, { headers })
        .catch((e) => e.response)

      expect(error.status).toBe(404)
    })
  },
})
