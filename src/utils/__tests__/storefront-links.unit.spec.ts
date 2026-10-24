import {
  categoryViewUrl,
  pageViewUrl,
  postViewUrl,
  productViewUrl,
  storefrontLanguage,
} from "../../admin/lib/storefront"
import { marketLinks, storefrontUrl } from "../storefront-url"

describe("storefrontUrl", () => {
  const original = { ...process.env }

  afterEach(() => {
    process.env = { ...original }
  })

  it("prefers NEXT_PUBLIC_STOREFRONT_URL, then STOREFRONT_PUBLIC_URL, then localhost", () => {
    process.env.NEXT_PUBLIC_STOREFRONT_URL = "https://a.example"
    process.env.STOREFRONT_PUBLIC_URL = "https://b.example"
    expect(storefrontUrl()).toBe("https://a.example")

    delete process.env.NEXT_PUBLIC_STOREFRONT_URL
    expect(storefrontUrl()).toBe("https://b.example")

    delete process.env.STOREFRONT_PUBLIC_URL
    expect(storefrontUrl()).toBe("http://localhost:8000")
  })

  it("drops a trailing slash, so a path can be added to it", () => {
    process.env.NEXT_PUBLIC_STOREFRONT_URL = "https://shop.example//"
    expect(storefrontUrl()).toBe("https://shop.example")
  })
})

describe("marketLinks", () => {
  const base = "https://shop.example"

  it("gives an English and a German address in the first country, alphabetically", () => {
    const regions = [
      { countries: [{ iso_2: "hu" }, { iso_2: "de" }] },
      { countries: [{ iso_2: "at" }] },
    ]

    expect(marketLinks(base, regions)).toEqual({
      en: "https://shop.example/en-at",
      de: "https://shop.example/de-at",
    })
  })

  it("lowercases the country and skips regions and entries without one", () => {
    expect(
      marketLinks(base, [
        { countries: null },
        { countries: [null, { iso_2: "HU" }, { iso_2: null }] },
      ])
    ).toEqual({
      en: "https://shop.example/en-hu",
      de: "https://shop.example/de-hu",
    })
  })

  it("is null while the store has no region or country", () => {
    expect(marketLinks(base, [])).toBeNull()
    expect(marketLinks(base, [{ countries: [] }])).toBeNull()
  })
})

describe("pageViewUrl", () => {
  const links = {
    base: "https://shop.example",
    markets: {
      en: "https://shop.example/en-at",
      de: "https://shop.example/de-at",
    },
  }

  it("is the page's slug in the market of the language it is written in", () => {
    expect(pageViewUrl(links, { slug: "guides", locale: "en" })).toBe(
      "https://shop.example/en-at/guides"
    )
    expect(pageViewUrl(links, { slug: "guides", locale: "de-DE" })).toBe(
      "https://shop.example/de-at/guides"
    )
    expect(pageViewUrl(links, { slug: "guides", locale: "de-AT" })).toBe(
      "https://shop.example/de-at/guides"
    )
  })

  it("reads a missing locale as English, and any other language as English too", () => {
    expect(pageViewUrl(links, { slug: "guides" })).toBe("https://shop.example/en-at/guides")
    expect(pageViewUrl(links, { slug: "guides", locale: "hu-HU" })).toBe(
      "https://shop.example/en-at/guides"
    )
  })

  it("keeps a nested slug and ignores slashes at its ends", () => {
    expect(pageViewUrl(links, { slug: "/guides/plant-care/", locale: "en" })).toBe(
      "https://shop.example/en-at/guides/plant-care"
    )
  })

  it("sends the built-in pages to the address the storefront gives them", () => {
    expect(pageViewUrl(links, { slug: "imprint", locale: "en" })).toBe(
      "https://shop.example/en-at/policies/imprint"
    )
    expect(pageViewUrl(links, { slug: "privacy-policy", locale: "de-AT" })).toBe(
      "https://shop.example/de-at/policies/privacy"
    )
    expect(pageViewUrl(links, { slug: "terms-and-conditions", locale: "en" })).toBe(
      "https://shop.example/en-at/policies/terms"
    )
    // The homepage hero is the page "home": its address is the market itself.
    expect(pageViewUrl(links, { slug: "home", locale: "en" })).toBe(
      "https://shop.example/en-at"
    )
    // about, contact and customer-care are at /<slug> like any other page.
    expect(pageViewUrl(links, { slug: "about", locale: "en" })).toBe(
      "https://shop.example/en-at/about"
    )
  })

  it("does not take a slug such as constructor for a built-in page", () => {
    expect(pageViewUrl(links, { slug: "constructor", locale: "en" })).toBe(
      "https://shop.example/en-at/constructor"
    )
  })

  it("leaves the market to the storefront when the store has no region", () => {
    expect(
      pageViewUrl({ base: "https://shop.example", markets: null }, { slug: "about", locale: "de-AT" })
    ).toBe("https://shop.example/about")
  })

  it("is null until the links have loaded", () => {
    expect(pageViewUrl(undefined, { slug: "about" })).toBeNull()
    expect(pageViewUrl(null, { slug: "about" })).toBeNull()
  })
})

