import blueCascadeSpec from "../../../product-specs/blue-cascade.json"
import {
  buildCreateInput,
  englishMetadata,
  findLookalikes,
  GERMAN,
  GermanRow,
  germanRows,
  handleFromTitle,
  metadataLanguages,
  parseProductSpec,
  planTranslationSave,
  priceRows,
  suggest,
} from "../product-spec"

const parse = (spec: unknown) => {
  const result = parseProductSpec(spec)
  if (!result.ok) {
    throw new Error(`Expected a valid spec, got: ${result.errors.join(" | ")}`)
  }
  return result
}

const errorsOf = (spec: unknown): string[] => {
  const result = parseProductSpec(spec)
  if (result.ok) {
    throw new Error("Expected the spec to be refused")
  }
  return result.errors
}

const minimal = { title: "Olive Tree", shippingClass: "pallet" }

describe("handleFromTitle", () => {
  it.each([
    ["Blue Cascade", "blue-cascade"],
    ["Rosé Plant & Pot", "rose-plant-and-pot"],
    ["Weißer Ahorn", "weisser-ahorn"],
    ["  Zen  Bonsai  Tree!! ", "zen-bonsai-tree"],
    ["!!!", "product"],
  ])("makes %j into %j", (title, handle) => {
    expect(handleFromTitle(title)).toBe(handle)
  })
})

describe("parseProductSpec: the Blue Cascade spec", () => {
  const { plan, warnings } = parse(blueCascadeSpec)

  it("reads the texts, the handle and the status as given", () => {
    expect(plan.handle).toBe("blue-cascade")
    expect(plan.status).toBe("draft")
    expect(plan.title).toEqual({
      en: "Blue Cascade",
      de: "Kunstblumen-Arrangement Blue Cascade",
    })
    expect(plan.subtitle).toEqual({ en: "One of a kind", de: "Einzigartig" })
    expect(plan.shippingClass).toBe("pallet")
    expect(plan.categories).toEqual([{ en: "One of a kind", de: "Unikate" }])
  })

  it("joins the paragraphs of the description with a blank line", () => {
    expect(plan.description!.en.split("\n\n")).toHaveLength(4)
    expect(plan.description!.de!.split("\n\n")).toHaveLength(4)
    expect(plan.description!.en.startsWith("Blue Cascade is a dramatic")).toBe(true)
  })

  it("makes one variant per planter, each titled by its choice in both languages", () => {
    expect(plan.simple).toBe(false)
    expect(plan.variants.map((variant) => variant.title)).toEqual([
      { en: "Blue", de: "Blau" },
      { en: "Gold", de: "Gold" },
      { en: "White", de: "Weiß" },
    ])
    expect(plan.variants.map((variant) => variant.options)).toEqual([
      { Planter: "Blue" },
      { Planter: "Gold" },
      { Planter: "White" },
    ])
  })

  it("has no price and no stock, with stock tracked and no backorders", () => {
    for (const variant of plan.variants) {
      expect(variant.prices).toEqual({})
      expect(variant.stock).toBe(0)
      expect(variant.manageInventory).toBe(true)
      expect(variant.allowBackorder).toBe(false)
    }
  })

  it("says what that means for the shop, and has nothing to warn about", () => {
    const result = parse(blueCascadeSpec)
    expect(result.notes).toEqual(
      expect.arrayContaining([
        expect.stringContaining("Price on request"),
        expect.stringContaining("Notify me"),
        expect.stringContaining("draft"),
      ])
    )
    // The SEO title the owner gave is 71 characters: a warning, not a refusal.
    expect(warnings).toEqual([expect.stringContaining("seo.title is 71 characters")])
  })
})

