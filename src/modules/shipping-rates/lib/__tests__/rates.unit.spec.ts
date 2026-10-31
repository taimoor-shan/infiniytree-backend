import {
  convertFromEuro,
  findZone,
  normalizePostcode,
  normalizeTable,
  parsePostcodeRules,
  quoteDelivery,
  RateLookupError,
  RateTable,
  validateTable,
} from "../rates"
import { INITIAL_RATE_TABLES } from "../initial-rates"

const table = (shippingClass: string, country: string): RateTable => {
  const found = INITIAL_RATE_TABLES.find(
    (t) => t.shipping_class === shippingClass && t.country_code === country
  )
  if (!found) {
    throw new Error(`no ${shippingClass} table for ${country}`)
  }
  return found
}

const price = (
  shippingClass: string,
  country: string,
  postcode: string | null,
  units: number
) => quoteDelivery(table(shippingClass, country), { postcode, units }).amount

describe("postcodes", () => {
  it("compares without spaces, dashes or case", () => {
    expect(normalizePostcode(" 1 010 ")).toBe("1010")
    expect(normalizePostcode("sw1a-1aa")).toBe("SW1A1AA")
    expect(normalizePostcode(undefined)).toBe("")
  })

  it("reads prefixes and ranges, and reports what it cannot read", () => {
    const { rules, invalid } = parsePostcodeRules("8, 90;1000 - 1999\n7x7 12-5")
    expect(rules).toEqual([
      { kind: "prefix", prefix: "8" },
      { kind: "prefix", prefix: "90" },
      { kind: "range", from: 1000, to: 1999, length: 4 },
      { kind: "prefix", prefix: "7X7" },
    ])
    // 12-5 runs backwards
    expect(invalid).toEqual(["12-5"])
  })

  it("refuses a range whose ends have different lengths", () => {
    expect(parsePostcodeRules("10-1999").invalid).toEqual(["10-1999"])
  })
})

describe("finding a zone", () => {
  const zones = [
    { id: "a", name: "A", postcodes: "9", is_fallback: false },
    { id: "b", name: "B", postcodes: "90", is_fallback: false },
    { id: "c", name: "C", postcodes: "1000-1999", is_fallback: false },
    { id: "d", name: "D", postcodes: "", is_fallback: true },
  ]

  it("takes the longest matching entry", () => {
    expect(findZone(zones, "90402")?.zone.id).toBe("b")
    expect(findZone(zones, "81379")?.zone.id).toBe("d")
    expect(findZone(zones, "95100")?.zone.id).toBe("a")
  })

  it("matches a range on the postcode's first digits", () => {
    expect(findZone(zones, "1010")?.zone.id).toBe("c")
    expect(findZone(zones, "1999")?.zone.id).toBe("c")
    expect(findZone(zones, "2000")?.zone.id).toBe("d")
  })

  it("sends an unknown postcode and a missing one to the fallback", () => {
    expect(findZone(zones, "ZZ9")).toMatchObject({
      zone: { id: "d" },
      match: "fallback",
    })
    expect(findZone(zones, "")?.match).toBe("fallback")
    expect(findZone(zones, null)?.zone.id).toBe("d")
  })

  it("finds nothing when no zone is the fallback", () => {
    expect(findZone(zones.slice(0, 3), "5000")).toBeNull()
  })
})

describe("the Sky-Log tariff for Austria", () => {
  it.each([
    ["8010", 80],
    ["1010", 85],
    ["3100", 90],
    ["6020", 100],
  ])("prices one pallet to %s at %i", (postcode, euro) => {
    expect(price("pallet", "at", postcode, 1)).toBe(euro)
  })

  it.each([
    ["8010", 150],
    ["1010", 180],
    ["3100", 200],
    ["6020", 210],
  ])("prices two pallets to %s at %i, as the sheet does", (postcode, euro) => {
    expect(price("pallet", "at", postcode, 2)).toBe(euro)
  })

  it("uses the sheet's 2-pallet price even where two 1-pallet rows add up to less", () => {
    // 85 + 85 = 170 in zone 2, but the sheet's 2-pallet line says 180
    expect(price("pallet", "at", "1010", 2)).toBe(180)
  })

  it("builds three pallets from the 2-pallet row and the 1-pallet row", () => {
    expect(price("pallet", "at", "8010", 3)).toBe(150 + 80)
    expect(price("pallet", "at", "6020", 3)).toBe(210 + 100)
  })

  it("builds four and five pallets from the largest rows first", () => {
    expect(price("pallet", "at", "8010", 4)).toBe(150 + 150)
    expect(price("pallet", "at", "1010", 4)).toBe(180 + 180)
    expect(price("pallet", "at", "8010", 5)).toBe(150 + 150 + 80)
  })

  it("reads the postcode's region, not the whole postcode", () => {
    expect(price("pallet", "at", "8020", 1)).toBe(80)
    expect(price("pallet", "at", "1230", 1)).toBe(85)
  })

  it("charges zone 4, the dearest, to a postcode the sheet does not place", () => {
    const quote = quoteDelivery(table("pallet", "at"), {
      postcode: "5020",
      units: 1,
    })
    expect(quote.zone.name).toBe("Zone 4")
    expect(quote.zone_match).toBe("fallback")
    expect(quote.amount).toBe(100)
  })

  it("uses only the rows switched on", () => {
    const quote = quoteDelivery(table("pallet", "at"), {
      postcode: "8010",
      units: 1,
    })
    expect(quote.breakdown).toEqual([
      {
        tier_id: "p1-50",
        label: "1 pallet / 50 kg, 120 x 80 x 170 cm",
        quantity: 1,
        price: 80,
        times: 1,
      },
    ])
  })
})

