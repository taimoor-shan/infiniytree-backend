import salesApplicationApprovedHandler from "../sales-application-approved"
import salesApplicationDeclinedHandler from "../sales-application-declined"
import salesApplicationReceivedHandler from "../sales-application-received"
import salesRepInviteHandler from "../sales-rep-invite"

const TOKEN = "secret_link_token-0123456789abcdefghijklmnopqrst"

/** A container whose notification service records what it is asked to send. */
const run = async (
  handler: (args: any) => Promise<void>,
  name: string,
  data: Record<string, unknown>,
  { failFirst = false }: { failFirst?: boolean } = {}
) => {
  const sent: any[] = []
  const errors: string[] = []
  let calls = 0
  const notification = {
    createNotifications: async (n: any) => {
      calls += 1
      if (failFirst && calls === 1) {
        throw new Error("provider down")
      }
      sent.push(n)
    },
  }
  const logger = { error: (message: string) => errors.push(message) }
  const container = {
    resolve: (key: string) => (key === "logger" ? logger : notification),
  }

  await handler({ event: { name, data }, container })

  return { sent, errors }
}

const secretsIn = (notification: any) => {
  const { content, ...kept } = notification
  return JSON.stringify(kept)
}

describe("the invite email", () => {
  const data = {
    invite_id: "srinv_1",
    email: "gabor@example.com",
    name: "Gabor Szabo",
    token: TOKEN,
    expires_at: "2026-10-21T10:00:00.000Z",
    recruiter_name: "Peter Nagy",
    locale: "hu-HU",
  }

  it("goes to the candidate in the recruiter's language, with their link", async () => {
    const { sent } = await run(salesRepInviteHandler, "sales-commission.invite.sent", data)

    expect(sent).toHaveLength(1)
    expect(sent[0]).toEqual(
      expect.objectContaining({
        to: "gabor@example.com",
        channel: "email",
        template: "rep-invite",
        resource_id: "srinv_1",
      })
    )
    expect(sent[0].content.subject).toBe("Peter Nagy meghívta Önt az Infinytree értékesítői csapatába")
    expect(sent[0].content.html).toContain(`/sales-portal/join/${TOKEN}`)
    expect(sent[0].content.html).toContain("Meghívást kapott értékesítői csapatunkba")
  })

  it("keeps the secret out of what the notification log stores", async () => {
    const { sent } = await run(salesRepInviteHandler, "sales-commission.invite.sent", data)

    expect(secretsIn(sent[0])).not.toContain(TOKEN)
    expect(sent[0].data).toEqual({ recruiter_name: "Peter Nagy", locale: "hu-HU" })
  })

  it("defaults to English", async () => {
    const { sent } = await run(salesRepInviteHandler, "sales-commission.invite.sent", {
      ...data,
      locale: null,
    })

    expect(sent[0].content.subject).toBe("Peter Nagy invited you to join Infinytree's sales team")
  })

  it("logs a failure without the token and without throwing", async () => {
    const { errors } = await run(
      salesRepInviteHandler,
      "sales-commission.invite.sent",
      data,
      { failFirst: true }
    )

    expect(errors).toHaveLength(1)
    expect(errors[0]).toContain("srinv_1")
    expect(errors[0]).not.toContain(TOKEN)
  })
})