describe("parseProductSpec: refusing", () => {
  it("wants a spec that is an object", () => {
    expect(errorsOf("Blue Cascade")).toEqual([expect.stringContaining("JSON object")])
    expect(errorsOf([])).toEqual([expect.stringContaining("JSON object")])
  })

  it("wants a title and says how to give a text", () => {
    expect(errorsOf({ shippingClass: "pallet" })).toContain("title is required.")
    expect(errorsOf({ ...minimal, title: "  " })).toContain("title must not be empty.")
    expect(errorsOf({ ...minimal, title: { de: "Olivenbaum" } })).toEqual([
      expect.stringContaining('title needs an English text ("en")'),
    ])
    expect(errorsOf({ ...minimal, title: { en: "Olive", fr: "Olivier" } })).toEqual([
      expect.stringContaining('the language "fr": use en, de or hu'),
    ])
    expect(errorsOf({ ...minimal, title: 7 })).toContain("title must be text.")
  })

  it("wants a shipping class, because delivery is priced by it", () => {
    for (const shippingClass of [undefined, "", "van", 1]) {
      expect(errorsOf({ title: "Olive Tree", shippingClass })).toEqual([
        expect.stringContaining('"pallet"'),
      ])
    }
  })

  it("refuses a handle that is not a handle and a status that is not one", () => {
    expect(errorsOf({ ...minimal, handle: "Olive Tree" })).toEqual([
      expect.stringContaining('handle "Olive Tree"'),
    ])
    expect(errorsOf({ ...minimal, status: "live" })).toEqual([
      'status must be "draft" or "published".',
    ])
  })

  it("points at the field the author meant", () => {
    expect(errorsOf({ ...minimal, shortdescription: "x" })).toEqual([
      'Unknown field "shortdescription" (did you mean "shortDescription"?).',
    ])
    expect(errorsOf({ ...minimal, short_description: "x" })).toEqual([
      'Unknown field "short_description" (did you mean "shortDescription"?).',
    ])
    expect(errorsOf({ ...minimal, colour: "x" })).toEqual(['Unknown field "colour".'])
  })

  it("points at the field a slip of the pen was meant for", () => {
    expect(errorsOf({ ...minimal, descripton: "x" })).toEqual([
      'Unknown field "descripton" (did you mean "description"?).',
    ])
    expect(errorsOf({ ...minimal, shippngClass: "pallet" })).toEqual([
      'Unknown field "shippngClass" (did you mean "shippingClass"?).',
    ])
    expect(
      errorsOf({ ...minimal, options: [{ title: "Size", valus: ["S"] }] })
    ).toContain('Unknown field "options[0].valus" (did you mean "values"?).')
  })

  it("lets a field starting with an underscore carry a note", () => {
    expect(parse({ ...minimal, _note: "from the brochure" }).plan.title.en).toBe(
      "Olive Tree"
    )
  })

  it("collects every problem in one go", () => {
    const errors = errorsOf({ handle: "No", status: "x", prices: { eur: -1 } })
    expect(errors.length).toBeGreaterThanOrEqual(4)
  })
})

describe("parseProductSpec: texts", () => {
  it("takes a plain text as English and an object as one text per language", () => {
    const { plan } = parse({
      ...minimal,
      subtitle: "One of a kind",
      shortDescription: { en: "Short", de: "Kurz", hu: "Rövid" },
    })
    expect(plan.subtitle).toEqual({ en: "One of a kind" })
    expect(plan.shortDescription).toEqual({ en: "Short", de: "Kurz", hu: "Rövid" })
  })

  it("trims texts and writes line breaks as \\n", () => {
    const { plan } = parse({ ...minimal, description: "  One\r\nTwo\r\n\r\nThree " })
    expect(plan.description).toEqual({ en: "One\nTwo\n\nThree" })
  })

  it("takes paragraphs as a list, dropping empty ones", () => {
    const { plan } = parse({ ...minimal, description: ["One", " ", "Two"] })
    expect(plan.description).toEqual({ en: "One\n\nTwo" })
    expect(errorsOf({ ...minimal, title: ["a", "b"] })).toContain("title must be text.")
  })

  it("warns about German that is missing, in one line", () => {
    const { warnings } = parse({
      ...minimal,
      subtitle: "Badge",
      categories: ["Handmade"],
    })
    expect(warnings).toEqual(
      expect.arrayContaining([
        expect.stringContaining("No German for title, subtitle, categories[0]"),
      ])
    )
  })

  it("warns when the German is the English text again", () => {
    const text = "A tall tree with a full crown of white blossoms."
    const { warnings } = parse({
      ...minimal,
      shortDescription: { en: text, de: text },
    })
    expect(warnings).toEqual(
      expect.arrayContaining([expect.stringContaining("not translated yet?")])
    )
  })

  it("warns about missing Hungarian for the metadata texts only", () => {
    const { warnings } = parse({
      ...minimal,
      title: { en: "Olive Tree", de: "Olivenbaum" },
      shortDescription: { en: "Short", de: "Kurz" },
      keyFeatures: [{ en: "Handmade", de: "Handgefertigt" }],
    })
    expect(warnings).toEqual(
      expect.arrayContaining([
        expect.stringContaining("No Hungarian for shortDescription, keyFeatures[0]"),
      ])
    )
  })

  it("warns that Hungarian on a title is not used", () => {
    const { warnings } = parse({
      ...minimal,
      title: { en: "Olive Tree", de: "Olivenbaum", hu: "Olajfa" },
    })
    expect(warnings).toEqual(
      expect.arrayContaining([expect.stringContaining("Hungarian for title is not used")])
    )
  })

  it("wants every key feature to be told apart by its English text", () => {
    expect(
      errorsOf({ ...minimal, keyFeatures: ["Handmade", "handmade"] })
    ).toEqual([expect.stringContaining("same English text twice")])
  })
})