describe("the Sky-Log tariff for Germany", () => {
  it.each([
    ["90402", 185],
    ["70173", 200],
    ["15230", 215],
    ["16515", 230],
    ["80331", 230],
  ])("prices one pallet to %s at %i", (postcode, euro) => {
    expect(price("pallet", "de", postcode, 1)).toBe(euro)
  })

  it("prices two pallets from the two-pallet row", () => {
    expect(price("pallet", "de", "90402", 2)).toBe(300)
    expect(price("pallet", "de", "16515", 2)).toBe(345)
  })

  it("switches to another one-pallet row when that is the one on", () => {
    const tariff = structuredClone(table("pallet", "de"))
    tariff.tiers.find((t) => t.id === "p1-50")!.active = false
    tariff.tiers.find((t) => t.id === "p1-100")!.active = true
    expect(quoteDelivery(tariff, { postcode: "90402", units: 1 }).amount).toBe(
      140
    )
  })

  it("takes the cheapest of the one-pallet rows when several are on", () => {
    const tariff = structuredClone(table("pallet", "de"))
    tariff.tiers.forEach((t) => (t.active = true))
    expect(quoteDelivery(tariff, { postcode: "90402", units: 1 }).amount).toBe(
      140
    )
  })
})

describe("fixed rates", () => {
  it("charges 50 euro for each pallet in Hungary", () => {
    expect(price("pallet", "hu", "1011", 1)).toBe(50)
    expect(price("pallet", "hu", "1011", 2)).toBe(100)
    expect(price("pallet", "hu", null, 3)).toBe(150)
  })

  it("charges 50 euro for each carton in all three countries", () => {
    for (const country of ["hu", "at", "de"]) {
      expect(price("carton", country, "1010", 1)).toBe(50)
      expect(price("carton", country, "1010", 2)).toBe(100)
    }
  })
})

describe("the examples in the instructions", () => {
  it("2 Rose Royal: 100 euro", () => {
    expect(price("carton", "at", "1010", 2)).toBe(100)
  })

  it("1 Bonsai + 2 Magnolia in Austria: the 1-pallet price + 100", () => {
    expect(
      price("pallet", "at", "8010", 1) + price("carton", "at", "8010", 2)
    ).toBe(80 + 100)
  })

  it("1 Bonsai + 2 Magnolia in Germany: the 1-pallet price + 100", () => {
    expect(
      price("pallet", "de", "90402", 1) + price("carton", "de", "90402", 2)
    ).toBe(185 + 100)
  })

  it("2 Cherry Blossom + 1 Rose Royal in Hungary: 100 + 50 = 150", () => {
    expect(
      price("pallet", "hu", "1011", 2) + price("carton", "hu", "1011", 1)
    ).toBe(150)
  })
})

