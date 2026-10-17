import { render } from "@react-email/components"
import React from "react"
import { OwnerClientLinkEmail } from "../OwnerClientLinkEmail"
import { RepClientJoinedEmail } from "../RepClientJoinedEmail"

const STOREFRONT = "https://infinytree.com"
const LOCALES = ["en", "de-AT", "de-DE", "hu-HU"]

const hrefs = (html: string) =>
  [...html.matchAll(/href="([^"]+)"/g)].map((m) => m[1].replace(/&amp;/g, "&"))
const text = (html: string) =>
  html
    .replace(/<[^>]+>/g, " ")
    .replace(/&#x27;/g, "'")
    .replace(/&amp;/g, "&")
    .replace(/\s+/g, " ")
const emailOf = (component: React.ComponentType<any>, props: Record<string, unknown>) =>
  render(React.createElement(component, { storefront_url: STOREFRONT, ...props }))

describe("RepClientJoinedEmail", () => {
  const props = { client_name: "Green Office Kft.", rate: 7.5, rep_name: "Peter Nagy" }

  it("tells the rep who joined and what they earn, and links their client page in the portal", async () => {
    const html = await emailOf(RepClientJoinedEmail, props)

    expect(hrefs(html)).toContain(`${STOREFRONT}/sales-portal/client-link`)
    expect(text(html)).toContain("Hello Peter Nagy,")
    expect(text(html)).toContain("Green Office Kft. signed up through your client link")
    expect(text(html)).toContain("7.5%")
  })

  it("is written in the rep's language, with the rate as that language writes it", async () => {
    const hungarian = text(await emailOf(RepClientJoinedEmail, { ...props, locale: "hu-HU" }))
    const german = text(await emailOf(RepClientJoinedEmail, { ...props, locale: "de-AT" }))

    expect(hungarian).toContain("Új ügyfele van")
    expect(hungarian).toContain("7,5%")
    expect(german).toContain("Sie haben einen neuen Kunden")
    expect(german).toContain("7,5 %")
  })

  it("leaves no placeholder or missing key showing, in any language or without a name", async () => {
    for (const locale of LOCALES) {
      for (const rep_name of ["Peter Nagy", undefined]) {
        const html = text(await emailOf(RepClientJoinedEmail, { ...props, rep_name, locale }))
        expect(html).not.toMatch(/\{\w+\}/)
        expect(html).not.toContain("email.rep")
        expect(html).toContain("Green Office Kft.")
      }
    }
  })

  it("falls back to English for a language it doesn't have", async () => {
    const html = text(await emailOf(RepClientJoinedEmail, { ...props, locale: "fr-FR" }))

    expect(html).toContain("You have a new client")
  })
})

describe("OwnerClientLinkEmail", () => {
  const props = {
    client_name: "Green Office Kft.",
    client_email: "office@green.example",
    rep_name: "Peter Nagy",
    customer_url: "https://admin.infinytree.test/app/customers/cus_1",
  }

  it("says a client was linked, at what rate, and links the customer", async () => {
    const html = await emailOf(OwnerClientLinkEmail, { ...props, outcome: "joined", rate: 10 })

    expect(hrefs(html)).toContain(props.customer_url)
    expect(text(html)).toContain("Green Office Kft. signed up through Peter Nagy's client link")
    expect(text(html)).toContain("linked to Peter Nagy at 10%")
    expect(text(html)).toContain("office@green.example")
    expect(text(html)).not.toContain("could not be linked")
  })

  it.each([
    ["no_rate", "no standard rate for new clients yet"],
    ["rep_inactive", "is deactivated"],
    ["own_account", "is Peter Nagy's own"],
  ])("explains why a client was not linked (%s)", async (outcome, reason) => {
    const html = text(await emailOf(OwnerClientLinkEmail, { ...props, outcome }))

    expect(html).toContain("could not be linked to Peter Nagy")
    expect(html).toContain(reason)
    expect(html).not.toMatch(/\{\w+\}/)
    expect(html).not.toContain("email.ownerClient")
  })
})
