import { medusaIntegrationTestRunner } from "@medusajs/test-utils"
import { MedusaContainer } from "@medusajs/framework/types"
import { Modules } from "@medusajs/framework/utils"
import { SalesCommissionEvents } from "medusa-plugin-sales-commission/events"
import {
  hashInviteToken,
  monthsFrom,
} from "medusa-plugin-sales-commission/lib/invite"
import { createAdminHeaders } from "./helpers/admin-auth"
import { createOrder, markOrderPaid, waitFor } from "./helpers/orders"
import {
  jwtPayload,
  PORTAL_PASSWORD,
  portalLogin,
  recordEvents,
} from "./helpers/portal"

jest.setTimeout(180 * 1000)

const DAY = 86_400_000
const TIMEZONE = "Europe/Budapest"
const { INVITE_SENT, APPLICATION_RECEIVED, APPLICATION_APPROVED, APPLICATION_DECLINED } =
  SalesCommissionEvents

medusaIntegrationTestRunner({
  inApp: true,
  env: {},
  testSuite: ({ api, getContainer }) => {
    let container: MedusaContainer
    let headers: Record<string, string>
    let actorId: string
    let peterId: string
    let johnId: string
    let tokens: { peter: string; john: string }
    let events: ReturnType<typeof recordEvents> | undefined

    const service = () => container.resolve("salesCommission")
    const bearer = (token: string) => ({ headers: { authorization: `Bearer ${token}` } })
    const failure = (promise: Promise<unknown>) =>
      promise.then(
        () => {
          throw new Error("expected the request to fail")
        },
        (e) => e.response
      )

    // The portal, as a signed-in rep
    const portalGet = (path: string, token = tokens.peter) => api.get(path, bearer(token))
    const portalPost = (path: string, body = {}, token = tokens.peter) =>
      api.post(path, body, bearer(token))
    const portalDelete = (path: string, token = tokens.peter) => api.delete(path, bearer(token))

    // The owner, in the admin
    const adminGet = (path: string) => api.get(path, { headers })
    const adminPost = (path: string, body = {}) => api.post(path, body, { headers })

    const eventsOf = (name: string) => (events?.seen ?? []).filter((e) => e.name === name)
    const nthEvent = (name: string, count: number) =>
      waitFor(async () => eventsOf(name).length >= count && eventsOf(name)[count - 1])
    const linkTokenOf = async (inviteId: string, count = 1) =>
      (
        await waitFor(async () => {
          const sent = eventsOf(INVITE_SENT).filter((e) => e.data.invite_id === inviteId)
          return sent.length >= count && sent[count - 1]
        })
      ).data.token as string

    const invite = (body: Record<string, unknown> = {}, token = tokens.peter) =>
      portalPost(
        "/sales-portal/recruits",
        {
          name: "Gabor Szabo",
          email: "gabor@example.com",
          note: "Met at the fair",
          locale: "hu-HU",
          ...body,
        },
        token
      )
    const apply = (token: string, body: Record<string, unknown> = {}) =>
      api.post(`/sales-invites/${token}/apply`, {
        name: "Szabó Gábor",
        phone: "+36 30 555 0142",
        company: "Szabó Bt.",
        requested_currency_code: "HUF",
        accept_terms: true,
        ...body,
      })
    /** Peter invites Gabor, who applies. Returns the invite's id and link token. */
    const applied = async (body: Record<string, unknown> = {}) => {
      const id = (await invite()).data.recruit.id as string
      const token = await linkTokenOf(id)
      await apply(token, body)
      return { id, token }
    }
    const approve = (id: string, body: Record<string, unknown> = {}) =>
      adminPost(`/admin/sales-commission/applications/${id}/approve`, {
        level2_rate: 2,
        level2_months: 24,
        payout_currency_code: null,
        ...body,
      })
    const decline = (id: string, body: Record<string, unknown> = {}) =>
      adminPost(`/admin/sales-commission/applications/${id}/decline`, {
        reason: "Not the right fit for the team",
        ...body,
      })

    const authModule = () => container.resolve(Modules.AUTH)
    const identityOf = async (email: string) =>
      (
        await authModule().listAuthIdentities({
          provider_identities: { provider: "emailpass", entity_id: email },
        })
      )[0]
    /** A login someone registered through Medusa's public register route */
    const registerLogin = async (actor: string, email: string) => {
      const { data } = await api.post(`/auth/${actor}/emailpass/register`, {
        email,
        password: PORTAL_PASSWORD,
      })
      return jwtPayload(data.token).auth_identity_id as string
    }

    beforeEach(async () => {
      container = getContainer()
      ;({ headers, actorId } = await createAdminHeaders(container))
      events ??= recordEvents(container, Object.values(SalesCommissionEvents))
      events.clear()

      const createRep = async (name: string, email: string) =>
        (await adminPost("/admin/sales-reps", { name, email })).data.sales_rep.id as string
      peterId = await createRep("Peter Nagy", "peter@example.com")
      johnId = await createRep("John Smith", "john@example.com")
      const login = (repId: string, email: string) =>
        portalLogin({ api, container, headers, repId, email })
      tokens = {
        peter: await login(peterId, "peter@example.com"),
        john: await login(johnId, "john@example.com"),
      }
    })

    describe("inviting from the portal", () => {
      it("emails the candidate a personal link and lists the invite", async () => {
        const { data, status } = await invite()

        expect(status).toBe(201)
        expect(data.recruit).toEqual(
          expect.objectContaining({
            name: "Gabor Szabo",
            email: "gabor@example.com",
            status: "invited",
            note: "Met at the fair",
            level2_rate: null,
            level2_this_month: [],
          })
        )
        const days = (Date.parse(data.recruit.expires_at) - Date.now()) / DAY
        expect(days).toBeGreaterThan(13.9)
        expect(days).toBeLessThanOrEqual(14)
        expect(data.limits).toEqual({ open_invites: 1, max_open_invites: 20, invite_days: 14 })

        const sent = (await nthEvent(INVITE_SENT, 1)).data
        expect(sent).toEqual({
          invite_id: data.recruit.id,
          email: "gabor@example.com",
          name: "Gabor Szabo",
          token: expect.stringMatching(/^[A-Za-z0-9_-]{43}$/),
          expires_at: data.recruit.expires_at,
          recruiter_name: "Peter Nagy",
          locale: "hu-HU",
        })
      })

      it("keeps only the token's hash, and never hands the link to the recruiter", async () => {
        const { data } = await invite()
        const token = await linkTokenOf(data.recruit.id)

        const [stored] = await service().listRepInvites({ id: data.recruit.id })
        const listed = await portalGet("/sales-portal/recruits")

        expect(stored.token_hash).toBe(hashInviteToken(token))
        expect(stored.token_hash).not.toBe(token)
        for (const body of [data, listed.data]) {
          expect(JSON.stringify(body)).not.toContain(token)
          expect(JSON.stringify(body)).not.toContain(stored.token_hash)
        }
      })

      it("tidies the email and ignores a language it doesn't know", async () => {
        const { data } = await invite({ email: "  Gabor@Example.COM ", locale: "not a locale!" })

        expect(data.recruit.email).toBe("gabor@example.com")
        expect((await nthEvent(INVITE_SENT, 1)).data.locale).toBeNull()
      })

      it("refuses what can't work", async () => {
        await invite()

        const cases: [Record<string, unknown>, string, string | undefined][] = [
          [{ email: "not-an-email" }, "email", undefined],
          [{ name: "  " }, "name", undefined],
          [{ email: "peter@example.com" }, "yourself", "invite_self"],
          [{ email: "john@example.com" }, "already a sales rep", "invite_already_rep"],
          [{ email: "gabor@example.com" }, "already invited", "invite_duplicate_own"],
        ]
        for (const [body, text, code] of cases) {
          const response = await failure(invite(body))
          expect(response.status).toBe(400)
          expect(JSON.stringify(response.data)).toContain(text)
          expect(response.data.code).toBe(code)
        }
      })

      it("won't invite an email someone else already invited, and doesn't say who", async () => {
        await invite()

        const response = await failure(invite({}, tokens.john))

        expect(response.status).toBe(400)
        expect(response.data.message).toContain("has already been invited")
        expect(response.data.message).not.toContain("Peter")
        expect(response.data.code).toBe("invite_duplicate_other")
      })

      it("tells a candidate who has already applied that the owner is deciding", async () => {
        await applied()

        const response = await failure(invite({}, tokens.john))

        expect(response.data.message).toContain("already applied")
        expect(response.data.code).toBe("invite_applied")
      })

      it("stops at the limit of invitations waiting", async () => {
        await service().createRepInvites(
          Array.from({ length: 20 }, (_, i) => ({
            recruiter_sales_rep_id: peterId,
            email: `bulk${i}@example.com`,
            name: `Bulk ${i}`,
            token_hash: hashInviteToken(`bulk-${i}`),
            status: "invited" as const,
            expires_at: new Date(Date.now() + DAY),
          }))
        )

        const response = await failure(invite())
        expect(response.status).toBe(400)
        expect(response.data.message).toContain("20 invitations waiting")
        expect(response.data.code).toBe("invite_limit")

        // Withdrawing one makes room
        const [first] = await service().listRepInvites({ email: "bulk0@example.com" })
        await portalDelete(`/sales-portal/recruits/${first.id}`)
        expect((await invite()).status).toBe(201)
      })

      it("is for reps who currently have portal access", async () => {
        await api.delete(`/admin/sales-reps/${peterId}/portal-access`, { headers })

        const response = await failure(invite())

        expect(response.status).toBe(403)
        expect(await service().listRepInvites({})).toEqual([])
      })

      it("needs a signed-in rep", async () => {
        const post = await failure(api.post("/sales-portal/recruits", {}))
        const get = await failure(api.get("/sales-portal/recruits"))

        expect([post.status, get.status]).toEqual([401, 401])
      })

      it("lists each rep's own invites only", async () => {
        await invite()

        const peters = await portalGet("/sales-portal/recruits")
        const johns = await portalGet("/sales-portal/recruits", tokens.john)

        expect(peters.data.recruits).toHaveLength(1)
        expect(johns.data.recruits).toEqual([])
        expect(johns.data.limits.open_invites).toBe(0)
      })
    })

    describe("sending again and withdrawing", () => {
      it("gives a new link, ends the old one and extends the expiry", async () => {
        const { data } = await invite()
        const oldToken = await linkTokenOf(data.recruit.id)

        const tooSoon = await failure(portalPost(`/sales-portal/recruits/${data.recruit.id}/resend`))
        expect(tooSoon.status).toBe(400)
        expect(tooSoon.data.message).toContain("Wait a minute")
        expect(tooSoon.data.code).toBe("invite_cooldown")

        await service().updateRepInvites({
          id: data.recruit.id,
          last_sent_at: new Date(Date.now() - 2 * 60_000),
          expires_at: new Date(Date.now() + DAY),
        })
        const resent = await portalPost(`/sales-portal/recruits/${data.recruit.id}/resend`, {
          locale: "de-AT",
        })

        const newToken = await linkTokenOf(data.recruit.id, 2)
        expect(newToken).not.toBe(oldToken)
        expect((await nthEvent(INVITE_SENT, 2)).data.locale).toBe("de-AT")
        expect(Date.parse(resent.data.recruit.expires_at) - Date.now()).toBeGreaterThan(13 * DAY)
        expect((await failure(api.get(`/sales-invites/${oldToken}`))).status).toBe(404)
        expect((await api.get(`/sales-invites/${newToken}`)).data.invite.state).toBe("invited")
      })

      it("keeps the invite's language when the resend doesn't name one", async () => {
        const { data } = await invite()
        await service().updateRepInvites({
          id: data.recruit.id,
          last_sent_at: new Date(Date.now() - 2 * 60_000),
        })

        await portalPost(`/sales-portal/recruits/${data.recruit.id}/resend`)

        expect((await nthEvent(INVITE_SENT, 2)).data.locale).toBe("hu-HU")
      })

      it("can only be done by the rep who invited, and only before the candidate applies", async () => {
        const { data } = await invite()
        const other = await failure(portalPost(`/sales-portal/recruits/${data.recruit.id}/resend`, {}, tokens.john))
        const otherDelete = await failure(portalDelete(`/sales-portal/recruits/${data.recruit.id}`, tokens.john))
        await apply(await linkTokenOf(data.recruit.id))
        const afterApply = await failure(portalPost(`/sales-portal/recruits/${data.recruit.id}/resend`))
        const cancelAfterApply = await failure(portalDelete(`/sales-portal/recruits/${data.recruit.id}`))

        expect([other.status, otherDelete.status]).toEqual([404, 404])
        expect(afterApply.status).toBe(400)
        expect(afterApply.data.code).toBe("invite_not_pending")
        expect(cancelAfterApply.status).toBe(400)
        expect(cancelAfterApply.data.code).toBe("invite_applied")
        expect(cancelAfterApply.data.message).toContain("owner decides")
      })

      it("withdraws an invite: its link stops working and the email is free again", async () => {
        const { data } = await invite()
        const token = await linkTokenOf(data.recruit.id)

        const removed = await portalDelete(`/sales-portal/recruits/${data.recruit.id}`)

        expect(removed.data).toEqual({ id: data.recruit.id, object: "recruit", deleted: true })
        expect((await failure(api.get(`/sales-invites/${token}`))).status).toBe(404)
        expect((await failure(apply(token))).status).toBe(404)
        expect((await portalGet("/sales-portal/recruits")).data.recruits).toEqual([])
        expect((await invite({}, tokens.john)).status).toBe(201)
      })

      it("shows an invite whose link ran out as expired, and lets it be sent again", async () => {
        const { data } = await invite()
        await service().updateRepInvites({
          id: data.recruit.id,
          expires_at: new Date(Date.now() - 1000),
          last_sent_at: new Date(Date.now() - 2 * 60_000),
        })

        const listed = await portalGet("/sales-portal/recruits")
        expect(listed.data.recruits[0].status).toBe("expired")
        expect(listed.data.limits.open_invites).toBe(0)

        await portalPost(`/sales-portal/recruits/${data.recruit.id}/resend`)
        const again = await portalGet("/sales-portal/recruits")
        expect(again.data.recruits[0].status).toBe("invited")
      })

      it("lets someone else invite an email whose earlier link ran out", async () => {
        const { data } = await invite()
        await service().updateRepInvites({ id: data.recruit.id, expires_at: new Date(Date.now() - 1000) })

        const response = await invite({}, tokens.john)

        expect(response.status).toBe(201)
        expect((await portalGet("/sales-portal/recruits")).data.recruits).toEqual([])
        const [old] = await service().listRepInvites({ id: data.recruit.id })
        expect(old.status).toBe("canceled")
      })
    })

    describe("the candidate's page", () => {
      it("shows who invited them, and nothing else", async () => {
        const { data } = await invite()
        const token = await linkTokenOf(data.recruit.id)

        const response = await api.get(`/sales-invites/${token}`)

        expect(response.headers["cache-control"]).toBe("no-store")
        expect(response.data).toEqual({
          invite: {
            state: "invited",
            recruiter_name: "Peter Nagy",
            name: "Gabor Szabo",
            email: "gabor@example.com",
            expires_at: data.recruit.expires_at,
            applied_at: null,
          },
        })
      })

      it("answers the same for a link nobody issued and for one that isn't a link at all", async () => {
        const unknown = await failure(api.get(`/sales-invites/${"a".repeat(43)}`))
        const junk = await failure(api.get("/sales-invites/short"))
        const unknownApply = await failure(apply("a".repeat(43)))

        expect([unknown.status, junk.status, unknownApply.status]).toEqual([404, 404, 404])
        expect(unknown.data).toEqual(junk.data)
        expect(unknown.data.code).toBe("link_invalid")
        expect(unknownApply.data.code).toBe("link_invalid")
      })

      it("takes an application, once", async () => {
        const { data } = await invite()
        const token = await linkTokenOf(data.recruit.id)

        // The email is the invite's: a form that tries to change it is refused
        const smuggled = await failure(apply(token, { email: "someone-else@example.com" }))
        const response = await apply(token)
        const again = await failure(apply(token))

        expect(smuggled.status).toBe(400)
        expect(smuggled.data.message).toContain("email")
        expect(response.status).toBe(201)
        expect(response.data.application).toEqual({ id: data.recruit.id, status: "applied" })
        expect(again.status).toBe(400)
        expect(again.data.code).toBe("link_used")
        expect(again.data.message).toContain("already been used")
        const [stored] = await service().listRepInvites({ id: data.recruit.id })
        expect(stored).toEqual(
          expect.objectContaining({
            status: "applied",
            email: "gabor@example.com",
            applicant_name: "Szabó Gábor",
            applicant_phone: "+36 30 555 0142",
            applicant_company: "Szabó Bt.",
            requested_currency_code: "huf",
          })
        )
        expect(stored.terms_accepted_at).toBeTruthy()
        expect((await api.get(`/sales-invites/${token}`)).data.invite.state).toBe("applied")
        expect((await nthEvent(APPLICATION_RECEIVED, 1)).data).toEqual({
          invite_id: data.recruit.id,
          applicant_name: "Szabó Gábor",
          email: "gabor@example.com",
          phone: "+36 30 555 0142",
          company: "Szabó Bt.",
          requested_currency_code: "huf",
          recruiter_name: "Peter Nagy",
          locale: "hu-HU",
        })
        expect(eventsOf(APPLICATION_RECEIVED)).toHaveLength(1)
      })

      it("asks for a name, the terms and a currency we pay in", async () => {
        const { data } = await invite()
        const token = await linkTokenOf(data.recruit.id)

        for (const body of [
          { accept_terms: false },
          { accept_terms: undefined },
          { name: "A" },
          { requested_currency_code: "usd" },
          { phone: "1".repeat(41) },
        ]) {
          expect((await failure(apply(token, body))).status).toBe(400)
        }

        // None of that used the link up
        expect((await api.get(`/sales-invites/${token}`)).data.invite.state).toBe("invited")
        expect((await apply(token, { company: null, phone: undefined })).status).toBe(201)
      })

      it("explains a link that ran out", async () => {
        const { data } = await invite()
        const token = await linkTokenOf(data.recruit.id)
        await service().updateRepInvites({ id: data.recruit.id, expires_at: new Date(Date.now() - 1000) })

        const page = await api.get(`/sales-invites/${token}`)
        const response = await failure(apply(token))

        expect(page.data.invite.state).toBe("expired")
        expect(response.status).toBe(400)
        expect(response.data.message).toContain("expired")
        expect(response.data.code).toBe("link_expired")
      })

      it("sends someone who is already a rep to sign in", async () => {
        const { data } = await invite({ email: "eva@example.com", name: "Eva Toth" })
        const token = await linkTokenOf(data.recruit.id)
        await adminPost("/admin/sales-reps", { name: "Eva Toth", email: "eva@example.com" })

        const response = await failure(apply(token))

        expect(response.status).toBe(400)
        expect(response.data.message).toContain("Sign in")
        expect(response.data.code).toBe("already_rep")
      })
    })

    describe("the owner's review", () => {
      it("lists what is waiting, with what the candidate gave", async () => {
        const { id } = await applied()
        await invite({ email: "later@example.com", name: "Later" }, tokens.john)

        const { data } = await adminGet("/admin/sales-commission/applications")

        expect(data.count).toBe(1)
        expect(data.counts).toEqual({ invited: 1, applied: 1, approved: 0, declined: 0, canceled: 0 })
        expect(data.applications).toEqual([
          expect.objectContaining({
            id,
            status: "applied",
            name: "Szabó Gábor",
            email: "gabor@example.com",
            phone: "+36 30 555 0142",
            company: "Szabó Bt.",
            requested_currency_code: "huf",
            note: "Met at the fair",
            recruiter: { id: peterId, name: "Peter Nagy" },
            sales_rep_id: null,
          }),
        ])
        expect(JSON.stringify(data)).not.toContain("token")
      })

      it("can list the other statuses too", async () => {
        const { id } = await applied()
        await invite({ email: "later@example.com", name: "Later" }, tokens.john)

        const invited = await adminGet("/admin/sales-commission/applications?status=invited")
        const all = await adminGet("/admin/sales-commission/applications?status=all")

        expect(invited.data.applications.map((a: any) => a.email)).toEqual(["later@example.com"])
        expect(all.data.count).toBe(2)
        expect(all.data.applications.map((a: any) => a.id)).toContain(id)
        expect((await failure(adminGet("/admin/sales-commission/applications?status=bogus"))).status).toBe(400)
      })

      it("is for admins", async () => {
        const { id } = await applied()

        const statuses = await Promise.all(
          [
            api.get("/admin/sales-commission/applications"),
            api.get(`/admin/sales-commission/applications/${id}`),
            api.post(`/admin/sales-commission/applications/${id}/approve`, { level2_rate: 2 }),
            api.post(`/admin/sales-commission/applications/${id}/decline`, { reason: "x" }),
          ].map(async (request) => (await failure(request)).status)
        )
        const asRep = await failure(
          api.get("/admin/sales-commission/applications", bearer(tokens.peter))
        )

        expect(statuses).toEqual([401, 401, 401, 401])
        expect(asRep.status).toBe(401)
      })

      it("shows one application with the terms to start from", async () => {
        const { id } = await applied()

        const { data } = await adminGet(`/admin/sales-commission/applications/${id}`)

        expect(data.application.id).toBe(id)
        expect(data.recruiter).toEqual({
          id: peterId,
          name: "Peter Nagy",
          email: "peter@example.com",
          is_active: true,
        })
        expect(data.defaults).toEqual({ level2_rate: 2, level2_months: 24 })
        expect(data.blockers).toEqual([])
      })

      it("says up front what would stop an approval", async () => {
        const { id } = await applied()
        await adminPost(`/admin/sales-reps/${peterId}`, { is_active: false })
        const identity = await registerLogin("customer", "gabor@example.com")
        await authModule().updateAuthIdentities({ id: identity, app_metadata: { customer_id: "cus_test" } })

        const { data } = await adminGet(`/admin/sales-commission/applications/${id}`)

        expect(data.blockers).toHaveLength(2)
        expect(data.blockers[0]).toContain("Peter Nagy is inactive")
        expect(data.blockers[1]).toContain("linked to another account")
      })

      it("is not found for an application that doesn't exist", async () => {
        expect((await failure(adminGet("/admin/sales-commission/applications/srinv_nope"))).status).toBe(404)
      })
    })

    describe("approving", () => {
      it("creates the rep, links the recruiter on the agreed terms and gives portal access", async () => {
        const { id } = await applied()

        const { data } = await approve(id, { payout_currency_code: "huf" })

        const repId = data.sales_rep.id as string
        const detail = (await adminGet(`/admin/sales-reps/${repId}`)).data
        expect(detail.sales_rep).toEqual(
          expect.objectContaining({
            name: "Szabó Gábor",
            email: "gabor@example.com",
            phone: "+36 30 555 0142",
            is_active: true,
            payout_currency_code: "huf",
          })
        )
        expect(detail.sales_rep.notes).toContain("Szabó Bt.")
        expect(detail.sales_rep.notes).toContain("Peter Nagy")
        expect(detail.portal).toEqual({ status: "active" })
        expect(detail.referral).toEqual(
          expect.objectContaining({
            referrer_sales_rep_id: peterId,
            referred_sales_rep_id: repId,
            level2_rate: 2,
            ends_at: null,
            created_by: actorId,
          })
        )
        expect(detail.referral.expires_at).toBe(monthsFrom(new Date(), 24, TIMEZONE).toISOString())

        const [stored] = await service().listRepInvites({ id })
        expect(stored).toEqual(
          expect.objectContaining({ status: "approved", sales_rep_id: repId, decided_by: actorId })
        )
        expect((await adminGet("/admin/sales-commission/applications")).data.counts.applied).toBe(0)
      })

      it("emails the new rep a link to set a password, and tells the recruiter", async () => {
        const { id } = await applied()

        const { data } = await approve(id, { level2_rate: 2.5, level2_months: 12 })

        const approved = (await nthEvent(APPLICATION_APPROVED, 1)).data
        expect(approved).toEqual({
          invite_id: id,
          sales_rep_id: data.sales_rep.id,
          name: "Szabó Gábor",
          email: "gabor@example.com",
          token: expect.any(String),
          recruiter: { name: "Peter Nagy", email: "peter@example.com" },
          level2_rate: 2.5,
          level2_until: monthsFrom(new Date(), 12, TIMEZONE).toISOString(),
          locale: "hu-HU",
        })
      })

      it("gives a welcome link that sets the first password, works once and lasts a week", async () => {
        const { id } = await applied()
        await approve(id)
        const { token } = (await nthEvent(APPLICATION_APPROVED, 1)).data

        const payload = jwtPayload(token)
        expect(payload).toEqual(
          expect.objectContaining({
            entity_id: "gabor@example.com",
            provider: "emailpass",
            actor_type: "sales_rep",
            purpose: "reset",
          })
        )
        expect(payload.exp - payload.iat).toBe(7 * 24 * 60 * 60)

        const set = await api.post(
          "/auth/sales_rep/emailpass/update",
          { email: "gabor@example.com", password: PORTAL_PASSWORD },
          bearer(token)
        )
        expect(set.status).toBe(200)
        const signedIn = await api.post("/auth/sales_rep/emailpass", {
          email: "gabor@example.com",
          password: PORTAL_PASSWORD,
        })
        const me = await portalGet("/sales-portal/me", signedIn.data.token)
        expect(me.data.sales_rep.name).toBe("Szabó Gábor")

        const reused = await failure(
          api.post(
            "/auth/sales_rep/emailpass/update",
            { email: "gabor@example.com", password: "another-password-2" },
            bearer(token)
          )
        )
        expect(reused.status).toBe(401)
      })

      it("keeps the contract uploaded with the approval", async () => {
        const { id } = await applied()

        const { data } = await approve(id, {
          contract: {
            file_name: "agreement.pdf",
            mime_type: "application/pdf",
            content_base64: Buffer.from("%PDF-1.4 signed").toString("base64"),
          },
        })

        const contracts = await adminGet(`/admin/sales-reps/${data.sales_rep.id}/contracts`)
        expect(contracts.data.contracts).toEqual([
          expect.objectContaining({ file_name: "agreement.pdf", mime_type: "application/pdf" }),
        ])
      })

      it("can run Level 2 until the owner ends it", async () => {
        const { id } = await applied()

        const { data } = await approve(id, { level2_months: null })

        const detail = (await adminGet(`/admin/sales-reps/${data.sales_rep.id}`)).data
        expect(detail.referral.expires_at).toBeNull()
        expect((await nthEvent(APPLICATION_APPROVED, 1)).data.level2_until).toBeNull()
      })

      it("can't be done twice, or after declining, or before the candidate applied", async () => {
        const { id } = await applied()
        await approve(id)
        const twice = await failure(approve(id))

        const second = (await invite({ email: "eva@example.com", name: "Eva" })).data.recruit.id
        const notYet = await failure(approve(second))
        await apply(await linkTokenOf(second))
        await decline(second)
        const afterDecline = await failure(approve(second))

        expect(twice.data.message).toContain("already approved")
        expect(notYet.data.message).toContain("hasn't been submitted yet")
        expect(afterDecline.data.message).toContain("already declined")
        expect(await service().listSalesReps({ email: "eva@example.com" })).toEqual([])
      })

      it("checks the terms", async () => {
        const { id } = await applied()

        for (const body of [
          { level2_rate: 101 },
          { level2_rate: -1 },
          { level2_months: 0 },
          { level2_months: 121 },
          { level2_months: 1.5 },
          { payout_currency_code: "usd" },
        ]) {
          expect((await failure(approve(id, body))).status).toBe(400)
        }
        expect(await service().listSalesReps({ email: "gabor@example.com" })).toEqual([])
        expect((await approve(id, { level2_rate: 0 })).status).toBe(200)
      })

      it("needs an active recruiter and leaves everything as it was", async () => {
        const { id } = await applied()
        await adminPost(`/admin/sales-reps/${peterId}`, { is_active: false })

        const response = await failure(approve(id))

        expect(response.status).toBe(400)
        expect(response.data.message).toContain("Peter Nagy is inactive")
        expect(await service().listSalesReps({ email: "gabor@example.com" })).toEqual([])
        const [stored] = await service().listRepInvites({ id })
        expect(stored.status).toBe("applied")
      })

      it("undoes everything when the shop already has a login for that email", async () => {
        const { id } = await applied()
        const identity = await registerLogin("customer", "gabor@example.com")
        await authModule().updateAuthIdentities({ id: identity, app_metadata: { customer_id: "cus_test" } })

        const response = await failure(approve(id))

        expect(response.status).toBe(400)
        expect(response.data.message).toContain("already has a login")
        expect(await service().listSalesReps({ email: "gabor@example.com" })).toEqual([])
        expect(await service().listRepReferrals({})).toEqual([])
        expect((await service().listRepInvites({ id }))[0].status).toBe("applied")
        // The customer's own login is untouched
        const customer = await api.post("/auth/customer/emailpass", {
          email: "gabor@example.com",
          password: PORTAL_PASSWORD,
        })
        expect(customer.status).toBe(200)
      })

      it("undoes the rep, the referral and the login when a later step fails", async () => {
        const { id } = await applied()

        const response = await failure(
          approve(id, {
            contract: {
              file_name: "notes.txt",
              mime_type: "text/plain",
              content_base64: Buffer.from("x").toString("base64"),
            },
          })
        )

        expect(response.status).toBe(400)
        expect(response.data.message).toContain("PDF, JPEG or PNG")
        expect(await service().listSalesReps({ email: "gabor@example.com" })).toEqual([])
        expect(await service().listRepReferrals({})).toEqual([])
        expect(await identityOf("gabor@example.com")).toBeUndefined()
        expect((await service().listRepInvites({ id }))[0].status).toBe("applied")
        expect(eventsOf(APPLICATION_APPROVED)).toEqual([])
        // And it can still be approved properly
        expect((await approve(id)).status).toBe(200)
      })

      describe("the recruiter's Level 2", () => {
        let repId: string
        let customer: { id: string; email: string }

        beforeEach(async () => {
          const { id } = await applied()
          repId = (await approve(id)).data.sales_rep.id
          customer = await container.resolve(Modules.CUSTOMER).createCustomers({
            email: "buyer@greenoffice.example",
            company_name: "Green Office Kft.",
          })
          await adminPost(`/admin/customers/${customer.id}/sales-rep-assignment`, {
            sales_rep_id: repId,
            commission_rate: 10,
          })
        })

        /** A new order from the client, paid; returns its commission entries once there are `count` */
        const paidOrder = async (count: number) => {
          const order = await createOrder(container, customer)
          await markOrderPaid(container, order.id)
          return waitFor(async () => {
            const found = await service().listCommissionEntries(
              { order_id: order.id },
              { order: { type: "ASC" } }
            )
            return found.length >= count && found
          })
        }

        it("earns the recruiter Level 2 on the new rep's clients at the approved rate", async () => {
          const entries = await paidOrder(2)

          expect(entries.map((e) => [e.type, e.sales_rep_id, e.rate, e.amount])).toEqual([
            ["direct", repId, 10, 18],
            ["level2", peterId, 2, 3.6],
          ])
        })

        it("stops for orders placed after the terms run out", async () => {
          const [referral] = await service().listRepReferrals({ referred_sales_rep_id: repId })
          await service().updateRepReferrals({
            id: referral.id,
            expires_at: new Date(Date.now() - DAY),
          })

          const entries = await paidOrder(1)

          expect(entries.map((e) => e.type)).toEqual(["direct"])
        })

        it("shows the recruiter their recruit and the Level 2 earned, never the clients", async () => {
          await paidOrder(2)
          const [referral] = await service().listRepReferrals({ referred_sales_rep_id: repId })

          const { data } = await portalGet("/sales-portal/recruits")

          expect(data.recruits).toEqual([
            {
              id: expect.any(String),
              name: "Szabó Gábor",
              email: "gabor@example.com",
              status: "active",
              invited_at: expect.any(String),
              expires_at: null,
              note: "Met at the fair",
              level2_rate: 2,
              level2_until: new Date(referral.expires_at!).toISOString(),
              level2_this_month: [{ currency_code: "eur", amount: 3.6 }],
              level2_total: [{ currency_code: "eur", amount: 3.6 }],
            },
          ])
          const text = JSON.stringify(data)
          for (const secret of ["Green Office", customer.id, "Szabó Bt.", "555 0142", "token_hash", "decision"]) {
            expect(text).not.toContain(secret)
          }
        })

        it("lists nothing in the recruit's own portal until they invite someone", async () => {
          const { token } = (await nthEvent(APPLICATION_APPROVED, 1)).data
          await api.post(
            "/auth/sales_rep/emailpass/update",
            { email: "gabor@example.com", password: PORTAL_PASSWORD },
            bearer(token)
          )
          const gabor = (
            await api.post("/auth/sales_rep/emailpass", {
              email: "gabor@example.com",
              password: PORTAL_PASSWORD,
            })
          ).data.token

          const { data } = await portalGet("/sales-portal/recruits", gabor)

          expect(data.recruits).toEqual([])
        })

        it("lets the owner set a new referrer once the terms have run out", async () => {
          const [referral] = await service().listRepReferrals({ referred_sales_rep_id: repId })
          await service().updateRepReferrals({ id: referral.id, expires_at: new Date(Date.now() - DAY) })

          const response = await adminPost(`/admin/sales-reps/${repId}/referral`, {
            referrer_sales_rep_id: johnId,
            level2_rate: 5,
          })

          expect(response.status).toBe(200)
          const detail = (await adminGet(`/admin/sales-reps/${repId}`)).data
          expect(detail.referral.referrer_sales_rep_id).toBe(johnId)
        })
      })
    })

    describe("declining", () => {
      it("tells the candidate and the recruiter the outcome, not the reason", async () => {
        const { id } = await applied()

        const response = await decline(id, { reason: "Too little experience" })

        expect(response.data).toEqual({ id, status: "declined" })
        const declined = await nthEvent(APPLICATION_DECLINED, 1)
        expect(declined.data).toEqual({
          invite_id: id,
          name: "Szabó Gábor",
          email: "gabor@example.com",
          recruiter: { name: "Peter Nagy", email: "peter@example.com" },
          locale: "hu-HU",
        })
        expect(JSON.stringify(declined.data)).not.toContain("experience")
        const listed = await portalGet("/sales-portal/recruits")
        expect(listed.data.recruits[0].status).toBe("declined")
        expect(JSON.stringify(listed.data)).not.toContain("experience")
        const detail = await adminGet(`/admin/sales-commission/applications/${id}`)
        expect(detail.data.application.decision_reason).toBe("Too little experience")
        expect(detail.data.application.status).toBe("declined")
        expect(await service().listSalesReps({ email: "gabor@example.com" })).toEqual([])
      })

      it("needs a reason and an application that is waiting", async () => {
        const { id } = await applied()
        const none = await failure(decline(id, { reason: "  " }))
        await decline(id)
        const twice = await failure(decline(id))
        const notYet = (await invite({ email: "eva@example.com", name: "Eva" }, tokens.john)).data.recruit.id
        const early = await failure(decline(notYet))

        expect(none.status).toBe(400)
        expect(twice.data.message).toContain("already declined")
        expect(early.data.message).toContain("hasn't been submitted yet")
      })

      it("frees the email for a fresh invitation", async () => {
        const { id } = await applied()
        await decline(id)

        const response = await invite({}, tokens.john)

        expect(response.status).toBe(201)
        expect(response.data.recruit.status).toBe("invited")
      })

      it("closes the link: the candidate sees it is used", async () => {
        const { id, token } = await applied()
        await decline(id)

        const page = await api.get(`/sales-invites/${token}`)
        const again = await failure(apply(token))

        expect(page.data.invite.state).toBe("declined")
        expect(again.status).toBe(400)
        expect(again.data.code).toBe("link_used")
      })
    })
  },
})
