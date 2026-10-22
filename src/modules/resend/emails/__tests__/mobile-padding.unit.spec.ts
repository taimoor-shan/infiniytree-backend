import fs from "fs"
import path from "path"
import React from "react"
import { renderToString } from "react-dom/server"
import { AdminInviteEmail } from "../AdminInviteEmail"
import { EmailVerificationEmail } from "../EmailVerificationEmail"
import { OrderConfirmedEmail } from "../OrderConfirmedEmail"
import { OrderDeliveredEmail } from "../OrderDeliveredEmail"
import { OrderInProgressEmail } from "../OrderInProgressEmail"
import { OrderShippedEmail } from "../OrderShippedEmail"
import { OrderTransferEmail } from "../OrderTransferEmail"
import { OwnerClientLinkEmail } from "../OwnerClientLinkEmail"
import { PasswordResetEmail } from "../PasswordResetEmail"
import { RepApplicationDeclinedEmail } from "../RepApplicationDeclinedEmail"
import { RepApplicationReceivedEmail } from "../RepApplicationReceivedEmail"
import { RepClientJoinedEmail } from "../RepClientJoinedEmail"
import { RepInviteEmail } from "../RepInviteEmail"
import { RepRecruitUpdateEmail } from "../RepRecruitUpdateEmail"
import { RepWelcomeEmail } from "../RepWelcomeEmail"
import { ShippingUpdateEmail } from "../ShippingUpdateEmail"
import { WelcomeEmail } from "../WelcomeEmail"
import { EmailLayout } from "../layout"

// On a phone no email padding may be wider than 1rem. Email clients can't read a
// stylesheet's rem, so the layout works in px: 1rem is 16px.
const MAX_PADDING = 16
// The phone rule has to reach the widest phones (about 430px), not just a 375px iPhone
const PHONE_MAX_WIDTH = 480

const ORDER_URL = "https://infinytree.com/order/guest/1001?token=tok_123-abc"
const ORDER = {
  order_id: "order_01HZ0000000000000000000001",
  display_id: 1001,
  order_url: ORDER_URL,
}

// One of each template, rendered with enough props to show every button and box it has
const CASES: Record<string, [React.ComponentType<any>, Record<string, unknown>]> = {
  AdminInviteEmail: [
    AdminInviteEmail,
    { invite_url: "https://admin.infinytree.com/invite?token=tok", expires_at: "2026-10-21T10:00:00.000Z" },
  ],
  EmailVerificationEmail: [EmailVerificationEmail, { code: "123456", entity_id: "anna@example.com" }],
  OrderConfirmedEmail: [
    OrderConfirmedEmail,
    {
      id: ORDER.order_id,
      display_id: 1001,
      created_at: "2026-10-20T10:00:00.000Z",
      currency_code: "eur",
      items: [{ title: "Olive tree", quantity: 1, unit_price: 120 }],
      total: 120,
      order_url: ORDER_URL,
      invoice_url: "https://infinytree.com/api/invoice/1001",
    },
  ],
  OrderDeliveredEmail: [OrderDeliveredEmail, ORDER],
  OrderInProgressEmail: [OrderInProgressEmail, ORDER],
  OrderShippedEmail: [
    OrderShippedEmail,
    { ...ORDER, tracking_numbers: ["1Z999AA10123456784"], tracking_url: "https://track.example.com/1Z999" },
  ],
  OrderTransferEmail: [
    OrderTransferEmail,
    { order_id: ORDER.order_id, token: "tok_123", original_email: "anna@example.com" },
  ],
  OwnerClientLinkEmail: [
    OwnerClientLinkEmail,
    {
      outcome: "joined",
      client_name: "Muster GmbH",
      client_email: "office@muster.example",
      rep_name: "Peter Nagy",
      rate: 7.5,
      customer_url: "https://admin.infinytree.com/customers/cus_1",
    },
  ],
  PasswordResetEmail: [PasswordResetEmail, { token: "tok_123", entity_id: "anna@example.com", actor_type: "customer" }],
  RepApplicationDeclinedEmail: [RepApplicationDeclinedEmail, { name: "Anna" }],
  RepApplicationReceivedEmail: [
    RepApplicationReceivedEmail,
    {
      applicant_name: "Anna Muster",
      email: "anna@example.com",
      recruiter_name: "Peter Nagy",
      review_url: "https://admin.infinytree.com/sales-reps/applications/1",
    },
  ],
  RepClientJoinedEmail: [RepClientJoinedEmail, { client_name: "Muster GmbH", rate: 7.5, rep_name: "Peter Nagy" }],
  RepInviteEmail: [
    RepInviteEmail,
    { token: "tok_123", name: "Anna", recruiter_name: "Peter Nagy", expires_at: "2026-10-21T10:00:00.000Z" },
  ],
  RepRecruitUpdateEmail: [RepRecruitUpdateEmail, { outcome: "approved", name: "Anna", recruiter_name: "Peter Nagy" }],
  RepWelcomeEmail: [RepWelcomeEmail, { token: "tok_123", email: "anna@example.com", name: "Anna" }],
  ShippingUpdateEmail: [ShippingUpdateEmail, { ...ORDER, tracking_numbers: ["1Z999AA10123456784"] }],
  WelcomeEmail: [WelcomeEmail, { first_name: "Anna" }],
}

