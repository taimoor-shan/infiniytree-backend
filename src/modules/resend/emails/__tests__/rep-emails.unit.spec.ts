import { render } from "@react-email/components"
import React from "react"
import de from "../../i18n/dictionaries/de-DE.json"
import deAT from "../../i18n/dictionaries/de-AT.json"
import en from "../../i18n/dictionaries/en.json"
import hu from "../../i18n/dictionaries/hu-HU.json"
import { RepApplicationDeclinedEmail } from "../RepApplicationDeclinedEmail"
import { RepApplicationReceivedEmail } from "../RepApplicationReceivedEmail"
import { RepInviteEmail } from "../RepInviteEmail"
import { RepRecruitUpdateEmail } from "../RepRecruitUpdateEmail"
import { RepWelcomeEmail } from "../RepWelcomeEmail"

const STOREFRONT = "https://infinytree.com"

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

describe("RepInviteEmail", () => {
  const props = {
    token: "tok_123-abc",
    name: "Gabor Szabo",
    recruiter_name: "Peter Nagy",
    expires_at: "2026-10-21T10:00:00.000Z",
  }

  it("links the candidate to their personal page in the sales portal", async () => {
    const html = await emailOf(RepInviteEmail, props)

    expect(hrefs(html)).toContain(`${STOREFRONT}/sales-portal/join/tok_123-abc?lang=en`)
    expect(text(html)).toContain("Peter Nagy")
    expect(text(html)).toContain("Hello Gabor Szabo,")
    expect(text(html)).toContain("works until October 21, 2026")
  })

  it("is written in the recruiter's language", async () => {
    const hungarian = text(await emailOf(RepInviteEmail, { ...props, locale: "hu-HU" }))
    const german = text(await emailOf(RepInviteEmail, { ...props, locale: "de-AT" }))

    expect(hungarian).toContain("Meghívást kapott értékesítői csapatunkba")
    expect(hungarian).toContain("/sales-portal/join/tok_123-abc?lang=hu-HU")
    expect(german).toContain("?lang=de-AT")
    expect(hungarian).toContain("2026. október 21.")
    // The Hungarian date ends in a full stop of its own
    expect(hungarian).not.toContain("21..")
    expect(german).toContain("Sie sind in unser Vertriebsteam eingeladen")
    expect(german).toContain("21. Oktober 2026")
  })

  it("falls back to English for a language it doesn't have", async () => {
    const html = text(await emailOf(RepInviteEmail, { ...props, locale: "fr-FR" }))

    expect(html).toContain("You're invited to join our sales team")
    // ... and the date follows the language that is used
    expect(html).toContain("works until October 21, 2026")
  })

  it("leaves no placeholder or missing key showing", async () => {
    for (const locale of ["en", "de-AT", "de-DE", "hu-HU"]) {
      const html = text(await emailOf(RepInviteEmail, { ...props, locale }))
      expect(html).not.toMatch(/\{\w+\}/)
      expect(html).not.toContain("email.rep")
    }
  })
})

describe("RepWelcomeEmail", () => {
  const props = {
    token: "tok",
    email: "gabor@example.com",
    name: "Gabor Szabo",
    recruiter_name: "Peter Nagy",
  }

  it("links to the sales portal's page for setting a password", async () => {
    const html = await emailOf(RepWelcomeEmail, props)

    expect(hrefs(html)).toContain(
      `${STOREFRONT}/sales-portal/reset-password?token=tok&email=gabor%40example.com`
    )
    expect(hrefs(html).some((link) => link.includes("/account/"))).toBe(false)
    expect(text(html)).toContain("Your login is gabor@example.com")
    expect(text(html)).toContain("You joined through Peter Nagy")
    expect(text(html)).toContain("7 days")
  })

  it("works without a recruiter and in every language", async () => {
    for (const locale of ["en", "de-AT", "de-DE", "hu-HU"]) {
      const html = text(await emailOf(RepWelcomeEmail, { ...props, recruiter_name: undefined, locale }))
      expect(html).not.toMatch(/\{\w+\}/)
      expect(html).not.toContain("email.rep")
      expect(html).not.toContain("Peter Nagy")
    }
  })
})