describe("parseProductSpec: a product without choices", () => {
  it("gets the default option and variant the admin makes", () => {
    const { plan } = parse({ ...minimal, prices: { eur: 350 }, sku: "OLIVE-1" })

    expect(plan.simple).toBe(true)
    expect(plan.options).toEqual([
      { title: { en: "Default option" }, values: [{ en: "Default option value" }] },
    ])
    expect(plan.variants).toEqual([
      {
        title: { en: "Default variant" },
        options: { "Default option": "Default option value" },
        sku: "OLIVE-1",
        prices: { eur: 350 },
        stock: 0,
        manageInventory: true,
        allowBackorder: false,
      },
    ])
  })

  it("lets its one variant be written out", () => {
    const { plan } = parse({
      ...minimal,
      variants: [{ sku: "O-1", prices: { eur: 10 }, stock: 3 }],
    })
    expect(plan.variants[0]).toEqual(
      expect.objectContaining({ sku: "O-1", prices: { eur: 10 }, stock: 3 })
    )
  })

  it("refuses several variants that have nothing to tell them apart", () => {
    expect(errorsOf({ ...minimal, variants: [{}, {}] })).toEqual([
      expect.stringContaining("Several variants need options"),
    ])
  })
})

describe("parseProductSpec: options and variants", () => {
  const colours = {
    title: { en: "Pot colour", de: "Farbe des Pflanzgefäßes" },
    values: [
      { en: "Black", de: "Schwarz" },
      { en: "White", de: "Weiß" },
    ],
  }
  const sizes = { title: "Size", values: ["Small", "Large"] }

  it("makes every combination when no variants are given, the last option varying fastest", () => {
    const { plan } = parse({ ...minimal, options: [colours, sizes] })

    expect(plan.variants.map((variant) => variant.title.en)).toEqual([
      "Black / Small",
      "Black / Large",
      "White / Small",
      "White / Large",
    ])
  })

  it("titles a combination in German only when every value has German", () => {
    const { plan } = parse({ ...minimal, options: [colours, sizes] })
    expect(plan.variants[0].title.de).toBeUndefined()

    const { plan: both } = parse({ ...minimal, options: [colours] })
    expect(both.variants.map((variant) => variant.title.de)).toEqual(["Schwarz", "Weiß"])

    // Joined the way the English title is, so the two read alike.
    const { plan: two } = parse({
      ...minimal,
      options: [colours, { title: "Size", values: [{ en: "Small", de: "Klein" }] }],
    })
    expect(two.variants.map((variant) => variant.title)).toEqual([
      { en: "Black / Small", de: "Schwarz / Klein" },
      { en: "White / Small", de: "Weiß / Klein" },
    ])
  })

  it("takes the variants as written, with their own price, stock and sku", () => {
    const { plan } = parse({
      ...minimal,
      options: [colours],
      prices: { eur: 100 },
      stock: 2,
      variants: [
        { options: { "Pot colour": "Black" }, sku: "OT-B", prices: { eur: 120, huf: 40000 } },
        { options: { "Pot colour": "White" }, stock: 0 },
      ],
    })

    expect(plan.variants[0]).toEqual(
      expect.objectContaining({
        sku: "OT-B",
        // Its own prices replace the product's, they are not added to them.
        prices: { eur: 120, huf: 40000 },
        stock: 2,
      })
    )
    expect(plan.variants[1]).toEqual(
      expect.objectContaining({ prices: { eur: 100 }, stock: 0 })
    )
  })

  it("names the choices that exist when a variant picks one that does not", () => {
    expect(
      errorsOf({
        ...minimal,
        options: [colours],
        variants: [{ options: { "Pot colour": "Green" } }],
      })
    ).toEqual(['variants[0].options.Pot colour must be one of: Black, White.'])
  })

  it("wants a value for every option and no option the product does not have", () => {
    expect(
      errorsOf({
        ...minimal,
        options: [colours, sizes],
        variants: [{ options: { "Pot colour": "Black" } }],
      })
    ).toEqual(["variants[0].options.Size must be one of: Small, Large."])

    expect(
      errorsOf({
        ...minimal,
        options: [colours],
        variants: [{ options: { "Pot colour": "Black", Finish: "Matt" } }],
      })
    ).toEqual(["variants[0].options.Finish is not one of the product's options."])
  })

  it("refuses the same combination twice and warns about a value nobody can choose", () => {
    expect(
      errorsOf({
        ...minimal,
        options: [colours],
        variants: [
          { options: { "Pot colour": "Black" } },
          { options: { "Pot colour": "Black" } },
        ],
      })
    ).toEqual([expect.stringContaining("repeats a combination")])

    const { warnings } = parse({
      ...minimal,
      options: [colours],
      variants: [{ options: { "Pot colour": "Black" } }],
    })
    expect(warnings).toEqual(
      expect.arrayContaining(['Pot colour "White" has no variant, so it cannot be chosen.'])
    )
  })

  it("refuses an option with no values, a value twice and an option twice", () => {
    expect(errorsOf({ ...minimal, options: [{ title: "Size", values: [] }] })).toEqual([
      "options[0].values must list at least one value.",
    ])
    expect(
      errorsOf({ ...minimal, options: [{ title: "Size", values: ["Small", "small"] }] })
    ).toEqual(["options[0].values has the same value twice."])
    expect(errorsOf({ ...minimal, options: [sizes, sizes] })).toEqual([
      "options has the same option twice.",
    ])
  })

  it("gives a sku to a product with one variant only, and each sku once", () => {
    expect(errorsOf({ ...minimal, options: [sizes], sku: "X" })).toEqual([
      expect.stringContaining("sku at the top is for a product with one variant"),
    ])
    expect(
      errorsOf({
        ...minimal,
        options: [sizes],
        variants: [
          { options: { Size: "Small" }, sku: "A" },
          { options: { Size: "Large" }, sku: "A" },
        ],
      })
    ).toEqual([expect.stringContaining("same sku")])
  })
})

