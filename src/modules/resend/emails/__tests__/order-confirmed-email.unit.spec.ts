import React from "react"
import { renderToString } from "react-dom/server"
import de from "../../i18n/dictionaries/de-DE.json"
import deAT from "../../i18n/dictionaries/de-AT.json"
import en from "../../i18n/dictionaries/en.json"
import hu from "../../i18n/dictionaries/hu-HU.json"
import { OrderConfirmedEmail } from "../OrderConfirmedEmail"

const LANGUAGES: Record<string, Record<string, string>> = {
  en,
  "de-AT": deAT,
  "de-DE": de,
  "hu-HU": hu,
}

const hrefs = (html: string) =>
  [...html.matchAll(/href="([^"]+)"/g)].map((m) => m[1].replace(/&amp;/g, "&"))
// Tags and spaces dropped, so the words a customer reads can be compared in order
const words = (html: string) =>
  html
    .replace(/<[^>]+>/g, "")
    .replace(/&#x27;/g, "'")
    .replace(/&amp;/g, "&")
    .replace(/\s+/g, "")
// Rendered the way service.ts sends it. React Email's render() streams instead, and
// React 18's streaming writer leaves NUL bytes where a multi-byte character meets a buffer edge.
const emailOf = (props: Record<string, unknown>) =>
  renderToString(React.createElement(OrderConfirmedEmail, props as any))

const props = {
  id: "order_01HZ0000000000000000000001",
  display_id: 1001,
  created_at: "2026-10-20T10:00:00.000Z",
  currency_code: "eur",
  items: [{ title: "Olive tree", quantity: 1, unit_price: 120 }],
  total: 120,
  order_url: "https://infinytree.com/order/guest/1001?token=tok_123-abc",
}

describe("OrderConfirmedEmail inspection notice", () => {
  it.each(Object.keys(LANGUAGES))(
    "sits between the View Your Order button and the contact line in %s",
    (locale) => {
      const dictionary = LANGUAGES[locale]
      const keys = [
        "email.orderConfirmed.viewOrder",
        "email.orderConfirmed.inspection.heading",
        "email.orderConfirmed.inspection.inspect",
        "email.orderConfirmed.inspection.report",
        "email.orderConfirmed.inspection.claims",
        "email.orderConfirmed.contactPrefix",
      ]
      for (const key of keys) expect(dictionary).toHaveProperty([key])

      const expected = keys
        .map((key) => dictionary[key])
        .join("")
        .replace("{email}", "info@infinytree.com")

      expect(words(emailOf({ ...props, locale }))).toContain(words(expected))
    }
  )

  it.each(Object.keys(LANGUAGES))("links the address in the notice in %s", (locale) => {
    const links = hrefs(emailOf({ ...props, locale }))

    // one in the notice, one in the contact line under it
    expect(links.filter((href) => href === "mailto:info@infinytree.com")).toHaveLength(2)
  })
})

// What a customer reads: tags gone (React's <!-- --> text separators leave nothing,
// so "−" and an amount stay together), the no-break spaces Intl puts between digit groups made plain
const readable = (html: string) =>
  html
    .replace(/<!--.*?-->/g, "")
    .replace(/<[^>]+>/g, " ")
    .replace(/[  ]/g, " ")
    .replace(/&#x27;/g, "'")
    .replace(/&amp;/g, "&")
    .replace(/\s+/g, " ")

// A Hungarian order with a 20% code. Medusa's discount_total (1 385 454) counts the
// VAT on the discount; discount_subtotal (1 090 909) is the one that fits beside the net rows.
const discounted = {
  ...props,
  currency_code: "huf",
  items: [{ title: "Red Maple Tree", quantity: 1, unit_price: 5454545 }],
  shipping_address: { country_code: "hu" },
  subtotal: 5454545,
  shipping_total: 20000,
  discount_total: 1385454.43,
  discount_subtotal: 1090909,
  discount_codes: ["Real007"],
  tax_total: 1183581.72,
  total: 5567217.72,
}

describe("OrderConfirmedEmail discount", () => {
  it("shows the net discount, so the rows add up to the total", () => {
    const text = readable(emailOf({ ...discounted, locale: "hu-HU" }))

    expect(text).toContain("−1 090 909 Ft")
    expect(text).not.toContain("1 385 454")
  })

  it("names the promotion code in the label", () => {
    expect(readable(emailOf({ ...discounted, locale: "hu-HU" }))).toContain("Kedvezmény (Real007)")
    expect(readable(emailOf({ ...discounted, locale: "de-DE" }))).toContain("Rabatt (Real007)")
    expect(readable(emailOf({ ...discounted, locale: "en" }))).toContain("Discount (Real007)")
  })

  it("names every code when an order used several", () => {
    const text = readable(emailOf({ ...discounted, discount_codes: ["WELCOME", "VIP"], locale: "en" }))

    expect(text).toContain("Discount (WELCOME, VIP)")
  })

  it("is only called Discount when no code explains it", () => {
    const text = readable(emailOf({ ...discounted, discount_codes: undefined, locale: "en" }))

    expect(text).toContain("Discount −")
  })

  it("falls back to the discount with VAT for an email queued before the net one was sent", () => {
    const { discount_subtotal: _net, discount_codes: _codes, ...old } = discounted

    expect(readable(emailOf({ ...old, locale: "hu-HU" }))).toContain("−1 385 454 Ft")
  })

  it("has no discount row for an order without one", () => {
    const none = { ...discounted, discount_total: 0, discount_subtotal: 0, discount_codes: [] }

    expect(readable(emailOf({ ...none, locale: "hu-HU" }))).not.toContain("Kedvezmény")
  })

  it("writes the VAT row in the customer's language", () => {
    expect(readable(emailOf({ ...discounted, locale: "hu-HU" }))).toContain("ÁFA (27%)")
    expect(readable(emailOf({ ...discounted, locale: "en" }))).toContain("VAT (27%)")

    const abroad = { ...discounted, shipping_address: { country_code: "de" } }
    expect(readable(emailOf({ ...abroad, locale: "de-DE" }))).toContain("MwSt. (0%)")
  })
})

describe("the inspection notice dictionary entries", () => {
  const keys = (dictionary: Record<string, string>) =>
    Object.keys(dictionary).filter((key) => key.startsWith("email.orderConfirmed.inspection."))
  const placeholders = (value: string) => [...new Set([...value.matchAll(/\{(\w+)\}/g)].map((m) => m[1]))].sort()

  it("has the notice's words", () => {
    expect(keys(en).length).toBeGreaterThan(0)
  })

  it("has every key in every language", () => {
    for (const dictionary of [de, deAT, hu]) {
      expect(keys(dictionary).sort()).toEqual(keys(en).sort())
    }
  })

  it("keeps each placeholder the English text uses", () => {
    for (const dictionary of [de, deAT, hu]) {
      for (const key of keys(en)) {
        expect([key, placeholders((dictionary as Record<string, string>)[key])]).toEqual([
          key,
          placeholders((en as Record<string, string>)[key]),
        ])
      }
    }
  })
})