describe("RepApplicationDeclinedEmail", () => {
  it("gives the outcome and thanks them", async () => {
    const html = text(await emailOf(RepApplicationDeclinedEmail, { name: "Gabor Szabo" }))

    expect(html).toContain("Hello Gabor Szabo,")
    expect(html).toContain("we can't offer you a place on the team at this time")
  })

  it("is written in the candidate's language", async () => {
    const html = text(await emailOf(RepApplicationDeclinedEmail, { name: "Gábor", locale: "hu-HU" }))

    expect(html).toContain("Kedves Gábor!")
    expect(html).toContain("nem tudunk helyet felajánlani")
  })
})

describe("RepRecruitUpdateEmail", () => {
  const props = { name: "Gabor Szabo", recruiter_name: "Peter Nagy" }

  it("tells the recruiter their recruit joined, with a link to the portal's recruits", async () => {
    const html = await emailOf(RepRecruitUpdateEmail, { ...props, outcome: "approved" })

    expect(text(html)).toContain("Gabor Szabo joined your team")
    expect(text(html)).toContain("Hello Peter Nagy,")
    expect(hrefs(html)).toContain(`${STOREFRONT}/sales-portal/recruits`)
  })

  it("tells the recruiter the application wasn't approved, without saying why", async () => {
    const html = text(await emailOf(RepRecruitUpdateEmail, { ...props, outcome: "declined" }))

    expect(html).toContain("An update on your invitation to Gabor Szabo")
    expect(html).toContain("decided not to go ahead")
  })

  it("exists in every language, for both outcomes", async () => {
    for (const locale of ["en", "de-AT", "de-DE", "hu-HU"]) {
      for (const outcome of ["approved", "declined"]) {
        const html = text(await emailOf(RepRecruitUpdateEmail, { ...props, outcome, locale }))
        expect(html).not.toMatch(/\{\w+\}/)
        expect(html).not.toContain("email.rep")
      }
    }
  })
})

describe("RepApplicationReceivedEmail", () => {
  const props = {
    applicant_name: "Szabó Gábor",
    email: "gabor@example.com",
    phone: "+36 30 555 0142",
    company: "Szabó Bt.",
    requested_currency_code: "huf",
    recruiter_name: "Peter Nagy",
    review_url: "https://admin.test/app/sales-reps/applications/srinv_1",
  }

  it("lists what the candidate gave and links to the review screen", async () => {
    const html = await emailOf(RepApplicationReceivedEmail, props)

    expect(hrefs(html)).toContain(props.review_url)
    for (const value of ["Szabó Gábor", "gabor@example.com", "+36 30 555 0142", "Szabó Bt.", "HUF", "Peter Nagy"]) {
      expect(text(html)).toContain(value)
    }
  })

  it("leaves out what they didn't give", async () => {
    const html = text(
      await emailOf(RepApplicationReceivedEmail, { ...props, phone: null, company: undefined })
    )

    expect(html).not.toContain("Phone")
    expect(html).not.toContain("Company or tax number")
  })
})

describe("the sales-team dictionaries", () => {
  const keys = (dictionary: Record<string, string>) =>
    Object.keys(dictionary).filter((key) => /^email\.(rep|subject\.rep)/.test(key))
  // The same few placeholders, however often a language repeats them
  const placeholders = (value: string) => [...new Set([...value.matchAll(/\{(\w+)\}/g)].map((m) => m[1]))].sort()

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

  it("translates what candidates and reps read; only the owner's email stays English", () => {
    for (const dictionary of [de, hu]) {
      for (const key of keys(en)) {
        if (/^email\.(repApplication|subject\.repApplication)/.test(key)) {
          continue
        }
        expect([key, (dictionary as Record<string, string>)[key]]).not.toEqual([
          key,
          (en as Record<string, string>)[key],
        ])
      }
    }
  })
})
