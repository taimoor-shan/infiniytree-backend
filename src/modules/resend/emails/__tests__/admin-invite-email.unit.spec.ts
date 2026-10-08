import { render } from "@react-email/components"
import React from "react"
import de from "../../i18n/dictionaries/de-DE.json"
import deAT from "../../i18n/dictionaries/de-AT.json"
import en from "../../i18n/dictionaries/en.json"
import hu from "../../i18n/dictionaries/hu-HU.json"
import { AdminInviteEmail } from "../AdminInviteEmail"

const INVITE_URL = "https://api.infinytree.com/app/invite?token=tok_123-abc"

const hrefs = (html: string) =>
  [...html.matchAll(/href="([^"]+)"/g)].map((m) => m[1].replace(/&amp;/g, "&"))
const text = (html: string) =>
  html
    .replace(/<[^>]+>/g, " ")
    .replace(/&#x27;/g, "'")
    .replace(/&amp;/g, "&")
    .replace(/\s+/g, " ")
const emailOf = (props: Record<string, unknown>) =>
  render(React.createElement(AdminInviteEmail, props as any))

describe("AdminInviteEmail", () => {
  const props = { invite_url: INVITE_URL, expires_at: "2026-10-09T17:15:00.000Z" }

  it("links the button to the admin's accept page", async () => {
    const html = await emailOf(props)

    expect(hrefs(html)).toContain(INVITE_URL)
    expect(text(html)).toContain("You're invited to the Infinytree admin")
    expect(text(html)).toContain("Accept invitation")
  })

  it("gives the link as text too, for mail clients that don't show the button", async () => {
    const html = text(await emailOf(props))

    expect(html).toContain(INVITE_URL)
  })

  it("says until when the invitation works, in the shop's time zone", async () => {
    const html = text(await emailOf(props))

    expect(html).toContain("October 9, 2026")
    expect(html).toContain("19:15")
  })

  it("leaves no placeholder or missing key showing", async () => {
    for (const locale of ["en", "de-AT", "de-DE", "hu-HU"]) {
      const html = text(await emailOf({ ...props, locale }))
      expect(html).not.toMatch(/\{\w+\}/)
      expect(html).not.toContain("email.adminInvite")
    }
  })
})

describe("the admin invite dictionary entries", () => {
  const keys = (dictionary: Record<string, string>) =>
    Object.keys(dictionary).filter((key) => /^email\.(adminInvite|subject\.adminInvite)/.test(key))
  const placeholders = (value: string) => [...new Set([...value.matchAll(/\{(\w+)\}/g)].map((m) => m[1]))].sort()

  it("has the email's words", () => {
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