describe("parseProductSpec: prices and stock", () => {
  it("reads an amount per currency, as shown on the page", () => {
    const { plan, notes } = parse({ ...minimal, prices: { EUR: 2450, huf: 890000 } })

    expect(plan.variants[0].prices).toEqual({ eur: 2450, huf: 890000 })
    expect(notes.join(" ")).not.toContain("Price on request")
  })

  it.each([
    [{ eur: 0 }, "prices.eur must be a number above zero"],
    [{ eur: -5 }, "prices.eur must be a number above zero"],
    [{ eur: "12" }, "prices.eur must be a number above zero"],
    [{ eur: 12.345 }, "prices.eur has more than two decimals"],
    [{ euro: 12 }, "prices.euro is not a currency code"],
  ])("refuses %j", (prices, message) => {
    expect(errorsOf({ ...minimal, prices })).toEqual([expect.stringContaining(message)])
  })

  it("says how to leave a price out, and that it reads Price on request", () => {
    expect(errorsOf({ ...minimal, prices: { eur: 0 } })[0]).toContain("Price on request")
  })

  it("warns about forints with decimals", () => {
    const { warnings } = parse({ ...minimal, prices: { huf: 100.5 } })
    expect(warnings).toEqual(
      expect.arrayContaining([expect.stringContaining("forints are whole")])
    )
  })

  it("warns about variants with no price, or no price in a currency another has", () => {
    const options = [{ title: "Size", values: ["Small", "Large"] }]

    const none = parse({
      ...minimal,
      options,
      variants: [
        { options: { Size: "Small" }, prices: { eur: 10 } },
        { options: { Size: "Large" } },
      ],
    })
    expect(none.warnings).toEqual(
      expect.arrayContaining([
        expect.stringContaining('1 of 2 variants have no price and read "Price on request"'),
      ])
    )

    const partial = parse({
      ...minimal,
      options,
      variants: [
        { options: { Size: "Small" }, prices: { eur: 10, huf: 4000 } },
        { options: { Size: "Large" }, prices: { eur: 20 } },
      ],
    })
    expect(partial.warnings).toEqual(
      expect.arrayContaining([expect.stringContaining("no HUF price: Large")])
    )
  })

  it("wants stock as a whole number, zero or more", () => {
    expect(parse({ ...minimal, stock: 5 }).plan.variants[0].stock).toBe(5)
    for (const stock of [-1, 1.5, "3"]) {
      expect(errorsOf({ ...minimal, stock })).toEqual([
        "stock must be a whole number, zero or more.",
      ])
    }
  })

  it("notes that nothing is in stock, and not when something is", () => {
    expect(parse(minimal).notes.join(" ")).toContain("Notify me")
    expect(parse({ ...minimal, stock: 1 }).notes.join(" ")).not.toContain("Notify me")
  })
})

