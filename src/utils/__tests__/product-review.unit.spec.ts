import {
  germanGaps,
  ProductSnapshot,
  reviewProduct,
  ReviewVariant,
} from "../product-review"

const regions = [
  { id: "reg_eu", name: "Europe", currency: "eur" },
  { id: "reg_hu", name: "Hungary", currency: "huf" },
]

const variant = (overrides: Partial<ReviewVariant> = {}): ReviewVariant => ({
  title: "Default variant",
  manageInventory: true,
  allowBackorder: false,
  prices: [
    { currency: "eur", amount: 1990 },
    { currency: "eur", amount: 1990, regionId: "reg_eu" },
    { currency: "huf", amount: 720000 },
    { currency: "huf", amount: 720000, regionId: "reg_hu" },
  ],
  available: 3,
  ...overrides,
})

const complete: ProductSnapshot = {
  id: "prod_1",
  title: "Olive Tree",
  handle: "olive-tree",
  status: "published",
  thumbnail: "https://example.test/olive.jpg",
  images: 3,
  categories: ["Trees"],
  tags: [],
  shippingProfile: { name: "Pallet products", type: "pallet" },
  salesChannels: ["Default Sales Channel"],
  options: [{ title: "Default option", values: ["Default option value"] }],
  variants: [variant()],
  regions,
  records: [
    { reference: "product", id: "prod_1", label: "product", fields: ["title"] },
  ],
  germanRows: [{ reference: "product", reference_id: "prod_1", fields: ["title"] }],
  metadata: {
    short_description: JSON.stringify({ en: "A tree", "de-DE": "Ein Baum", "hu-HU": "Fa" }),
    seo_title: JSON.stringify({ en: "Olive Tree", "de-DE": "Olivenbaum", "hu-HU": "Olajfa" }),
    seo_description: JSON.stringify({ en: "A tree.", "de-DE": "Ein Baum.", "hu-HU": "Fa." }),
    key_features: JSON.stringify([{ en: "Hardy", "de-DE": "Robust", "hu-HU": "Szívós" }]),
    approx_dimensions: JSON.stringify({ height: "200–220", unit: "cm" }),
  },
}

