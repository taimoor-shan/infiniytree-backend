import {
  LONG_DESCRIPTION_KEY,
  checkLongDescription,
  isBlankHtml,
  longDescriptionMetadata,
  readLongDescription,
  sameLongDescription,
} from "../../admin/lib/product-long-description"

const form = (en = "", de = "", hu = "") => ({ en, de, hu })

describe("isBlankHtml", () => {
  it("treats what an empty editor holds as no text", () => {
    expect(isBlankHtml("")).toBe(true)
    expect(isBlankHtml("<p></p>")).toBe(true)
    expect(isBlankHtml("<p> </p><p>&nbsp;</p>")).toBe(true)
    expect(isBlankHtml("<p><br></p>")).toBe(true)
  })

  it("keeps anything that shows or says something", () => {
    expect(isBlankHtml("<p>Hello</p>")).toBe(false)
    expect(isBlankHtml("<hr>")).toBe(false)
    expect(isBlankHtml('<img src="/a.jpg">')).toBe(false)
    expect(isBlankHtml("<table><tr><td></td></tr></table>")).toBe(false)
  })
})

describe("readLongDescription", () => {
  it("reads the key the storefront's Description section reads", () => {
    expect(LONG_DESCRIPTION_KEY).toBe("long_description")
  })

  it("is empty for a product without one, whatever else its metadata holds", () => {
    expect(readLongDescription(undefined)).toEqual(form())
    expect(readLongDescription(null)).toEqual(form())
    expect(readLongDescription({ short_description: "Short" })).toEqual(form())
    expect(readLongDescription({ long_description: "" })).toEqual(form())
    expect(readLongDescription({ long_description: "<p></p>" })).toEqual(form())
  })

  it("reads a plain text as the English one", () => {
    expect(readLongDescription({ long_description: "<p>Hello</p>" })).toEqual(
      form("<p>Hello</p>")
    )
  })

  it("reads one text per language, saved as JSON text or as an object", () => {
    const languages = {
      en: "<p>Hello</p>",
      "de-AT": "<p>Servus</p>",
      "de-DE": "<p>Hallo</p>",
      "hu-HU": "<p>Szia</p>",
    }
    const expected = form("<p>Hello</p>", "<p>Hallo</p>", "<p>Szia</p>")

    expect(
      readLongDescription({ long_description: JSON.stringify(languages) })
    ).toEqual(expected)
    expect(readLongDescription({ long_description: languages })).toEqual(
      expected
    )
  })

  it("falls back to the Austrian German, then to the bare languages", () => {
    expect(
      readLongDescription({
        long_description: JSON.stringify({ en: "<p>A</p>", "de-AT": "<p>B</p>" }),
      }).de
    ).toBe("<p>B</p>")
    expect(
      readLongDescription({
        long_description: JSON.stringify({
          en: "<p>A</p>",
          de: "<p>B</p>",
          hu: "<p>C</p>",
        }),
      })
    ).toEqual(form("<p>A</p>", "<p>B</p>", "<p>C</p>"))
  })

  it("passes over a language whose text is blank", () => {
    expect(
      readLongDescription({
        long_description: JSON.stringify({
          en: "<p>A</p>",
          "de-DE": "<p></p>",
          "de-AT": "<p>B</p>",
        }),
      }).de
    ).toBe("<p>B</p>")
  })
})

describe("sameLongDescription", () => {
  it("compares the texts, not the empty paragraphs around them", () => {
    expect(sameLongDescription(form("<p>A</p>"), form(" <p>A</p> "))).toBe(true)
    expect(sameLongDescription(form("<p>A</p>", "<p></p>"), form("<p>A</p>"))).toBe(
      true
    )
    expect(sameLongDescription(form("<p>A</p>"), form("<p>B</p>"))).toBe(false)
    expect(
      sameLongDescription(form("<p>A</p>"), form("<p>A</p>", "<p>B</p>"))
    ).toBe(false)
  })
})

