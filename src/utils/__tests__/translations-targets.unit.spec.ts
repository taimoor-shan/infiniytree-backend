import { Modules } from "@medusajs/framework/utils"
import {
  groupByLanguage,
  providerStatus,
  resolveFullLocale,
  resolveTargetLocales,
} from "../translations/targets"

const KNOWN = ["de-AT", "de-DE", "en-US", "hu-HU", "fr-FR"]

/** A container with the given translation-module locales and store locales. */
const containerWith = (storeLocales: string[]) => ({
  resolve: (key: string) => {
    if (key === Modules.TRANSLATION) {
      return { listLocales: async () => KNOWN.map((code) => ({ code })) }
    }

    if (key === Modules.STORE) {
      return {
        listStores: async () => [
          { supported_locales: storeLocales.map((locale_code) => ({ locale_code })) },
        ],
      }
    }

    throw new Error(`unexpected resolve of ${key}`)
  },
})

describe("resolveFullLocale", () => {
  it("keeps a full locale, and expands a language to its own country", () => {
    expect(resolveFullLocale("de-AT", KNOWN)).toBe("de-AT")
    expect(resolveFullLocale("hu", KNOWN)).toBe("hu-HU")
    expect(resolveFullLocale("de", KNOWN)).toBe("de-DE")
    expect(resolveFullLocale("fr", KNOWN)).toBe("fr-FR")
  })

  it("falls back to the first variant, then passes an unknown code through", () => {
    expect(resolveFullLocale("en", KNOWN)).toBe("en-US")
    expect(resolveFullLocale("xyz", KNOWN)).toBe("xyz")
  })
})

describe("groupByLanguage", () => {
  it("groups variants of one language so it is translated once", () => {
    expect(groupByLanguage(["de-AT", "hu-HU", "de-DE"])).toEqual([
      ["de-AT", "de-DE"],
      ["hu-HU"],
    ])
    expect(groupByLanguage([])).toEqual([])
  })
})

describe("resolveTargetLocales", () => {
  const original = process.env.AUTO_TRANSLATE_LOCALES

  afterEach(() => {
    if (original === undefined) {
      delete process.env.AUTO_TRANSLATE_LOCALES
    } else {
      process.env.AUTO_TRANSLATE_LOCALES = original
    }
  })

  it("uses AUTO_TRANSLATE_LOCALES, each code resolved to a full locale", async () => {
    process.env.AUTO_TRANSLATE_LOCALES = "hu, de"

    expect(await resolveTargetLocales(containerWith([]), "en")).toEqual([
      "hu-HU",
      "de-DE",
    ])
  })

  it("falls back to the languages the store offers", async () => {
    delete process.env.AUTO_TRANSLATE_LOCALES

    expect(await resolveTargetLocales(containerWith(["de-DE"]), "en")).toEqual([
      "de-DE",
    ])
  })

  it("never targets the content's own language", async () => {
    process.env.AUTO_TRANSLATE_LOCALES = "hu,de"

    expect(await resolveTargetLocales(containerWith([]), "de-AT")).toEqual(["hu-HU"])
  })
})

describe("providerStatus", () => {
  const saved = { ...process.env }

  afterEach(() => {
    process.env = { ...saved }
  })

  it("is not configured without TRANSLATION_PROVIDER", () => {
    delete process.env.TRANSLATION_PROVIDER

    expect(providerStatus()).toEqual({ name: null, configured: false })
  })

  it("needs a key for Gemini and a URL for LibreTranslate", () => {
    process.env.TRANSLATION_PROVIDER = "gemini"
    delete process.env.GEMINI_API_KEY
    expect(providerStatus()).toEqual({ name: "gemini", configured: false })

    process.env.GEMINI_API_KEY = "k"
    expect(providerStatus()).toEqual({ name: "gemini", configured: true })

    process.env.TRANSLATION_PROVIDER = "libretranslate"
    delete process.env.LIBRETRANSLATE_URL
    expect(providerStatus().configured).toBe(false)
  })

  it("needs nothing for the keyless providers", () => {
    process.env.TRANSLATION_PROVIDER = "google-scraper"
    expect(providerStatus()).toEqual({ name: "google-scraper", configured: true })
    process.env.TRANSLATION_PROVIDER = "echo"
    expect(providerStatus().configured).toBe(true)
  })
})