describe("covering a quantity", () => {
  const rows = (
    entries: [number, number, boolean?][]
  ): RateTable => ({
    shipping_class: "pallet",
    country_code: "at",
    zones: [{ id: "z", name: "Z", postcodes: "", is_fallback: true }],
    tiers: entries.map(([quantity, euro, active = true], i) => ({
      id: `t${i}`,
      label: `${quantity}`,
      quantity,
      active,
      prices: { z: euro },
    })),
  })

  it("takes the row for the exact quantity over a cheaper combination", () => {
    const quote = quoteDelivery(rows([[1, 40], [2, 100]]), {
      postcode: "",
      units: 2,
    })
    expect(quote.amount).toBe(100)
    expect(quote.breakdown).toEqual([
      { tier_id: "t1", label: "2", quantity: 2, price: 100, times: 1 },
    ])
  })

  it("uses the smallest row for an order smaller than every row", () => {
    expect(
      quoteDelivery(rows([[2, 150], [4, 250]]), { postcode: "", units: 1 })
        .amount
    ).toBe(150)
  })

  it("skips a row with no price in the zone", () => {
    const tariff = rows([[1, 100], [2, 150]])
    tariff.tiers[0].prices = { z: null }
    expect(quoteDelivery(tariff, { postcode: "", units: 2 }).amount).toBe(150)
    expect(quoteDelivery(tariff, { postcode: "", units: 1 }).amount).toBe(150)
  })

  it("rounds to cents", () => {
    expect(
      quoteDelivery(rows([[1, 33.333]]), { postcode: "", units: 3 }).amount
    ).toBe(100)
  })

  it("refuses a quantity that makes no sense", () => {
    for (const units of [0, -1, 1.5, 100000]) {
      expect(() =>
        quoteDelivery(rows([[1, 10]]), { postcode: "", units })
      ).toThrow(RateLookupError)
    }
  })

  it("explains when no zone fits and when a zone has no price", () => {
    const noFallback = rows([[1, 10]])
    noFallback.zones[0].is_fallback = false
    noFallback.zones[0].postcodes = "1"
    expect(() =>
      quoteDelivery(noFallback, { postcode: "5", units: 1 })
    ).toThrow(expect.objectContaining({ code: "no_zone" }))

    const unpriced = rows([[1, 10, false]])
    expect(() =>
      quoteDelivery(unpriced, { postcode: "", units: 1 })
    ).toThrow(expect.objectContaining({ code: "no_price" }))
  })
})

describe("currencies", () => {
  it("leaves euro alone and converts the rest at the rate on file", () => {
    expect(convertFromEuro(100, "eur", {})).toBe(100)
    expect(convertFromEuro(100, "EUR", {})).toBe(100)
    expect(convertFromEuro(50, "huf", { huf: 400 })).toBe(20000)
    expect(convertFromEuro(80, "huf", { huf: 364.58 })).toBe(29166.4)
  })

  it("refuses a currency with no rate", () => {
    expect(() => convertFromEuro(50, "usd", { huf: 400 })).toThrow(
      expect.objectContaining({ code: "no_currency" })
    )
    expect(() => convertFromEuro(50, "huf", { huf: 0 })).toThrow(
      RateLookupError
    )
  })
})

describe("saving a table", () => {
  it("accepts the tables the shop starts with", () => {
    for (const initial of INITIAL_RATE_TABLES) {
      expect(validateTable(normalizeTable(initial))).toEqual([])
    }
  })

  it("cleans what the admin sends", () => {
    const cleaned = normalizeTable({
      shipping_class: " Pallet ",
      country_code: "AT ",
      zones: [{ id: "z", name: " Zone ", postcodes: " 8 ", is_fallback: true }],
      tiers: [
        {
          id: "t",
          label: " row ",
          quantity: "2",
          prices: { z: "150", gone: 5, other: "" },
        },
      ],
    })
    expect(cleaned).toEqual({
      shipping_class: "pallet",
      country_code: "at",
      zones: [{ id: "z", name: "Zone", postcodes: "8", is_fallback: true }],
      tiers: [
        { id: "t", label: "row", quantity: 2, active: true, prices: { z: 150 } },
      ],
    })
  })

  it("turns an empty price into none, so the row skips that zone", () => {
    const cleaned = normalizeTable({
      zones: [{ id: "z", name: "Z" }],
      tiers: [{ id: "t", quantity: 1, prices: { z: "" } }],
    })
    expect(cleaned.tiers[0].prices).toEqual({ z: null })
  })

  it("says what is wrong, in words", () => {
    const bad = normalizeTable({
      shipping_class: "Big Pallets",
      country_code: "austria",
      zones: [
        { id: "a", name: "Zone 1", postcodes: "8, 12-5" },
        { id: "b", name: "Zone 2", postcodes: "8", is_fallback: true },
        { id: "c", name: "Zone 3", postcodes: "", is_fallback: true },
      ],
      tiers: [
        { id: "t", label: "half", quantity: 0.5, prices: { a: -1 } },
      ],
    })
    const problems = validateTable(bad).join("\n")
    expect(problems).toContain("shipping class is a short name")
    expect(problems).toContain("two-letter code")
    expect(problems).toContain('"12-5" is not a postcode start or a range')
    expect(problems).toContain("8 is listed in both Zone 1 and Zone 2")
    expect(problems).toContain("Only one zone can be the fallback")
    expect(problems).toContain("quantity is a whole number from 1")
    expect(problems).toContain("must be 0 or more")
    expect(problems).toContain("Zone 3 has no price in any row that is switched on")
  })

  it("wants a priced, active row for every zone", () => {
    const tariff = structuredClone(table("pallet", "at"))
    tariff.tiers.forEach((t) => (t.active = false))
    expect(validateTable(tariff)).toContain(
      "Zone 1 has no price in any row that is switched on."
    )
  })
})
