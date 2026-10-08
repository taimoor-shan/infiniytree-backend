import { medusaIntegrationTestRunner } from "@medusajs/test-utils"
import { Modules } from "@medusajs/framework/utils"
import { Resend } from "resend"
import { createAdminHeaders } from "./helpers/admin-auth"

// With REDIS_URL set, Medusa keeps its event bus in Redis. A dev server running
// next to the tests would then take the tests' events, and the tests its own.
// The test app keeps its events in memory instead.
process.env.REDIS_URL = ""

jest.setTimeout(120 * 1000)

const INVITEE = "new-admin@infinytree.test"

/** Events are handled in the background, after the response: wait for the result. */
const eventually = async <T>(
  check: () => T | undefined,
  what: string,
  timeoutMs = 15 * 1000
): Promise<T> => {
  const deadline = Date.now() + timeoutMs

  for (;;) {
    const result = check()
    if (result) {
      return result
    }
    if (Date.now() > deadline) {
      throw new Error(`Timed out waiting for ${what}`)
    }
    await new Promise((resolve) => setTimeout(resolve, 100))
  }
}

medusaIntegrationTestRunner({
  inApp: true,
  env: {},
  testSuite: ({ api, getContainer }) => {
    describe("Admin invites", () => {
      // The Resend API itself is replaced, so nothing leaves the test and the
      // calls show exactly what would have been sent
      const send = jest
        .spyOn(Object.getPrototypeOf(new Resend("re_never_used").emails), "send")
        .mockResolvedValue({ data: { id: "email_1" }, error: null } as any)

      beforeEach(() => {
        send.mockClear()
      })

      afterAll(() => {
        send.mockRestore()
      })

      const sentTo = (email: string) => send.mock.calls.find(([payload]: any) => payload.to === email)

      it("emails the invitee their link to the admin when an invite is created", async () => {
        const container = getContainer()
        const { headers } = await createAdminHeaders(container)

        const created = await api.post("/admin/invites", { email: INVITEE }, { headers })
        expect(created.status).toEqual(200)

        const invite = await container.resolve(Modules.USER).retrieveInvite(created.data.invite.id)
        const [payload] = (await eventually(() => sentTo(INVITEE), "the invite email")) as [any]

        expect(payload.subject).toBe("You're invited to the Infinytree admin")
        expect(payload.html).toContain(`/app/invite?token=${invite.token}`)

        // The notification log says what was sent, but not the secret link
        const logged = await container.resolve(Modules.NOTIFICATION).listNotifications({ to: INVITEE })
        expect(logged).toHaveLength(1)
        expect(logged[0]).toEqual(
          expect.objectContaining({
            channel: "email",
            trigger_type: "invite.created",
            resource_id: invite.id,
          })
        )
        expect(JSON.stringify(logged)).not.toContain(invite.token)
      })

      it("emails the new link when an invite is sent again", async () => {
        const container = getContainer()
        const { headers } = await createAdminHeaders(container)
        const users = container.resolve(Modules.USER)

        const created = await api.post("/admin/invites", { email: INVITEE }, { headers })
        const inviteId = created.data.invite.id
        const before = (await users.retrieveInvite(inviteId)).token
        await eventually(() => sentTo(INVITEE), "the first invite email")
        send.mockClear()

        const resent = await api.post(`/admin/invites/${inviteId}/resend`, {}, { headers })
        expect(resent.status).toEqual(200)

        const after = (await users.retrieveInvite(inviteId)).token
        expect(after).not.toEqual(before)

        const [payload] = (await eventually(() => sentTo(INVITEE), "the resent invite email")) as [any]
        expect(payload.html).toContain(`/app/invite?token=${after}`)
        expect(payload.html).not.toContain(before)
      })
    })
  },
})