describe("parseProductSpec: dimensions, material and the rest", () => {
  it("writes a range with a hyphen as one with an en dash", () => {
    const { plan } = parse({
      ...minimal,
      approxDimensions: { height: "160-180", width: 140, depth: "80 - 100" },
    })
    expect(plan.approxDimensions).toEqual({
      height: "160–180",
      width: "140",
      depth: "80–100",
      unit: "cm",
    })
  })

  it("refuses dimensions that say nothing", () => {
    expect(errorsOf({ ...minimal, approxDimensions: { unit: "cm" } })).toEqual([
      expect.stringContaining("needs a height, width or depth"),
    ])
    expect(errorsOf({ ...minimal, approxDimensions: { colour: "1" } })).toEqual(
      expect.arrayContaining([expect.stringContaining("approxDimensions.colour")])
    )
    expect(errorsOf({ ...minimal, dimensions: { height: 0 } })).toEqual([
      "dimensions.height must be a number above zero.",
    ])
    expect(errorsOf({ ...minimal, dimensions: { depth: 5 } })).toEqual([
      expect.stringContaining("dimensions.depth is not a field"),
    ])
  })

  it("reads the exact dimensions Medusa has fields for", () => {
    const { plan, warnings } = parse({
      ...minimal,
      dimensions: { height: 220, width: 120, length: 120, weight: 9000 },
      approxDimensions: { depth: "80–100" },
      material: "Polyester",
      originCountry: "at",
    })
    expect(plan.dimensions).toEqual({ height: 220, width: 120, length: 120, weight: 9000 })
    expect(plan.material).toBe("Polyester")
    expect(plan.originCountry).toBe("AT")
    expect(warnings).toEqual(
      expect.arrayContaining([expect.stringContaining("Both dimensions and approxDimensions")])
    )
    expect(errorsOf({ ...minimal, originCountry: "Austria" })).toEqual([
      expect.stringContaining("two-letter country code"),
    ])
  })

  it("keeps the other metadata, as text", () => {
    const { plan } = parse({
      ...minimal,
      metadata: { packaging_info: "Boxed", pot: { width: 40, unit: "cm" }, empty: null },
    })
    expect(plan.extraMetadata).toEqual({
      packaging_info: "Boxed",
      pot: '{"width":40,"unit":"cm"}',
    })
  })

  it("keeps the metadata keys that have a field of their own to that field", () => {
    expect(errorsOf({ ...minimal, metadata: { seo_title: "x" } })).toEqual([
      "metadata.seo_title is set from its own field.",
    ])
    expect(errorsOf({ ...minimal, metadata: { video_url: "x" } })).toEqual([
      expect.stringContaining("Product video box"),
    ])
  })

  it("warns that the name sorts into the other class in shipping-classes.ts", () => {
    const { warnings } = parse({ title: "Orchid Mini", shippingClass: "carton" })
    expect(warnings).toEqual(
      expect.arrayContaining([expect.stringContaining("would move this carton product")])
    )
    expect(
      parse({ title: "Orchid Mini", shippingClass: "pallet" }).warnings.join(" ")
    ).not.toContain("would move")
  })

  it("warns about SEO text that search results cut", () => {
    const { warnings } = parse({
      ...minimal,
      seo: { title: "T".repeat(75), description: "D".repeat(170) },
    })
    expect(warnings).toEqual(
      expect.arrayContaining([
        expect.stringContaining("seo.title is 75 characters"),
        expect.stringContaining("seo.description is 170 characters"),
      ])
    )
  })

  it("defaults to a draft", () => {
    expect(parse(minimal).plan.status).toBe("draft")
    expect(parse({ ...minimal, status: "published" }).plan.status).toBe("published")
  })
})

describe("englishMetadata", () => {
  const { plan } = parse(blueCascadeSpec)
  const metadata = englishMetadata(plan)

  it("stores the English texts as the admin does: texts as they are, structures as JSON text", () => {
    expect(metadata.short_description).toBe(plan.shortDescription!.en)
    expect(metadata.seo_title).toBe(plan.seoTitle!.en)
    expect(metadata.seo_description).toBe(plan.seoDescription!.en)
    expect(JSON.parse(metadata.key_features)).toEqual(
      plan.keyFeatures.map((feature) => ({ en: feature.en }))
    )
    expect(JSON.parse(metadata.approx_dimensions)).toEqual({
      height: "160–180",
      width: "140–170",
      depth: "80–100",
      unit: "cm",
    })
    expect(Object.keys(JSON.parse(metadata.approx_dimensions))).toEqual([
      "height",
      "width",
      "depth",
      "unit",
    ])
  })

  it("has only what the spec has, and adds the other metadata", () => {
    const small = englishMetadata(
      parse({ ...minimal, metadata: { packaging_info: "Boxed" } }).plan
    )
    expect(small).toEqual({ packaging_info: "Boxed" })
  })
})

