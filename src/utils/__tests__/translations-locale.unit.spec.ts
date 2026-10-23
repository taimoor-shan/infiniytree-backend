import {
  isSameLanguage,
  languageOf,
  pickBestRecord,
  pickBestTranslation,
  rankLocale,
} from "../translations/locale"

describe("rankLocale", () => {
  it("ranks the exact locale, the bare language, a sibling variant, then English", () => {
    expect(rankLocale("de-AT", "de-AT")).toBe(0)
    expect(rankLocale("de", "de-AT")).toBe(1)
    expect(rankLocale("de-DE", "de-AT")).toBe(2)
    expect(rankLocale("en", "de-AT")).toBe(3)
    expect(rankLocale("hu-HU", "de-AT")).toBe(4)
  })

  it("ignores case and treats a missing locale as English", () => {
    expect(rankLocale("DE-at", "de-AT")).toBe(0)
    expect(rankLocale(null, "en")).toBe(0)
    expect(rankLocale("en", null)).toBe(0)
    expect(rankLocale(undefined, undefined)).toBe(0)
  })

  it("does not mistake a longer language code for a sibling variant", () => {
    // "deu" starts with "de" but is not "de-" anything.
    expect(rankLocale("deu-XX", "de-AT")).toBe(4)
  })

  it("counts an English variant as English for a non-English visitor", () => {
    expect(rankLocale("en-GB", "de-AT")).toBe(3)
  })
})

describe("isSameLanguage", () => {
  it("is true for the visitor's own language in any variant, false otherwise", () => {
    expect(isSameLanguage("de-AT", "de-DE")).toBe(true)
    expect(isSameLanguage("de", "de-DE")).toBe(true)
    expect(isSameLanguage("en", "en")).toBe(true)
    expect(isSameLanguage("en", "de-DE")).toBe(false)
    expect(isSameLanguage("hu-HU", "de-DE")).toBe(false)
  })
})

describe("pickBestRecord", () => {
  const en = { id: "en", locale: "en" }
  const deAT = { id: "de-AT", locale: "de-AT" }
  const deDE = { id: "de-DE", locale: "de-DE" }
  const hu = { id: "hu", locale: "hu-HU" }

  it("prefers a record in the visitor's own language, any variant", () => {
    expect(pickBestRecord([en, deAT], "de-DE")).toBe(deAT)
    expect(pickBestRecord([en, deAT, deDE], "de-DE")).toBe(deDE)
  })

  it("falls back to English, then to any language", () => {
    expect(pickBestRecord([hu, en], "de-DE")).toBe(en)
    expect(pickBestRecord([hu], "de-DE")).toBe(hu)
  })

  it("breaks a tie by the lowest locale code, whatever the input order", () => {
    expect(pickBestRecord([deDE, deAT], "de")).toBe(deAT)
    expect(pickBestRecord([deAT, deDE], "de")).toBe(deAT)
  })

  it("breaks a tie between records in the same language by the oldest id, whatever the input order", () => {
    // A copy saved with the wrong language: same slug, same locale.
    const original = { id: "01M45YY5HQ", locale: "en" }
    const copy = { id: "01M45YZJAF", locale: "en" }

    expect(pickBestRecord([copy, original], "en")).toBe(original)
    expect(pickBestRecord([original, copy], "en")).toBe(original)
    expect(pickBestRecord([copy, original], "de-DE")).toBe(original)
  })

  it("returns nothing for no records", () => {
    expect(pickBestRecord([], "en")).toBeUndefined()
  })
})

describe("pickBestTranslation", () => {
  const rows = [
    { locale_code: "de-DE", id: "a" },
    { locale_code: "hu-HU", id: "b" },
  ]

  it("takes the exact locale", () => {
    expect(pickBestTranslation(rows, "de-DE")?.id).toBe("a")
  })

  it("falls back to another variant of the same language", () => {
    expect(pickBestTranslation(rows, "de-AT")?.id).toBe("a")
  })

  it("never offers a translation in another language", () => {
    expect(pickBestTranslation(rows, "fr-FR")).toBeUndefined()
    expect(pickBestTranslation(undefined, "de-DE")).toBeUndefined()
    expect(pickBestTranslation([], "de-DE")).toBeUndefined()
  })

  it("prefers the exact locale over a sibling", () => {
    const both = [
      { locale_code: "de-DE", id: "de" },
      { locale_code: "de-AT", id: "at" },
    ]

    expect(pickBestTranslation(both, "de-AT")?.id).toBe("at")
    expect(pickBestTranslation(both, "de-DE")?.id).toBe("de")
  })
})

describe("languageOf", () => {
  it("is the language part of a locale", () => {
    expect(languageOf("de-AT")).toBe("de")
    expect(languageOf("HU")).toBe("hu")
    expect(languageOf("en")).toBe("en")
  })
})
