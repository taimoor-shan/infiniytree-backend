import { render } from "@react-email/components"
import React from "react"
import { PasswordResetEmail } from "../PasswordResetEmail"

const hrefs = (html: string) =>
  [...html.matchAll(/href="([^"]+)"/g)].map((m) => m[1].replace(/&amp;/g, "&"))

const renderEmail = (props: { entity_id: string; actor_type: string }) =>
  render(
    React.createElement(PasswordResetEmail, {
      token: "tok",
      storefront_url: "https://infinytree.com",
      ...props,
    })
  )

describe("PasswordResetEmail", () => {
  it("links a customer to the account's reset page", async () => {
    const html = await renderEmail({
      entity_id: "buyer@example.com",
      actor_type: "customer",
    })

    expect(hrefs(html)).toContain(
      "https://infinytree.com/account/reset-password?token=tok&email=buyer%40example.com"
    )
  })

  it("links a sales rep to the sales portal's reset page", async () => {
    const html = await renderEmail({
      entity_id: "peter@example.com",
      actor_type: "sales_rep",
    })

    const links = hrefs(html)
    expect(links).toContain(
      "https://infinytree.com/sales-portal/reset-password?token=tok&email=peter%40example.com"
    )
    expect(links.some((link) => link.includes("/account/reset-password"))).toBe(false)
  })
})