// Rendered the way service.ts sends it
const emailOf = (component: React.ComponentType<any>, props: Record<string, unknown>) =>
  renderToString(React.createElement(component, { storefront_url: "https://infinytree.com", ...props }))

type Sides = { left?: number; right?: number }

const px = (value: string): number => {
  const match = /^(\d+(?:\.\d+)?)(px)?$/.exec(value)
  if (!match || (match[2] === undefined && Number(match[1]) !== 0)) {
    throw new Error(`Unsupported padding value "${value}" — the phone rule only knows px`)
  }
  return Number(match[1])
}

/** The left and right padding, in px, that a stylesheet declaration block sets, later declarations winning. */
const horizontalPadding = (declarations: string): Sides => {
  const sides: Sides = {}
  for (const declaration of declarations.split(";")) {
    const [property, ...rest] = declaration.split(":")
    const value = rest.join(":").replace(/!important/, "").trim()
    switch (property.trim()) {
      case "padding": {
        const v = value.split(/\s+/).map(px)
        // CSS shorthand: 1 value = all sides, 2 = vertical horizontal, 3 = top horizontal bottom, 4 = t r b l
        sides.right = v.length === 1 ? v[0] : v[1]
        sides.left = v.length === 4 ? v[3] : v.length === 1 ? v[0] : v[1]
        break
      }
      case "padding-left":
        sides.left = px(value)
        break
      case "padding-right":
        sides.right = px(value)
        break
    }
  }
  return sides
}

/** The phone media query in the <head>: its widest screen and, per class, the padding it forces. */
const phoneRules = (html: string) => {
  const head = /<head>([\s\S]*?)<\/head>/.exec(html)?.[1] ?? ""
  const css = /<style[^>]*>([\s\S]*?)<\/style>/.exec(head)?.[1] ?? ""
  const media = /@media\s+only\s+screen\s+and\s+\(max-width:\s*(\d+)px\)\s*\{([\s\S]*)\}/.exec(css)
  const classes: Record<string, Sides> = {}
  for (const [, name, declarations] of (media?.[2] ?? "").matchAll(/\.([\w-]+)\s*\{([^}]*)\}/g)) {
    // Inline styles win over a stylesheet unless the rule is !important
    classes[name] = /!important/.test(declarations) ? horizontalPadding(declarations) : {}
  }
  return { css, maxWidth: media ? Number(media[1]) : 0, classes }
}

/** Every element whose inline padding is wider than 1rem on a side that no phone rule narrows. */
const uncappedPadding = (html: string): string[] => {
  const { classes } = phoneRules(html)
  const offenders: string[] = []
  for (const [tag, attributes] of html.matchAll(/<[a-z][a-z0-9]*\b([^>]*)>/g)) {
    const style = /\sstyle="([^"]*)"/.exec(attributes)?.[1]
    if (!style) continue
    const own = horizontalPadding(style)
    const applied = (/\sclass="([^"]*)"/.exec(attributes)?.[1] ?? "").split(/\s+/).map((name) => classes[name] ?? {})
    for (const side of ["left", "right"] as const) {
      const wanted = own[side] ?? 0
      const capped = applied.some((rule) => rule[side] !== undefined && rule[side]! <= MAX_PADDING)
      if (wanted > MAX_PADDING && !capped) offenders.push(`${side} ${wanted}px on ${tag.slice(0, 90)}`)
    }
  }
  return offenders
}

describe("email padding on phones", () => {
  it("has a fixture for every email template", () => {
    const templates = fs
      .readdirSync(path.join(__dirname, ".."))
      .filter((file) => /Email\.tsx$/.test(file))
      .map((file) => file.replace(/\.tsx$/, ""))

    expect(Object.keys(CASES).sort()).toEqual(templates.sort())
  })

  it("narrows the layout's side padding to 1rem at phone width", () => {
    const { css, maxWidth, classes } = phoneRules(renderToString(React.createElement(EmailLayout, null, "Hello")))

    expect(css).toContain("@media")
    expect(maxWidth).toBeGreaterThanOrEqual(PHONE_MAX_WIDTH)
    expect(Object.values(classes)).toContainEqual({ left: MAX_PADDING, right: MAX_PADDING })
  })

  it("keeps the CSS readable, not HTML-escaped", () => {
    const { css } = phoneRules(renderToString(React.createElement(EmailLayout, null, "Hello")))

    expect(css).not.toMatch(/&(?:amp|lt|gt|quot|#x27);/)
  })

  it.each(Object.keys(CASES))("%s has no horizontal padding over 1rem on a phone", (name) => {
    const [component, props] = CASES[name]

    expect(uncappedPadding(emailOf(component, props))).toEqual([])
  })
})