describe("the application email to the owner", () => {
  const data = {
    invite_id: "srinv_1",
    applicant_name: "Szabó Gábor",
    email: "gabor@example.com",
    phone: "+36 30 555 0142",
    company: "Szabó Bt.",
    requested_currency_code: "huf",
    recruiter_name: "Peter Nagy",
  }
  const saved = { ...process.env }
  afterEach(() => {
    process.env = { ...saved }
  })

  it("goes to the shop's address and links the review screen in the admin", async () => {
    delete process.env.SALES_COMMISSION_NOTIFY_EMAIL
    delete process.env.CONTACT_EMAIL
    process.env.BACKEND_PUBLIC_URL = "https://admin.infinytree.test"

    const { sent } = await run(
      salesApplicationReceivedHandler,
      "sales-commission.application.received",
      data
    )

    expect(sent).toHaveLength(1)
    expect(sent[0].to).toBe("info@infinytree.com")
    expect(sent[0].content.subject).toBe("New sales rep application: Szabó Gábor")
    expect(sent[0].content.html).toContain(
      "https://admin.infinytree.test/app/sales-reps/applications/srinv_1"
    )
  })

  it("can go to its own address", async () => {
    process.env.CONTACT_EMAIL = "contact@infinytree.test"
    process.env.SALES_COMMISSION_NOTIFY_EMAIL = "sales@infinytree.test"

    const { sent } = await run(
      salesApplicationReceivedHandler,
      "sales-commission.application.received",
      data
    )

    expect(sent[0].to).toBe("sales@infinytree.test")
  })
})

describe("the approval emails", () => {
  const data = {
    invite_id: "srinv_1",
    sales_rep_id: "srep_gabor",
    name: "Szabó Gábor",
    email: "gabor@example.com",
    token: TOKEN,
    recruiter: { name: "Peter Nagy", email: "peter@example.com" },
    locale: "de-AT",
  }

  it("welcomes the new rep with a password link, and tells the recruiter", async () => {
    const { sent } = await run(
      salesApplicationApprovedHandler,
      "sales-commission.application.approved",
      data
    )

    expect(sent.map((n) => [n.to, n.template])).toEqual([
      ["gabor@example.com", "rep-welcome"],
      ["peter@example.com", "rep-recruit-update"],
    ])
    expect(sent[0].content.subject).toBe("Willkommen im Vertriebsteam von Infinytree")
    expect(sent[0].content.html).toContain(
      `/sales-portal/reset-password?token=${TOKEN}&amp;email=gabor%40example.com`
    )
    expect(sent[1].content.subject).toBe("Szabó Gábor ist Ihrem Team beigetreten")
    expect(sent[1].content.html).toContain("/sales-portal/recruits")
    // The recruiter never gets the new rep's link
    expect(sent[1].content.html).not.toContain(TOKEN)
  })

  it("keeps the link token out of what is logged", async () => {
    const { sent } = await run(
      salesApplicationApprovedHandler,
      "sales-commission.application.approved",
      data
    )

    for (const notification of sent) {
      expect(secretsIn(notification)).not.toContain(TOKEN)
    }
  })

  it("still tells the recruiter when the welcome can't be sent", async () => {
    const { sent, errors } = await run(
      salesApplicationApprovedHandler,
      "sales-commission.application.approved",
      data,
      { failFirst: true }
    )

    expect(sent.map((n) => n.template)).toEqual(["rep-recruit-update"])
    expect(errors).toHaveLength(1)
    expect(errors[0]).toContain("srep_gabor")
    expect(errors[0]).not.toContain(TOKEN)
  })
})

describe("the decline emails", () => {
  const data = {
    invite_id: "srinv_1",
    name: "Szabó Gábor",
    email: "gabor@example.com",
    recruiter: { name: "Peter Nagy", email: "peter@example.com" },
    locale: "hu-HU",
  }

  it("tells the candidate and the recruiter, in the invite's language", async () => {
    const { sent } = await run(
      salesApplicationDeclinedHandler,
      "sales-commission.application.declined",
      data
    )

    expect(sent.map((n) => [n.to, n.template])).toEqual([
      ["gabor@example.com", "rep-application-declined"],
      ["peter@example.com", "rep-recruit-update"],
    ])
    expect(sent[0].content.subject).toBe("Infinytree-s jelentkezése")
    expect(sent[1].content.subject).toBe("Tájékoztatás Szabó Gábor meghívásáról")
  })

  it("still tells the recruiter when the candidate's email can't be sent", async () => {
    const { sent } = await run(
      salesApplicationDeclinedHandler,
      "sales-commission.application.declined",
      data,
      { failFirst: true }
    )

    expect(sent.map((n) => n.to)).toEqual(["peter@example.com"])
  })
})
