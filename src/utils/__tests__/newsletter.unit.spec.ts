import {
  consentTextFor,
  hashNewsletterToken,
  newsletterConfirmationEmail,
  newsletterLink,
  newToken,
  normalizeEmail,
} from "../newsletter"

describe("newsletter double opt-in", () => {
  it("keeps only the hash of a token", () => {
    const { raw, hash } = newToken()
    expect(raw.length).toBeGreaterThan(20)
    expect(hash).toBe(hashNewsletterToken(raw))
    expect(hash).not.toContain(raw)
  })

  it("lower-cases and trims emails", () => {
    expect(normalizeEmail("  Anna@Example.COM ")).toBe("anna@example.com")
  })

  it("builds the confirmation link on the storefront", () => {
    expect(newsletterLink("https://infinytree.com/", "confirm", "a b")).toBe(
      "https://infinytree.com/newsletter/confirm?token=a%20b"
    )
  })

  it("writes the email and consent in the visitor's language", () => {
    const de = newsletterConfirmationEmail({ locale: "de-AT", confirmUrl: "X" })
    expect(de.subject).toContain("bestätigen")
    expect(de.text).toContain("X")
    expect(consentTextFor("hu-HU")).toContain("hírlevelét")
    expect(consentTextFor("fr")).toContain("newsletter")
  })
})
