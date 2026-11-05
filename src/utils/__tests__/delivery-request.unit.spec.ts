import {
  countryName,
  deliveryRequestEmailText,
  formatMoney,
} from "../delivery-request"

const request = {
  id: "dreq_1",
  email: "anna@example.gr",
  first_name: "Anna",
  last_name: "Papadopoulou",
  company: "Olive Interiors",
  vat_number: "EL123456789",
  phone: "+30 210 1234567",
  address_1: "Ermou 10",
  address_2: null,
  postal_code: "10563",
  city: "Athens",
  province: null,
  country_code: "gr",
  message: "Delivery to the 3rd floor, no lift.",
  locale: "en",
  currency_code: "eur",
  item_subtotal: 2500,
  items: [
    {
      title: "Cherry Blossom",
      variant_title: "180 cm",
      sku: "CB-180",
      quantity: 2,
      unit_price: 1250,
    },
  ],
  created_at: "2026-11-05T08:00:00.000Z",
}

describe("delivery request email", () => {
  it("names the country", () => {
    expect(countryName("gr")).toBe("Greece")
    expect(countryName("xx")).toBe("XX")
  })

  it("formats money in the cart's currency", () => {
    expect(formatMoney(1250, "eur")).toBe("€1,250.00")
    expect(formatMoney(null, "eur")).toBe("")
  })

  it("lists the products, address, contact and message", () => {
    const { subject, text } = deliveryRequestEmailText(request)

    expect(subject).toBe("Delivery quote request: Greece — Olive Interiors")
    expect(text).toContain("- 2 × Cherry Blossom (180 cm) [CB-180] — €1,250.00 each")
    expect(text).toContain("Products subtotal (net, without delivery): €2,500.00")
    expect(text).toContain("10563 Athens")
    expect(text).toContain("Phone: +30 210 1234567")
    expect(text).toContain("VAT number: EL123456789")
    expect(text).toContain("Delivery to the 3rd floor, no lift.")
    expect(text).not.toMatch(/\n\n\n/)
  })

  it("says when a request was sent again", () => {
    const { subject, text } = deliveryRequestEmailText(
      { ...request, company: null },
      true
    )
    expect(subject).toBe("Updated delivery quote request: Greece — Anna Papadopoulou")
    expect(text.startsWith("Delivery quote request (updated)")).toBe(true)
  })
})