describe("storefrontLanguage", () => {
  it("is German for any de-* locale and English for everything else", () => {
    expect(storefrontLanguage("de")).toBe("de")
    expect(storefrontLanguage("de-AT")).toBe("de")
    expect(storefrontLanguage("DE-de")).toBe("de")
    expect(storefrontLanguage("en")).toBe("en")
    expect(storefrontLanguage("hu-HU")).toBe("en")
    expect(storefrontLanguage(null)).toBe("en")
    expect(storefrontLanguage(undefined)).toBe("en")
  })
})

describe("postViewUrl, categoryViewUrl and productViewUrl", () => {
  const links = {
    base: "https://shop.example",
    markets: {
      en: "https://shop.example/en-at",
      de: "https://shop.example/de-at",
    },
  }
  const noRegion = { base: "https://shop.example", markets: null }

  it("opens a post under /blog in the language it is written in", () => {
    expect(postViewUrl(links, { handle: "olive-care", locale: "en" })).toBe(
      "https://shop.example/en-at/blog/olive-care"
    )
    expect(postViewUrl(links, { handle: "olive-care", locale: "de-AT" })).toBe(
      "https://shop.example/de-at/blog/olive-care"
    )
  })

  it("opens a category under /blog/category", () => {
    expect(categoryViewUrl(links, { handle: "plant-care", locale: "en" })).toBe(
      "https://shop.example/en-at/blog/category/plant-care"
    )
    expect(categoryViewUrl(links, { handle: "pflege", locale: "de-DE" })).toBe(
      "https://shop.example/de-at/blog/category/pflege"
    )
  })

  it("opens a product under /products in the language asked for", () => {
    expect(productViewUrl(links, { handle: "olive-tree" }, "en")).toBe(
      "https://shop.example/en-at/products/olive-tree"
    )
    expect(productViewUrl(links, { handle: "olive-tree" }, "de")).toBe(
      "https://shop.example/de-at/products/olive-tree"
    )
  })

  it("encodes a handle, so it cannot change the address", () => {
    expect(postViewUrl(links, { handle: "a/b?c", locale: "en" })).toBe(
      "https://shop.example/en-at/blog/a%2Fb%3Fc"
    )
    expect(productViewUrl(links, { handle: "a b" }, "en")).toBe(
      "https://shop.example/en-at/products/a%20b"
    )
  })

  it("leaves the market to the storefront when the store has no region", () => {
    expect(postViewUrl(noRegion, { handle: "olive-care", locale: "de" })).toBe(
      "https://shop.example/blog/olive-care"
    )
    expect(productViewUrl(noRegion, { handle: "olive-tree" }, "de")).toBe(
      "https://shop.example/products/olive-tree"
    )
  })

  it("is null until the links have loaded, and for a product without a handle", () => {
    expect(postViewUrl(undefined, { handle: "olive-care" })).toBeNull()
    expect(categoryViewUrl(null, { handle: "plant-care" })).toBeNull()
    expect(productViewUrl(undefined, { handle: "olive-tree" }, "en")).toBeNull()
    expect(productViewUrl(links, { handle: null }, "en")).toBeNull()
    expect(productViewUrl(links, {}, "en")).toBeNull()
  })
})