describe("metadataLanguages", () => {
  it("writes the short, care and SEO texts per market and the long text per language", () => {
    const { plan } = parse({
      ...minimal,
      shortDescription: { en: "Short", de: "Kurz", hu: "Rövid" },
      careInstructions: { en: "Dust gently", de: "Abstauben" },
      longDescription: { en: "<p>Long</p>", de: "<p>Lang</p>", hu: "<p>Hosszú</p>" },
      seo: { title: { en: "T", de: "Titel" }, description: { en: "D", hu: "Leírás" } },
    })

    expect(metadataLanguages(plan).texts).toEqual({
      short_description: {
        en: "Short",
        "de-AT": "Kurz",
        "de-DE": "Kurz",
        "hu-HU": "Rövid",
      },
      care_instructions: { en: "Dust gently", "de-AT": "Abstauben", "de-DE": "Abstauben" },
      long_description: { en: "<p>Long</p>", de: "<p>Lang</p>", hu: "<p>Hosszú</p>" },
      seo_title: { en: "T", "de-AT": "Titel", "de-DE": "Titel" },
      seo_description: { en: "D", "hu-HU": "Leírás" },
    })
  })

  it("gives the key features as a list, leaving out those with only English", () => {
    const { plan } = parse({
      ...minimal,
      keyFeatures: [
        { en: "Handmade", de: "Handgefertigt" },
        "Indoor use",
        { en: "Maintenance-free", hu: "Karbantartásmentes" },
      ],
    })

    expect(metadataLanguages(plan).lists.key_features).toEqual([
      { en: "Handmade", "de-AT": "Handgefertigt", "de-DE": "Handgefertigt" },
      { en: "Maintenance-free", "hu-HU": "Karbantartásmentes" },
    ])
  })

  it("has nothing to add for a product written in English only", () => {
    const { plan } = parse({ ...minimal, shortDescription: "Short" })
    expect(metadataLanguages(plan)).toEqual({ texts: {}, lists: {} })
  })
})

describe("priceRows", () => {
  const regions = { eur: ["reg_europe"], huf: ["reg_hungary"] }

  it("gives each currency a price with no rules and one for each region that uses it", () => {
    expect(priceRows({ eur: 2450, huf: 890000 }, regions)).toEqual([
      { currency_code: "eur", amount: 2450 },
      { currency_code: "eur", amount: 2450, rules: { region_id: "reg_europe" } },
      { currency_code: "huf", amount: 890000 },
      { currency_code: "huf", amount: 890000, rules: { region_id: "reg_hungary" } },
    ])
  })

  it("gives a currency no region uses its price with no rules only, and none for no price", () => {
    expect(priceRows({ usd: 10 }, regions)).toEqual([{ currency_code: "usd", amount: 10 }])
    expect(priceRows({}, regions)).toEqual([])
  })

  it("gives a currency sold in several regions a price for each", () => {
    expect(priceRows({ eur: 5 }, { eur: ["a", "b"] })).toEqual([
      { currency_code: "eur", amount: 5 },
      { currency_code: "eur", amount: 5, rules: { region_id: "a" } },
      { currency_code: "eur", amount: 5, rules: { region_id: "b" } },
    ])
  })
})

describe("buildCreateInput", () => {
  const refs = {
    salesChannelId: "sc_1",
    shippingProfileId: "sp_pallet",
    categoryIds: ["pcat_1"],
    tagIds: [],
    regionIdsByCurrency: { eur: ["reg_europe"] },
  }

  it("builds the Blue Cascade the way add-blue-cascade does", () => {
    const { plan } = parse(blueCascadeSpec)
    const input = buildCreateInput(plan, refs)

    expect(input).toEqual({
      title: "Blue Cascade",
      handle: "blue-cascade",
      subtitle: "One of a kind",
      description: plan.description!.en,
      status: "draft",
      shipping_profile_id: "sp_pallet",
      category_ids: ["pcat_1"],
      tag_ids: [],
      sales_channels: [{ id: "sc_1" }],
      options: [{ title: "Planter", values: ["Blue", "Gold", "White"] }],
      variants: ["Blue", "Gold", "White"].map((planter, rank) => ({
        title: planter,
        options: { Planter: planter },
        manage_inventory: true,
        allow_backorder: false,
        variant_rank: rank,
        prices: [],
      })),
      metadata: englishMetadata(plan),
    })
  })

  it("carries prices, sku, dimensions, type and collection when the spec has them", () => {
    const { plan } = parse({
      ...minimal,
      status: "published",
      prices: { eur: 350 },
      sku: "OLIVE-1",
      dimensions: { height: 60, width: 60, length: 60 },
      material: "Glass",
      originCountry: "AT",
    })
    const input = buildCreateInput(plan, {
      ...refs,
      collectionId: "pcol_1",
      typeId: "ptyp_1",
      tagIds: ["ptag_1"],
    })

    expect(input).toEqual(
      expect.objectContaining({
        status: "published",
        height: 60,
        width: 60,
        length: 60,
        material: "Glass",
        origin_country: "AT",
        collection_id: "pcol_1",
        type_id: "ptyp_1",
        tag_ids: ["ptag_1"],
      })
    )
    expect(input.variants[0]).toEqual(
      expect.objectContaining({
        sku: "OLIVE-1",
        prices: [
          { currency_code: "eur", amount: 350 },
          { currency_code: "eur", amount: 350, rules: { region_id: "reg_europe" } },
        ],
      })
    )
  })

  it("leaves out what the spec does not have, rather than sending it empty", () => {
    const input = buildCreateInput(parse(minimal).plan, refs)

    for (const key of ["subtitle", "description", "material", "height", "collection_id", "type_id"]) {
      expect(input).not.toHaveProperty(key)
    }
    expect(input.variants[0]).not.toHaveProperty("sku")
  })
})

