import {
  formatReceivedAt,
  withdrawalAlertEmail,
  withdrawalConfirmationEmail,
  withdrawalLanguage,
} from "../withdrawal"
import { parseOrderNumber } from "../../workflows/steps/create-withdrawal-request"

const request = {
  id: "wdr_123",
  name: "Anna Muster",
  email: "anna@example.com",
  order_number: "1042",
  order_display_id: 1042,
  items: null,
  message: null,
  locale: "de-AT",
  created_at: "2026-11-19T18:05:00.000Z",
}

describe("withdrawal emails", () => {
  it("picks the language from the locale", () => {
    expect(withdrawalLanguage("de-AT")).toBe("de")
    expect(withdrawalLanguage("hu-HU")).toBe("hu")
    expect(withdrawalLanguage("fr")).toBe("en")
    expect(withdrawalLanguage(null)).toBe("en")
  })

  it("states the moment of receipt in Budapest time", () => {
    expect(formatReceivedAt(request.created_at, "en")).toContain("19:05")
  })

  it("confirms the declaration in German with what was declared and when", () => {
    const { subject, text } = withdrawalConfirmationEmail(request)
    expect(subject).toContain("1042")
    expect(text).toContain("Guten Tag Anna Muster")
    expect(text).toContain("Eingegangen am")
    expect(text).toContain("die gesamte Bestellung")
    expect(text).toContain("wdr_123")
  })

  it("names the products and message when given", () => {
    const { text } = withdrawalConfirmationEmail({
      ...request,
      locale: "en",
      items: "Red Maple",
      message: "Too large",
    })
    expect(text).toContain("Withdrawal covers: Red Maple")
    expect(text).toContain("Your message: Too large")
  })

  it("tells the shop when the order could not be matched", () => {
    const { subject, text } = withdrawalAlertEmail({
      ...request,
      order_display_id: null,
    })
    expect(subject).toContain("not matched")
    expect(text).toContain("check by hand")
  })

  it("says so when the customer's confirmation could not be sent", () => {
    expect(withdrawalAlertEmail(request).text).toContain("has been sent a confirmation")
    const { text } = withdrawalAlertEmail(request, { confirmationSent: false })
    expect(text).toContain("could NOT be sent")
    expect(text).not.toContain("has been sent a confirmation")
  })
})

describe("parseOrderNumber", () => {
  it("reads one order number with decoration", () => {
    expect(parseOrderNumber("#1042")).toBe(1042)
    expect(parseOrderNumber("Nr. 1042 ")).toBe(1042)
  })

  it("does not join separate numbers into another order", () => {
    expect(parseOrderNumber("#1 / #2")).toBeNull()
    expect(parseOrderNumber("no number")).toBeNull()
  })
})