describe("checkLongDescription", () => {
  it("wants the English text before any other", () => {
    expect(checkLongDescription(form("<p>A</p>", "<p>B</p>"))).toBeNull()
    expect(checkLongDescription(form())).toBeNull()
    expect(checkLongDescription(form("", "<p>B</p>"))).toMatch(/English/)
    expect(checkLongDescription(form("<p></p>", "", "<p>C</p>"))).toMatch(
      /English/
    )
  })
})

describe("longDescriptionMetadata", () => {
  it("saves English alone as plain HTML", () => {
    expect(longDescriptionMetadata(undefined, form("<p>Hello</p>"))).toEqual({
      long_description: "<p>Hello</p>",
    })
  })

  it("saves more languages as JSON, one text for every market of a language", () => {
    const { long_description } = longDescriptionMetadata(
      undefined,
      form("<p>Hello</p>", "<p>Hallo</p>", "<p>Szia</p>")
    )

    expect(JSON.parse(long_description)).toEqual({
      en: "<p>Hello</p>",
      de: "<p>Hallo</p>",
      hu: "<p>Szia</p>",
    })
    // The storefront reads it back the way it was written
    expect(
      readLongDescription({ long_description })
    ).toEqual(form("<p>Hello</p>", "<p>Hallo</p>", "<p>Szia</p>"))
  })

  it("sends an empty string to remove the key when nothing is left", () => {
    expect(longDescriptionMetadata("<p>Hello</p>", form())).toEqual({
      long_description: "",
    })
    expect(longDescriptionMetadata("<p>Hello</p>", form("<p></p>"))).toEqual({
      long_description: "",
    })
  })

  it("goes back to plain HTML when the other languages are taken away", () => {
    const stored = JSON.stringify({
      en: "<p>Hello</p>",
      de: "<p>Hallo</p>",
      "hu-HU": "<p>Szia</p>",
    })

    expect(longDescriptionMetadata(stored, form("<p>Hello</p>"))).toEqual({
      long_description: "<p>Hello</p>",
    })
  })

  it("changes only the language that was edited, and leaves a text written per market as it is", () => {
    const stored = JSON.stringify({
      en: "<p>Hello</p>",
      "de-AT": "<p>Servus</p>",
      "de-DE": "<p>Hallo</p>",
      "hu-HU": "<p>Szia</p>",
    })
    const { long_description } = longDescriptionMetadata(
      stored,
      form("<p>Hello there</p>", "<p>Hallo</p>", "<p>Szia</p>")
    )

    // German was not edited: the Austrian wording survives next to it
    expect(JSON.parse(long_description)).toEqual({
      en: "<p>Hello there</p>",
      "de-AT": "<p>Servus</p>",
      "de-DE": "<p>Hallo</p>",
      "hu-HU": "<p>Szia</p>",
    })
  })

  it("writes an edited German under 'de' and clears the German it replaces", () => {
    const stored = JSON.stringify({
      en: "<p>Hello</p>",
      "de-AT": "<p>Servus</p>",
      "de-DE": "<p>Hallo</p>",
      de: "<p>Old</p>",
    })
    const { long_description } = longDescriptionMetadata(
      stored,
      form("<p>Hello</p>", "<p>Guten Tag</p>")
    )

    expect(JSON.parse(long_description)).toEqual({
      en: "<p>Hello</p>",
      de: "<p>Guten Tag</p>",
    })
  })

  it("removes a language that was cleared, and keeps the order readable", () => {
    const stored = JSON.stringify({
      "hu-HU": "<p>Szia</p>",
      "de-DE": "<p>Hallo</p>",
      en: "<p>Hello</p>",
    })
    const { long_description } = longDescriptionMetadata(
      stored,
      form("<p>Hello</p>", "<p></p>", "<p>Szia</p>")
    )

    expect(JSON.parse(long_description)).toEqual({
      en: "<p>Hello</p>",
      "hu-HU": "<p>Szia</p>",
    })
    expect(Object.keys(JSON.parse(long_description))).toEqual(["en", "hu-HU"])
  })

  it("touches only its own key", () => {
    expect(Object.keys(longDescriptionMetadata(undefined, form("<p>A</p>")))).toEqual([
      "long_description",
    ])
  })
})