describe("reviewProduct", () => {
  it("has nothing to say about a product that is complete", () => {
    const review = reviewProduct(complete)

    expect(review.problems).toEqual([])
    expect(review.warnings).toEqual([])
    expect(review.todo).toEqual([])
    expect(review.lines.join("\n")).toContain("Price Europe")
    expect(review.lines.join("\n")).toContain("EUR 1,990")
    expect(review.lines.join("\n")).toContain("HUF 720,000")
    expect(review.lines.join("\n")).toContain("3 available")
  })

  it("reads a draft with no pictures, price or stock the way the storefront will", () => {
    const review = reviewProduct({
      ...complete,
      status: "draft",
      images: 0,
      thumbnail: null,
      variants: [variant({ prices: [], available: 0, title: "Blue" })],
    })
    const text = review.lines.join("\n")

    expect(review.problems).toEqual([])
    expect(text).toContain("Price on request")
    expect(text).toContain("out of stock")
    expect(text).toContain("“Notify me”")
    expect(review.todo.join("\n")).toContain("upload at least two");
    expect(review.todo.join("\n")).toContain("Price on request")
    expect(review.todo.join("\n")).toContain("Publish it")
  })

  it("refuses to call a published product without pictures fine", () => {
    const review = reviewProduct({ ...complete, images: 0, thumbnail: null })
    expect(review.problems).toEqual([
      expect.stringContaining("Published without pictures"),
    ])
  })

  it("asks for a second picture when there is one", () => {
    expect(reviewProduct({ ...complete, images: 1 }).todo).toEqual([
      expect.stringContaining("one picture"),
    ])
  })

  it("flags a product that cannot be delivered or shown", () => {
    const review = reviewProduct({
      ...complete,
      shippingProfile: null,
      salesChannels: [],
      variants: [],
    })
    expect(review.problems).toEqual([
      expect.stringContaining("No shipping class"),
      expect.stringContaining("no sales channel"),
      expect.stringContaining("no variants"),
    ])
  })

  it("says which market reads Price on request when one currency has no price", () => {
    const eurOnly = variant({
      prices: [
        { currency: "eur", amount: 1990 },
        { currency: "eur", amount: 1990, regionId: "reg_eu" },
      ],
    })
    const review = reviewProduct({ ...complete, variants: [eurOnly] })

    expect(review.lines.join("\n")).toContain("Price Hungary   Price on request")
    expect(review.todo).toEqual([expect.stringContaining("No HUF price")])
    expect(review.problems).toEqual([])
  })

  it("warns about variants that lack a price the others have", () => {
    const review = reviewProduct({
      ...complete,
      variants: [variant({ title: "Blue" }), variant({ title: "Gold", prices: [] })],
    })
    expect(review.warnings.join("\n")).toContain("Gold has no EUR price in Europe")
    expect(review.warnings.join("\n")).toContain("Gold has no HUF price in Hungary")
  })

  it("notices a price saved without its region", () => {
    const review = reviewProduct({
      ...complete,
      variants: [
        variant({
          prices: [
            { currency: "eur", amount: 1990 },
            { currency: "huf", amount: 720000, regionId: "reg_hu" },
            { currency: "huf", amount: 720000 },
          ],
        }),
      ],
    })
    expect(review.warnings).toEqual([
      expect.stringContaining("none for the region Europe"),
    ])
  })

  it("flags managed stock without an inventory item", () => {
    const review = reviewProduct({
      ...complete,
      variants: [variant({ title: "Blue", available: null })],
    })
    expect(review.problems).toEqual([
      expect.stringContaining('"Blue" manages stock but has no inventory item'),
    ])
  })

  it("does not call stock that is not tracked, or backorders, out of stock", () => {
    const review = reviewProduct({
      ...complete,
      variants: [
        variant({ title: "A", manageInventory: false, available: null }),
        variant({ title: "B", allowBackorder: true, available: 0 }),
      ],
    })
    const text = review.lines.join("\n")
    expect(text).toContain("A: stock not tracked");
    expect(text).toContain("B: none in stock, backorders allowed")
    expect(text).not.toContain("Notify me")
    expect(review.problems).toEqual([])
  })

  describe("metadata", () => {
    const withMetadata = (metadata: Record<string, unknown>) =>
      reviewProduct({ ...complete, metadata })

    it("refuses JSON that does not parse and lists that are not lists", () => {
      const review = withMetadata({
        short_description: '{"en": "A tree", ',
        key_features: '{"en": "Hardy"}',
        approx_dimensions: "[1, 2]",
        seo_title: "T",
        seo_description: "D",
      })
      expect(review.problems).toEqual([
        expect.stringContaining("short_description looks like JSON but is not valid"),
        expect.stringContaining("key_features must be a list"),
        expect.stringContaining("approx_dimensions must be"),
      ])
    })

    it("warns about a text with no German, or no Hungarian", () => {
      const review = withMetadata({
        short_description: "Plain English",
        seo_title: JSON.stringify({ en: "T", "de-DE": "T" }),
        seo_description: JSON.stringify({ en: "D", "de-DE": "D", "hu-HU": "D" }),
        key_features: JSON.stringify([{ en: "A", "de-DE": "A" }, { en: "B" }]),
      })
      expect(review.warnings).toEqual([
        "metadata short_description has no German: German visitors read the English.",
        "metadata seo_title has no Hungarian.",
        "1 of 2 key features have no German.",
      ])
    })

    it("accepts a language written for the language or for each market", () => {
      const review = withMetadata({
        short_description: JSON.stringify({ en: "A", de: "B", hu: "C" }),
        seo_title: JSON.stringify({ en: "A", "de-AT": "B", "hu-HU": "C" }),
        seo_description: JSON.stringify({ en: "A", "de-DE": "B", "hu-HU": "C" }),
      })
      expect(review.warnings).toEqual([])
    })

    it("asks for the search texts a page should have", () => {
      expect(withMetadata({}).warnings).toEqual([
        "metadata short_description is empty.",
        "metadata seo_title is empty.",
        "metadata seo_description is empty.",
      ])
    })

    it("warns when the search texts are longer than a result shows", () => {
      const review = withMetadata({
        short_description: "A",
        seo_title: JSON.stringify({ en: "x".repeat(80), "de-DE": "x", "hu-HU": "x" }),
        seo_description: "y".repeat(170),
      })
      expect(review.warnings.join("\n")).toContain("seo_title is 80 characters")
      expect(review.warnings.join("\n")).toContain("seo_description is 170 characters")
    })

    it("reads values the admin stored as objects, not text", () => {
      const review = withMetadata({
        short_description: { en: "A", "de-DE": "B", "hu-HU": "C" },
        seo_title: { en: "A", "de-DE": "B", "hu-HU": "C" },
        seo_description: { en: "A", "de-DE": "B", "hu-HU": "C" },
        key_features: [{ en: "A", "de-DE": "B", "hu-HU": "C" }],
        approx_dimensions: { height: "1", unit: "cm" },
      })
      expect(review.problems).toEqual([])
      expect(review.warnings).toEqual([])
    })
  })

  it("reports German texts the product lacks", () => {
    const review = reviewProduct({
      ...complete,
      records: [
        ...complete.records,
        { reference: "product_variant", id: "var_1", label: "variant Blue", fields: ["title"] },
      ],
    })
    expect(review.warnings).toEqual(["No German saved for: variant Blue (title)."])
    expect(review.lines.join("\n")).toContain("1 of 2 records complete")
  })
})

describe("germanGaps", () => {
  const records = [
    { reference: "product", id: "prod_1", label: "product", fields: ["title", "description"] },
    { reference: "product_option", id: "opt_1", label: "option Planter", fields: ["title"] },
  ]

  it("lists the fields that have English and no German", () => {
    expect(
      germanGaps(records, [
        { reference: "product", reference_id: "prod_1", fields: ["title"] },
      ])
    ).toEqual(["product (description)", "option Planter (title)"])
  })

  it("is empty when every field has German, and ignores other kinds of record", () => {
    expect(
      germanGaps(records, [
        { reference: "product", reference_id: "prod_1", fields: ["title", "description"] },
        { reference: "product_option", reference_id: "opt_1", fields: ["title"] },
      ])
    ).toEqual([])

    expect(
      germanGaps(records.slice(1), [
        { reference: "product_variant", reference_id: "opt_1", fields: ["title"] },
      ])
    ).toEqual(["option Planter (title)"])
  })
})
