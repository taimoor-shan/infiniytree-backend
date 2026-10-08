import adminUserInviteHandler, { config } from "../admin-user-invite"

// A real invite token is a signed JWT: whoever holds it can create an admin account
const TOKEN = "eyJhbGciOiJIUzI1NiJ9.invite_secret_payload.signature_0123456789"

type Invite = {
  id: string
  email: string
  token: string
  expires_at: string
  accepted: boolean
}

const invite = (overrides: Partial<Invite> = {}): Invite => ({
  id: "invite_1",
  email: "anna@example.com",
  token: TOKEN,
  expires_at: "2026-10-09T17:15:00.000Z",
  accepted: false,
  ...overrides,
})

/** A container whose query, notification service and logger record what they are asked. */
const run = async (
  name: string,
  {
    invites = [invite()],
    admin = { path: "/app" },
    failFirst = false,
  }: { invites?: Invite[]; admin?: { path?: string }; failFirst?: boolean } = {}
) => {
  const sent: any[] = []
  const errors: string[] = []
  const services: Record<string, unknown> = {
    logger: { error: (message: string) => errors.push(message) },
    query: {
      graph: async ({ filters }: { filters: { id: string } }) => ({
        data: invites.filter((i) => i.id === filters.id),
      }),
    },
    configModule: { admin },
    notification: {
      createNotifications: async (n: any) => {
        if (failFirst) {
          throw new Error("provider down")
        }
        sent.push(n)
      },
    },
  }
  const container = { resolve: (key: string) => services[key] }

  await adminUserInviteHandler({ event: { name, data: { id: "invite_1" } }, container } as any)

  return { sent, errors }
}

const secretsIn = (notification: any) => {
  const { content, ...kept } = notification
  return JSON.stringify(kept)
}

describe("the admin invite email", () => {
  const saved = { ...process.env }

  beforeEach(() => {
    delete process.env.BACKEND_PUBLIC_URL
  })

  afterEach(() => {
    process.env = { ...saved }
  })

  it("is sent for a new invite and for a resent one", () => {
    expect(config.event).toEqual(["invite.created", "invite.resent"])
  })

  it("goes to the invitee, with a link to the admin's accept page", async () => {
    const { sent } = await run("invite.created")

    expect(sent).toHaveLength(1)
    expect(sent[0]).toEqual(
      expect.objectContaining({
        to: "anna@example.com",
        channel: "email",
        template: "admin-invite",
        trigger_type: "invite.created",
        resource_id: "invite_1",
        resource_type: "invite",
      })
    )
    expect(sent[0].content.subject).toBe("You're invited to the Infinytree admin")
    expect(sent[0].content.html).toContain(`http://localhost:9000/app/invite?token=${TOKEN}`)
  })

  it("sends the new token when an invite is resent", async () => {
    const refreshed = "eyJhbGciOiJIUzI1NiJ9.refreshed_payload.signature_9876543210"
    const { sent } = await run("invite.resent", { invites: [invite({ token: refreshed })] })

    expect(sent).toHaveLength(1)
    expect(sent[0].trigger_type).toBe("invite.resent")
    expect(sent[0].content.html).toContain(`/app/invite?token=${refreshed}`)
    expect(sent[0].content.html).not.toContain(TOKEN)
  })

  it("builds the link from the backend's public URL and the admin's path", async () => {
    process.env.BACKEND_PUBLIC_URL = "https://api.infinytree.com/"
    const { sent } = await run("invite.created", { admin: { path: "/dashboard" } })

    expect(sent[0].content.html).toContain(`https://api.infinytree.com/dashboard/invite?token=${TOKEN}`)
  })

  it("says until when the invitation works", async () => {
    const { sent } = await run("invite.created")

    // 17:15 UTC is 19:15 in the shop's time zone
    expect(sent[0].content.html).toContain("October 9, 2026")
    expect(sent[0].content.html).toContain("19:15")
  })

  it("keeps the secret out of what the notification log stores", async () => {
    const { sent } = await run("invite.created")

    expect(secretsIn(sent[0])).not.toContain(TOKEN)
  })

  it("sends nothing for an invite that was accepted before the event was handled", async () => {
    const { sent, errors } = await run("invite.created", { invites: [invite({ accepted: true })] })

    expect(sent).toHaveLength(0)
    expect(errors).toHaveLength(0)
  })

  it("sends nothing, and doesn't fail, for an invite deleted before the event was handled", async () => {
    const { sent, errors } = await run("invite.created", { invites: [] })

    expect(sent).toHaveLength(0)
    expect(errors).toHaveLength(0)
  })

  it("logs a failure without the token and without throwing", async () => {
    const { errors } = await run("invite.created", { failFirst: true })

    expect(errors).toHaveLength(1)
    expect(errors[0]).toContain("invite_1")
    expect(errors[0]).not.toContain(TOKEN)
  })
})
