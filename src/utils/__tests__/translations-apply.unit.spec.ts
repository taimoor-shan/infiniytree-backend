import { Modules } from "@medusajs/framework/utils"
import {
  localizeRecords,
  mergeTranslation,
  resolveLocalizedRecord,
  translatedLocales,
} from "../translations/apply"

type Row = {
  id?: string
  reference_id: string
  locale_code: string
  translations: Record<string, unknown> | null
}

/** A container whose Translation module returns the given rows. */
const containerWith = (rows: Row[]) => ({
  resolve: (key: string) => {
    if (key !== Modules.TRANSLATION) {
      throw new Error(`unexpected resolve of ${key}`)
    }

    return {
      listTranslations: async (filters: { reference_id: string[] }) =>
        rows.filter((row) => filters.reference_id.includes(row.reference_id)),
    }
  },
})

const noTranslationModule = {
  resolve: () => {
    throw new Error("not registered")
  },
}

describe("mergeTranslation", () => {
  const record = {
    id: "p1",
    locale: "en",
    title: "About",
    excerpt: null as string | null,
    slug: "about",
  }

  it("lays translated text over the original and reports the new language", () => {
    const merged = mergeTranslation(record, {
      reference_id: "p1",
      locale_code: "de-DE",
      translations: { title: "Über uns" },
    })

    expect(merged.title).toBe("Über uns")
    expect(merged.locale).toBe("de-DE")
    expect(merged.slug).toBe("about")
  })

  it("never erases the original with a blank translation", () => {
    const merged = mergeTranslation(record, {
      reference_id: "p1",
      locale_code: "de-DE",
      translations: { title: "   " },
    })

    expect(merged.title).toBe("About")
  })

  it("only replaces fields the record has as text", () => {
    const merged = mergeTranslation(record, {
      reference_id: "p1",
      locale_code: "de-DE",
      // `excerpt` is null on the original, `unknown` is not a field of it
      translations: { excerpt: "Kurz", unknown: "x", slug: "ueber-uns" },
    })

    expect(merged.excerpt).toBeNull()
    expect(merged).not.toHaveProperty("unknown")
    // A slug is text, but translations are meant for translatable fields only;
    // the module already filters rows to those, so the merge trusts them.
    expect(merged.slug).toBe("ueber-uns")
  })

  it("returns the record untouched without a translation", () => {
    expect(mergeTranslation(record, undefined)).toBe(record)
    expect(
      mergeTranslation(record, {
        reference_id: "p1",
        locale_code: "de-DE",
        translations: null,
      })
    ).toBe(record)
  })
})

describe("localizeRecords", () => {
  const english = { id: "a", locale: "en", title: "About" }
  const german = { id: "b", locale: "de-AT", title: "Über uns" }
  const rows: Row[] = [
    { reference_id: "a", locale_code: "de-DE", translations: { title: "Uns" } },
    { reference_id: "a", locale_code: "hu-HU", translations: { title: "Rólunk" } },
  ]

  it("translates a record written in another language", async () => {
    const [record] = await localizeRecords(containerWith(rows), [english], "de-DE")

    expect(record.title).toBe("Uns")
    expect(record.locale).toBe("de-DE")
  })

  it("falls back from de-AT to a de-DE translation", async () => {
    const [record] = await localizeRecords(containerWith(rows), [english], "de-AT")

    expect(record.title).toBe("Uns")
  })

  it("leaves a record already in the visitor's language as it is", async () => {
    const [record] = await localizeRecords(containerWith(rows), [german], "de-DE")

    expect(record).toBe(german)
  })

  it("keeps the original for a language with no translation", async () => {
    const [record] = await localizeRecords(containerWith(rows), [english], "fr-FR")

    expect(record).toBe(english)
  })

  it("does nothing without a locale or without the Translation module", async () => {
    expect(await localizeRecords(containerWith(rows), [english], undefined)).toEqual([
      english,
    ])
    expect(await localizeRecords(noTranslationModule, [english], "de-DE")).toEqual([
      english,
    ])
  })
})

describe("resolveLocalizedRecord", () => {
  const english = { id: "a", locale: "en", title: "About" }
  const germanNative = { id: "b", locale: "de-AT", title: "Über uns (handgeschrieben)" }
  const rows: Row[] = [
    { reference_id: "a", locale_code: "de-DE", translations: { title: "Uns (maschinell)" } },
  ]

  it("prefers a record written in the visitor's language over a translation", async () => {
    const record = await resolveLocalizedRecord(
      containerWith(rows),
      [english, germanNative],
      "de-DE"
    )

    expect(record?.title).toBe("Über uns (handgeschrieben)")
  })

  it("uses the original plus its translation when no record is in the language", async () => {
    const record = await resolveLocalizedRecord(containerWith(rows), [english], "de-DE")

    expect(record?.title).toBe("Uns (maschinell)")
  })

  it("serves English to an English visitor and nothing for no records", async () => {
    const record = await resolveLocalizedRecord(
      containerWith(rows),
      [english, germanNative],
      "en"
    )

    expect(record?.title).toBe("About")
    expect(await resolveLocalizedRecord(containerWith(rows), [], "en")).toBeUndefined()
  })
})

describe("translatedLocales", () => {
  it("lists the locales that have at least one non-blank translation", () => {
    expect(
      translatedLocales([
        { reference_id: "a", locale_code: "hu-HU", translations: { title: "Rólunk" } },
        { reference_id: "a", locale_code: "de-DE", translations: { title: "Uns" } },
        { reference_id: "a", locale_code: "fr-FR", translations: { title: " " } },
        { reference_id: "a", locale_code: "es-ES", translations: null },
      ])
    ).toEqual(["de-DE", "hu-HU"])
    expect(translatedLocales(undefined)).toEqual([])
  })
})