describe("findLookalikes", () => {
  const { plan } = parse(blueCascadeSpec)
  const known = (title: string, handle: string, id = `prod_${handle}`) => ({
    id,
    title,
    handle,
  })

  it("knows the product by its handle, so running a spec twice makes nothing twice", () => {
    const existing = known("Blue Cascade XL", "blue-cascade")
    expect(findLookalikes(plan, [known("Olive Tree", "olive-tree"), existing])).toEqual({
      sameHandle: existing,
      similar: [],
    })
  })

  it("knows a product renamed in the admin by its name under another handle", () => {
    const renamed = known(" blue  CASCADE ", "blue-cascade-2")
    expect(findLookalikes(plan, [renamed])).toEqual({ sameTitle: renamed, similar: [] })
  })

  it("points at similar names, whichever contains the other, and at similar handles", () => {
    const longer = known("Blue Cascade Composition", "blue-cascade-composition")
    const sibling = known("The Cascade", "the-cascade")
    expect(findLookalikes(plan, [longer, sibling]).similar).toEqual([longer])

    const shorter = parse({ title: "Blue Cascade Grande Edition", shippingClass: "pallet" }).plan
    expect(findLookalikes(shorter, [known("Blue Cascade", "blue-cascade")]).similar).toHaveLength(1)
  })

  it("does not call short or unrelated names similar", () => {
    const tree = parse({ title: "Oak", shippingClass: "pallet" }).plan
    expect(
      findLookalikes(tree, [known("Oak Barrel Planter", "oak-barrel-planter"), known("Maple", "maple")])
        .similar
    ).toEqual([known("Oak Barrel Planter", "oak-barrel-planter")])

    expect(findLookalikes(plan, [known("Zen Magnolia Bloom", "zen-magnolia-bloom")])).toEqual({
      similar: [],
    })
  })
})

describe("suggest", () => {
  const names = ["Handmade", "One of a kind", "Trees", "Orchids"]

  it("points at a name that is a slip of the pen away", () => {
    expect(suggest("Handmde", names)).toEqual(["Handmade"])
    expect(suggest("Tree", names)).toEqual(["Trees"])
    expect(suggest("One of a kinds", names)).toEqual(["One of a kind"])
  })

  it("does not call another capital letter a slip: that is a match", () => {
    expect(suggest("handmade", names)).toEqual([])
  })

  it("stays quiet for names that are simply different", () => {
    expect(suggest("Roses", names)).toEqual([])
    expect(suggest("Unikate", names)).toEqual([])
  })

  it("allows more slips in a long name than in a short one", () => {
    expect(suggest("Ab", ["Ac"])).toEqual(["Ac"])
    expect(suggest("Ab", ["Cd"])).toEqual([])
    expect(suggest("Magnolia Grandiflora", ["Magnolia Grandiflra"])).toEqual([
      "Magnolia Grandiflra",
    ])
  })
})

