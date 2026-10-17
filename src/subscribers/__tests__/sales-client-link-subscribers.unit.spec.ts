import salesClientJoinedHandler from "../sales-client-joined"
import salesClientNotLinkedHandler from "../sales-client-not-linked"

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

/** What a reader sees: tags gone, entities decoded */
const text = (html: string) =>
  html
    .replace(/<[^>]+>/g, " ")
    .replace(/&#x27;/g, "'")
    .replace(/&amp;/g, "&")
    .replace(/\s+/g, " ")

const saved = { ...process.env }
beforeEach(() => {
  delete process.env.SALES_COMMISSION_NOTIFY_EMAIL
  delete process.env.CONTACT_EMAIL
  process.env.BACKEND_PUBLIC_URL = "https://admin.infinytree.test"
  process.env.STOREFRONT_PUBLIC_URL = "https://infinytree.test"
})
afterEach(() => {
  process.env = { ...saved }
})

describe("the email about a client who was linked", () => {
  const data = {
    claim_id: "slc_1",
    customer_id: "cus_1",
    client_name: "Green Office Kft.",
    client_email: "office@green.example",
    sales_rep_id: "srep_1",
    rep_name: "Peter Nagy",
    rep_email: "peter@example.com",
    rate: 10,
    locale: "hu-HU",
  }

  it("goes to the rep in their language, and to the owner in English", async () => {
    const { sent } = await run(salesClientJoinedHandler, "sales-commission.client.joined", data)

    expect(sent).toHaveLength(2)
    const [rep, owner] = sent
    expect(rep).toEqual(
      expect.objectContaining({
        to: "peter@example.com",
        channel: "email",
        template: "rep-client-joined",
        resource_id: "slc_1",
      })
    )
    expect(rep.content.subject).toBe("Green Office Kft. az Ön ajánlói linkjén keresztül regisztrált")
    expect(rep.content.html).toContain("https://infinytree.test/sales-portal/client-link")
    expect(owner.to).toBe("info@infinytree.com")
    expect(owner.template).toBe("owner-client-joined")
    expect(owner.content.subject).toBe("New client through Peter Nagy's link: Green Office Kft.")
    expect(owner.content.html).toContain("https://admin.infinytree.test/app/customers/cus_1")
  })

  it("keeps the client's email address from the rep, who never gets it in the portal either", async () => {
    const { sent } = await run(salesClientJoinedHandler, "sales-commission.client.joined", data)
    const [rep] = sent

    expect(rep.content.html).not.toContain("office@green.example")
    expect(JSON.stringify(rep.data)).not.toContain("office@green.example")
  })

  it("goes to the owner's own address when there is one", async () => {
    process.env.CONTACT_EMAIL = "contact@infinytree.test"
    process.env.SALES_COMMISSION_NOTIFY_EMAIL = "sales@infinytree.test"

    const { sent } = await run(salesClientJoinedHandler, "sales-commission.client.joined", data)

    expect(sent[1].to).toBe("sales@infinytree.test")
  })

  it("defaults the rep's email to English", async () => {
    const { sent } = await run(salesClientJoinedHandler, "sales-commission.client.joined", {
      ...data,
      locale: null,
    })

    expect(sent[0].content.subject).toBe("Green Office Kft. joined through your client link")
  })

  it("still tells the owner when the rep's email fails, and logs it without throwing", async () => {
    const { sent, errors } = await run(
      salesClientJoinedHandler,
      "sales-commission.client.joined",
      data,
      { failFirst: true }
    )

    expect(sent).toHaveLength(1)
    expect(sent[0].template).toBe("owner-client-joined")
    expect(errors).toHaveLength(1)
    expect(errors[0]).toContain("slc_1")
  })
})

describe("the email about a client who was not linked", () => {
  const data = {
    claim_id: "slc_2",
    customer_id: "cus_2",
    client_name: "Blue Garden Zrt.",
    client_email: "garden@blue.example",
    sales_rep_id: "srep_1",
    rep_name: "Peter Nagy",
    outcome: "no_rate",
  }

  it.each([
    ["no_rate", "no standard rate for new clients yet"],
    ["rep_inactive", "is deactivated"],
    ["own_account", "is Peter Nagy's own"],
  ])("goes to the owner alone, with the reason (%s)", async (outcome, reason) => {
    const { sent } = await run(salesClientNotLinkedHandler, "sales-commission.client.not_linked", {
      ...data,
      outcome,
    })

    expect(sent).toHaveLength(1)
    expect(sent[0]).toEqual(
      expect.objectContaining({
        to: "info@infinytree.com",
        template: "owner-client-not-linked",
        resource_id: "slc_2",
        data: { outcome },
      })
    )
    expect(sent[0].content.subject).toBe("A new client was not linked to Peter Nagy: Blue Garden Zrt.")
    expect(text(sent[0].content.html)).toContain(reason)
    expect(sent[0].content.html).toContain("https://admin.infinytree.test/app/customers/cus_2")
  })

  it("logs a failure without throwing", async () => {
    const { errors } = await run(
      salesClientNotLinkedHandler,
      "sales-commission.client.not_linked",
      data,
      { failFirst: true }
    )

    expect(errors).toHaveLength(1)
    expect(errors[0]).toContain("slc_2")
  })
})
