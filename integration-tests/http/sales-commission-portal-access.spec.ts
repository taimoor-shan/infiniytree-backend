import { medusaIntegrationTestRunner } from "@medusajs/test-utils"
import { ContainerRegistrationKeys, Modules } from "@medusajs/framework/utils"
import { generateResetPasswordTokenWorkflow } from "@medusajs/medusa/core-flows"
import { createAdminHeaders } from "./helpers/admin-auth"

jest.setTimeout(120 * 1000)

// A test value for this app only
const PASSWORD = "portal-test-password-1"

const jwtPayload = (token: string) =>
  JSON.parse(Buffer.from(token.split(".")[1], "base64url").toString())

// Set here: the test runner applies its `env` option only after medusa-config.ts
// has been read, and the plugin's portal_url comes from there
process.env.SALES_PORTAL_URL = "https://shop.test/sales-portal"

medusaIntegrationTestRunner({
  inApp: true,
  env: {},
  testSuite: ({ api, getContainer }) => {
    let headers: Record<string, string>
    let repId: string

    beforeEach(async () => {
      ;({ headers } = await createAdminHeaders(getContainer()))
      repId = await createRep("Peter Nagy", "peter@example.com")
    })

    async function createRep(name: string, email: string) {
      const { data } = await api.post(
        "/admin/sales-reps",
        { name, email },
        { headers }
      )
      return data.sales_rep.id as string
    }

    const authModule = () => getContainer().resolve(Modules.AUTH)
    const identityOf = async (email: string) =>
      (
        await authModule().listAuthIdentities(
          { provider_identities: { provider: "emailpass", entity_id: email } },
          { relations: ["provider_identities"] }
        )
      )[0]
    const grant = (id = repId) =>
      api.post(`/admin/sales-reps/${id}/portal-access`, {}, { headers })
    const revoke = (id = repId) =>
      api.delete(`/admin/sales-reps/${id}/portal-access`, { headers })
    const portalOf = async (id = repId) =>
      (await api.get(`/admin/sales-reps/${id}`, { headers })).data.portal
    const failure = (promise: Promise<unknown>) =>
      promise.then(
        () => {
          throw new Error("expected the request to fail")
        },
        (e) => e.response
      )
    const login = async (email: string, password = PASSWORD) =>
      (
        await api.post("/auth/sales_rep/emailpass", { email, password })
      ).data.token as string

    /** What the "Forgot password" email carries: Medusa's own reset token */
    const resetToken = async (email: string) => {
      const { http } = getContainer().resolve(
        ContainerRegistrationKeys.CONFIG_MODULE
      ).projectConfig
      const { result } = await generateResetPasswordTokenWorkflow(
        getContainer()
      ).run({
        input: {
          entityId: email,
          actorType: "sales_rep",
          provider: "emailpass",
          secret: http.jwtSecret,
          jwtOptions: http.jwtOptions,
        },
      })
      return result as string
    }
    const setPassword = (email: string, token: string) =>
      api.post(
        "/auth/sales_rep/emailpass/update",
        { email, password: PASSWORD },
        { headers: { authorization: `Bearer ${token}` } }
      )

    /** A login someone registered through Medusa's public register route */
    const registerLogin = async (actor: string, email: string) => {
      const { data } = await api.post(`/auth/${actor}/emailpass/register`, {
        email,
        password: PASSWORD,
      })
      return jwtPayload(data.token).auth_identity_id as string
    }

    describe("granting access", () => {
      it("links a new login for the rep's email and returns the links to share", async () => {
        const { data } = await grant()

        const identity = await identityOf("peter@example.com")
        expect(data).toEqual({
          portal: { status: "active" },
          login_url: "https://shop.test/sales-portal/login",
          forgot_password_url:
            "https://shop.test/sales-portal/forgot-password?email=peter%40example.com",
        })
        expect(identity.app_metadata).toEqual({ sales_rep_id: repId })
        expect(JSON.stringify(data)).not.toContain(identity.id)
        expect(await portalOf()).toEqual({ status: "active" })
      })

      it("lets the rep set a first password through Medusa's own reset flow", async () => {
        await grant()

        const reset = await api.post("/auth/sales_rep/emailpass/reset-password", {
          identifier: "peter@example.com",
        })
        const update = await setPassword(
          "peter@example.com",
          await resetToken("peter@example.com")
        )
        const session = jwtPayload(await login("peter@example.com"))

        expect(reset.status).toBe(201)
        expect(update.status).toBe(200)
        expect(session).toEqual(
          expect.objectContaining({ actor_id: repId, actor_type: "sales_rep" })
        )
      })

      it("leaves the login unusable until the rep sets a password", async () => {
        await grant()

        const response = await failure(login("peter@example.com", "guess-1"))

        expect(response.status).toBe(401)
      })

      it("rejects an inactive rep", async () => {
        await api.post(`/admin/sales-reps/${repId}`, { is_active: false }, { headers })

        expect((await failure(grant())).status).toBe(400)
        expect(await identityOf("peter@example.com")).toBeUndefined()
      })

      it("returns 404 for an unknown rep", async () => {
        expect((await failure(grant("srep_missing"))).status).toBe(404)
      })

      it("rejects a rep who already has access", async () => {
        await grant()

        expect((await failure(grant())).status).toBe(400)
      })
    })

    describe("an email that already has a login", () => {
      it("is refused when someone registered it before, so it can't be taken over", async () => {
        await registerLogin("customer", "peter@example.com")

        const response = await failure(grant())

        expect(response.status).toBe(400)
        expect(response.data.message).toContain("already has a login")
        expect(await portalOf()).toEqual({ status: "none" })
      })

      it("is refused when it belongs to a shop customer", async () => {
        const identityId = await registerLogin("customer", "peter@example.com")
        await authModule().updateAuthIdentities({
          id: identityId,
          app_metadata: { customer_id: "cus_test" },
        })

        expect((await failure(grant())).status).toBe(400)
      })

      it("is linked when it belongs to an admin, who keeps their password", async () => {
        const ownerId = await createRep("Owner Rep", "owner@infinytree.test")
        const identityId = await registerLogin("user", "owner@infinytree.test")
        await authModule().updateAuthIdentities({
          id: identityId,
          app_metadata: { user_id: "user_test" },
        })

        await grant(ownerId)

        expect((await identityOf("owner@infinytree.test")).app_metadata).toEqual({
          user_id: "user_test",
          sales_rep_id: ownerId,
        })
        expect(
          jwtPayload(await login("owner@infinytree.test")).actor_id
        ).toBe(ownerId)
      })
    })

    describe("revoking access", () => {
      it("unlinks the rep and leaves the login in place", async () => {
        await grant()

        await revoke()

        expect(await portalOf()).toEqual({ status: "none" })
        expect(await identityOf("peter@example.com")).toBeDefined()
      })

      it("leaves an admin's own login working", async () => {
        const ownerId = await createRep("Owner Rep", "owner@infinytree.test")
        const identityId = await registerLogin("user", "owner@infinytree.test")
        await authModule().updateAuthIdentities({
          id: identityId,
          app_metadata: { user_id: "user_test" },
        })
        await grant(ownerId)

        await revoke(ownerId)

        const { data } = await api.post("/auth/user/emailpass", {
          email: "owner@infinytree.test",
          password: PASSWORD,
        })
        expect(jwtPayload(data.token).actor_id).toBe("user_test")
      })

      it("can be granted again, and the rep keeps their password", async () => {
        await grant()
        await setPassword("peter@example.com", await resetToken("peter@example.com"))
        await revoke()

        await grant()

        expect(await portalOf()).toEqual({ status: "active" })
        expect(jwtPayload(await login("peter@example.com")).actor_id).toBe(repId)
      })

      it("does nothing for a rep without access", async () => {
        expect((await revoke()).status).toBe(200)
        expect(await portalOf()).toEqual({ status: "none" })
      })

      it("returns 404 for an unknown rep", async () => {
        expect((await failure(revoke("srep_missing"))).status).toBe(404)
      })
    })
  },
})