describe("germanRows", () => {
  const { plan } = parse(blueCascadeSpec)
  const entities = {
    id: "prod_1",
    options: [
      {
        id: "opt_1",
        title: "Planter",
        values: [
          { id: "val_blue", value: "Blue" },
          { id: "val_gold", value: "Gold" },
          { id: "val_white", value: "White" },
        ],
      },
    ],
    variants: [
      { id: "var_blue", title: "Blue" },
      { id: "var_gold", title: "Gold" },
      { id: "var_white", title: "White" },
    ],
    categories: [{ id: "pcat_1", name: "One of a Kind" }],
  }

  it("has a row for the product, its option and choices, its variants and its category", () => {
    const rows = germanRows(plan, entities)

    expect(rows.map((row) => [row.reference, row.reference_id])).toEqual([
      ["product", "prod_1"],
      ["product_option", "opt_1"],
      ["product_option_value", "val_blue"],
      ["product_option_value", "val_gold"],
      ["product_option_value", "val_white"],
      ["product_variant", "var_blue"],
      ["product_variant", "var_gold"],
      ["product_variant", "var_white"],
      ["product_category", "pcat_1"],
    ])
  })

  it("says in German what the shop says in English", () => {
    const byId = Object.fromEntries(
      germanRows(plan, entities).map((row) => [row.reference_id, row.texts])
    )

    expect(byId.prod_1).toEqual({
      title: "Kunstblumen-Arrangement Blue Cascade",
      subtitle: "Einzigartig",
      description: plan.description!.de,
    })
    expect(byId.opt_1).toEqual({ title: "Pflanzgefäß" })
    expect(byId.val_blue).toEqual({ value: "Blau" })
    expect(byId.val_white).toEqual({ value: "Weiß" })
    expect(byId.var_white).toEqual({ title: "Weiß" })
    // Found without regard to capital letters.
    expect(byId.pcat_1).toEqual({ name: "Unikate" })
  })

  it("skips what the product does not have, and what has no German", () => {
    const english = parse({ ...minimal, categories: ["Handmade"] }).plan
    expect(germanRows(english, { ...entities, categories: [] })).toEqual([])

    const partial = germanRows(plan, {
      id: "prod_1",
      options: [],
      variants: [{ id: "var_blue", title: "Blue" }],
      categories: [],
    })
    expect(partial.map((row) => row.reference)).toEqual(["product", "product_variant"])
  })

  it("leaves a text without German when its English was edited since", () => {
    const edited = germanRows(plan, {
      ...entities,
      own: {
        title: "Blue Cascade Composition",
        subtitle: "One of a kind",
        description: "A description someone rewrote in the admin.",
      },
    })

    // Only the subtitle is still the English the German translates.
    expect(edited[0].texts).toEqual({ subtitle: "Einzigartig" })

    const same = germanRows(plan, {
      ...entities,
      own: {
        title: " blue cascade ",
        subtitle: "One of a kind",
        description: plan.description!.en,
      },
    })
    expect(Object.keys(same[0].texts)).toEqual(["title", "subtitle", "description"])
  })

  it("has no row for the product itself when none of its texts still match", () => {
    const rows = germanRows(plan, {
      ...entities,
      own: { title: "Other", subtitle: "Other", description: "Other" },
    })
    expect(rows.map((row) => row.reference)).not.toContain("product")
  })
})

describe("planTranslationSave", () => {
  const wanted: GermanRow[] = [
    {
      label: "product Blue Cascade",
      reference: "product",
      reference_id: "prod_1",
      texts: { title: "Blue Cascade DE", subtitle: "Einzigartig" },
    },
    {
      label: "variant Blue",
      reference: "product_variant",
      reference_id: "var_blue",
      texts: { title: "Blau" },
    },
    {
      label: "category One of a kind",
      reference: "product_category",
      reference_id: "pcat_1",
      texts: { name: "Unikate" },
    },
  ]

  it("creates a row for a record that has none, in the one German locale", () => {
    const plan = planTranslationSave(wanted, [])

    expect(plan.created).toEqual(wanted.map((item) => item.label))
    expect(plan.updated).toEqual([])
    expect(plan.create[0]).toEqual({
      reference: "product",
      reference_id: "prod_1",
      locale_code: GERMAN,
      translations: { title: "Blue Cascade DE", subtitle: "Einzigartig" },
    })
    expect(GERMAN).toBe("de-DE")
  })

  it("gives a row only the fields it lacks and never rewrites one that has text", () => {
    const plan = planTranslationSave(wanted, [
      {
        id: "trans_1",
        reference: "product",
        reference_id: "prod_1",
        translations: { title: "Proofread in the admin", subtitle: "  " },
      },
    ])

    expect(plan.update).toEqual([
      {
        id: "trans_1",
        translations: { title: "Proofread in the admin", subtitle: "Einzigartig" },
      },
    ])
    expect(plan.updated).toEqual(["product Blue Cascade"])
    expect(plan.created).toEqual(["variant Blue", "category One of a kind"])
  })

  it("keeps a complete row, and does nothing when there is nothing to do", () => {
    const rows = wanted.map((item, index) => ({
      id: `trans_${index}`,
      reference: item.reference,
      reference_id: item.reference_id,
      translations: { ...item.texts, extra: "kept" } as Record<string, unknown>,
    }))

    const plan = planTranslationSave(wanted, rows)
    expect(plan.kept).toEqual(wanted.map((item) => item.label))
    expect(plan.create).toEqual([])
    expect(plan.update).toEqual([])
  })

  it("matches a row by the kind of record as well as its id", () => {
    const plan = planTranslationSave(wanted.slice(0, 1), [
      {
        id: "trans_x",
        reference: "product_variant",
        reference_id: "prod_1",
        translations: { title: "x", subtitle: "y" },
      },
    ])
    expect(plan.created).toEqual(["product Blue Cascade"])
  })
})
