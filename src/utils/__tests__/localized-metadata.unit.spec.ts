import { addLanguages, addLanguagesToList } from "../localized-metadata"

const MAINTENANCE_FREE = {
  en: "Maintenance-free",
  "de-AT": "Pflegefrei",
  "de-DE": "Pflegefrei",
}

describe("addLanguages", () => {
  it("turns a plain text into a text by language, keeping the English as it is", () => {
    const result = addLanguages("Maintenance-free", MAINTENANCE_FREE)

    expect(JSON.parse(result!)).toEqual(MAINTENANCE_FREE)
  })

  it("adds to a text that is stored as JSON and has only English", () => {
    const result = addLanguages('{"en":"Maintenance-free"}', MAINTENANCE_FREE)

    expect(JSON.parse(result!)).toEqual(MAINTENANCE_FREE)
  })

  it("keeps a language that is already there, even when it differs", () => {
    const result = addLanguages(
      { en: "Maintenance-free", "de-DE": "Wartungsfrei" },
      MAINTENANCE_FREE
    )

    expect(JSON.parse(result!)).toEqual({
      en: "Maintenance-free",
      "de-DE": "Wartungsfrei",
      "de-AT": "Pflegefrei",
    })
  })

  it("fills a language that is there but empty", () => {
    const result = addLanguages(
      { en: "Maintenance-free", "de-DE": "  " },
      MAINTENANCE_FREE
    )

    expect(JSON.parse(result!)["de-DE"]).toBe("Pflegefrei")
  })

  it("has nothing to add when every language is there", () => {
    expect(addLanguages(JSON.stringify(MAINTENANCE_FREE), MAINTENANCE_FREE)).toBeNull()
  })

  it("leaves a text alone when its English is no longer the one translated", () => {
    expect(addLanguages("Wartungsfrei und pflegeleicht", MAINTENANCE_FREE)).toBeNull()
    expect(addLanguages('{"en":"Almost maintenance-free"}', MAINTENANCE_FREE)).toBeNull()
  })

  it("does not make up a text the product does not have", () => {
    expect(addLanguages(undefined, MAINTENANCE_FREE)).toBeNull()
    expect(addLanguages("", MAINTENANCE_FREE)).toBeNull()
    expect(addLanguages(null, MAINTENANCE_FREE)).toBeNull()
  })

  it("ignores spaces around the English when comparing", () => {
    const result = addLanguages("  Maintenance-free ", MAINTENANCE_FREE)

    expect(JSON.parse(result!)).toEqual({ ...MAINTENANCE_FREE, en: "  Maintenance-free " })
  })
})

describe("addLanguagesToList", () => {
  const features = [
    { en: "Maintenance-free", "de-DE": "Pflegefrei" },
    { en: "Suitable for indoor use", "de-DE": "Für den Innenbereich geeignet" },
  ]

  it("adds the languages to every entry of a list that has only English", () => {
    const stored = JSON.stringify([
      { en: "Maintenance-free" },
      { en: "Suitable for indoor use" },
    ])

    expect(JSON.parse(addLanguagesToList(stored, features)!)).toEqual(features)
  })

  it("finds each entry by its English, whatever the order or the other entries", () => {
    const stored = JSON.stringify([
      { en: "Suitable for indoor use" },
      { en: "Added in the admin" },
      { en: "Maintenance-free" },
    ])

    expect(JSON.parse(addLanguagesToList(stored, features)!)).toEqual([
      features[1],
      { en: "Added in the admin" },
      features[0],
    ])
  })

  it("leaves an entry alone when its English was edited", () => {
    const stored = JSON.stringify([
      { en: "Nearly maintenance-free" },
      { en: "Suitable for indoor use" },
    ])

    expect(JSON.parse(addLanguagesToList(stored, features)!)).toEqual([
      { en: "Nearly maintenance-free" },
      features[1],
    ])
  })

  it("reads entries that are plain texts", () => {
    const stored = JSON.stringify(["Maintenance-free"])

    expect(JSON.parse(addLanguagesToList(stored, features)!)).toEqual([features[0]])
  })

  it("has nothing to add when the list is complete, missing or not a list", () => {
    expect(addLanguagesToList(JSON.stringify(features), features)).toBeNull()
    expect(addLanguagesToList(undefined, features)).toBeNull()
    expect(addLanguagesToList('{"en":"Maintenance-free"}', features)).toBeNull()
    expect(addLanguagesToList("not json", features)).toBeNull()
  })
})
