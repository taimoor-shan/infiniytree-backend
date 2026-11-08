import { discountCodes, discountFields, discountLabel } from "../order-discount"

// A line (or shipping method) as `retrieveOrder` returns it: the codes sit on its adjustments
const line = (...codes: Array<string | null | undefined>) => ({
  adjustments: codes.map((code) => ({ code })),
})

describe("discountCodes", () => {
  it("lists each code once, in the order the lines show it", () => {
    const order = { items: [line("WELCOME"), line("WELCOME", "VIP"), line()] }

    expect(discountCodes(order)).toEqual(["WELCOME", "VIP"])
  })

  it("reads the shipping methods too, after the items", () => {
    const order = { items: [line("A")], shipping_methods: [line("FREESHIP", "A")] }

    expect(discountCodes(order)).toEqual(["A", "FREESHIP"])
  })

  it("is empty when nothing was discounted", () => {
    const order = { items: [{}, { adjustments: [] }, { adjustments: null }] }

    expect(discountCodes(order)).toEqual([])
  })

  it("skips an adjustment that has no code", () => {
    expect(discountCodes({ items: [line(null, undefined, "", "   ")] })).toEqual([])
  })

  it("trims the code", () => {
    expect(discountCodes({ items: [line("  Real007 ")] })).toEqual(["Real007"])
  })

  it("copes with an order that is missing or has no lines", () => {
    expect(discountCodes(null)).toEqual([])
    expect(discountCodes(undefined)).toEqual([])
    expect(discountCodes({})).toEqual([])
  })
})

describe("discountLabel", () => {
  it("names the code", () => {
    expect(discountLabel("Discount", ["Real007"])).toBe("Discount (Real007)")
  })

  it("names every code of an order that used several", () => {
    expect(discountLabel("Rabatt", ["A", "B"])).toBe("Rabatt (A, B)")
  })

  it("is the plain word when no code explains the reduction", () => {
    expect(discountLabel("Discount")).toBe("Discount")
    expect(discountLabel("Discount", [])).toBe("Discount")
    expect(discountLabel("Discount", null)).toBe("Discount")
  })
})

describe("discountFields", () => {
  it("takes the net discount whether Medusa hands over a number or a BigNumber", () => {
    expect(discountFields({ discount_subtotal: 1090909 }).discount_subtotal).toBe(1090909)
    expect(discountFields({ discount_subtotal: { numeric_: 1090909 } }).discount_subtotal).toBe(1090909)
  })

  it("keeps a net discount of zero: no discount is an answer too", () => {
    expect(discountFields({ discount_subtotal: 0 })).toHaveProperty("discount_subtotal", 0)
  })

  it("leaves the net discount out when the order does not carry one, so the gross figure can serve", () => {
    expect(discountFields({ discount_total: 100 })).not.toHaveProperty("discount_subtotal")
    expect(discountFields(null)).not.toHaveProperty("discount_subtotal")
  })

  it("brings the codes along", () => {
    const order = { discount_subtotal: 10, items: [line("Real007")] }

    expect(discountFields(order)).toEqual({ discount_subtotal: 10, discount_codes: ["Real007"] })
  })
})
