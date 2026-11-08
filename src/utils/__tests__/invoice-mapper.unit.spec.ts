import fs from "fs"
import path from "path"
import { mapOrderToInvoice } from "../invoice/mapper"
import { fmt, fmtAmount, getTotals } from "../invoice/helpers"
import { theme } from "../invoice/theme"
import type { InvoiceOrderData } from "../invoice/types"
import deAT from "../../modules/resend/i18n/dictionaries/de-AT.json"
import deDE from "../../modules/resend/i18n/dictionaries/de-DE.json"
import en from "../../modules/resend/i18n/dictionaries/en.json"
import hu from "../../modules/resend/i18n/dictionaries/hu-HU.json"

const DICTIONARIES: Record<string, Record<string, string>> = {
  en,
  "de-AT": deAT,
  "de-DE": deDE,
  "hu-HU": hu,
}

const bank = {
  bankName: "OTP Bank",
  iban: "HU00117130812147721600000000",
  bic: "OTPVHUHBXXX",
  beneficiary: "Deltalivings Kft.",
  reference: "Order #81",
}

// Intl separates digit groups, and the currency from the number, with no-break spaces
const plain = (text: string) => text.replace(/[  ]/g, " ")

// A Hungarian order with a 20% code, as the invoice routes hand it over (the
// figures are the ones Medusa gave a real test order: the discount is 1 385 454
// with its VAT and 1 090 909 without)
const hungarian: InvoiceOrderData = {
  id: "order_01M6X739R5GQPYAPXMPJCGDJ5Z",
  display_id: 81,
  created_at: "2026-11-08T12:00:00.000Z",
  currency_code: "huf",
  locale: "hu-HU",
  shipping_address: {
    first_name: "Győző",
    last_name: "Kovács-Nagy",
    company: "Tűzhely Kft.",
    address_1: "Fő utca 12.",
    city: "Győr",
    postal_code: "9021",
    country_code: "hu",
    metadata: { vat_number: "HU12345678" },
  },
  items: [
    {
      title: "Red Maple Tree",
      quantity: 1,
      unit_price: 5454545,
      product: { title: "Red Maple Tree" },
      variant: { title: "Black Pot" },
    },
  ],
  subtotal: 5454545,
  item_subtotal: 5454545,
  shipping_total: 20000,
  shipping_subtotal: 20000,
  discount_total: 1385454.43,
  discount_subtotal: 1090909,
  discount_codes: ["Real007"],
  tax_total: 1183581.72,
  total: 5567217.72,
}

// An order for Germany: no VAT (reverse charge), euros
const german: InvoiceOrderData = {
  id: "order_01M6X8MM4C62KW2GR018N61XKB",
  display_id: 82,
  created_at: "2026-11-08T12:00:00.000Z",
  currency_code: "eur",
  locale: "de-DE",
  shipping_address: { first_name: "Max", last_name: "Müller", country_code: "de" },
  items: [{ title: "Red Maple Tree", quantity: 1, unit_price: 3000 }],
  item_subtotal: 3000,
  shipping_subtotal: 230,
  discount_total: 600,
  discount_subtotal: 600,
  discount_codes: ["Real007"],
  tax_total: 0,
  total: 2630,
}

describe("the discount on the invoice", () => {
  it("is the net discount, named after its code", () => {
    const { totals } = mapOrderToInvoice(hungarian, bank)

    expect(plain(totals.discount!)).toBe("1 090 909 Ft")
    expect(totals.discountLabel).toBe("Kedvezmény (Real007)")
  })

  it("makes the rows add up to the total", () => {
    // 5 454 545 + 20 000 − 1 090 909 + 1 183 582 = 5 567 218; with the gross
    // discount the sum would be 294 545 (the VAT on the discount) too low
    const { subtotal, shipping, discount, tax, total } = getTotals(hungarian)

    expect(discount).toBe(1090909)
    expect(Math.round(subtotal + shipping - discount + tax)).toBe(Math.round(total))
  })

  it("falls back to the discount with VAT when the order carries no net one", () => {
    const { discount_subtotal: _net, ...withoutNet } = hungarian

    expect(getTotals(withoutNet).discount).toBe(1385454.43)
  })

  it("has no discount row for an order without a discount", () => {
    const order = { ...hungarian, discount_total: 0, discount_subtotal: 0, discount_codes: [] }

    expect(mapOrderToInvoice(order, bank).totals.discount).toBeUndefined()
  })

  it("is only called Discount when no code explains it", () => {
    const order = { ...hungarian, discount_codes: undefined }

    expect(mapOrderToInvoice(order, bank).totals.discountLabel).toBe("Kedvezmény")
  })

  it("names every code of an order that used several", () => {
    const order = { ...hungarian, discount_codes: ["WELCOME", "VIP"] }

    expect(mapOrderToInvoice(order, bank).totals.discountLabel).toBe("Kedvezmény (WELCOME, VIP)")
  })
})

describe("the invoice's language", () => {
  const titleOf = (order: InvoiceOrderData) => mapOrderToInvoice(order, bank).labels.title

  it("follows the order's locale", () => {
    expect(titleOf(hungarian)).toBe("PRO FORMA SZÁMLA")
    expect(titleOf(german)).toBe("PRO-FORMA-RECHNUNG")
    expect(titleOf({ ...german, locale: "de-AT" })).toBe("PRO-FORMA-RECHNUNG")
    expect(titleOf({ ...german, locale: "en" })).toBe("PRO FORMA INVOICE")
  })

  it("is English for an order that has no locale, or one the shop does not translate", () => {
    expect(titleOf({ ...german, locale: null })).toBe("PRO FORMA INVOICE")
    expect(titleOf({ ...german, locale: undefined })).toBe("PRO FORMA INVOICE")
    expect(titleOf({ ...german, locale: "fr" })).toBe("PRO FORMA INVOICE")
  })

  it.each(Object.keys(DICTIONARIES))("has a word for every label in %s", (locale) => {
    const invoice = mapOrderToInvoice({ ...hungarian, locale }, bank)
    const { totals } = invoice
    const words = [
      ...Object.values(invoice.labels),
      totals.subtotalLabel,
      totals.shippingLabel,
      totals.discountLabel,
      totals.vatLabel,
      totals.totalLabel,
      totals.vatNote,
    ]

    for (const word of words) {
      expect(word).toBeTruthy()
      // a key with no entry comes back as itself
      expect(word).not.toMatch(/^invoice\./)
    }
  })

  it("writes the VAT row and the legal note in the customer's language", () => {
    const hu = mapOrderToInvoice(hungarian, bank).totals
    expect(hu.vatLabel).toBe("ÁFA (27%)")
    expect(hu.vatNote).toBe("27% ÁFA-t tartalmaz a magyar ÁFA-törvény szerint.")

    const de = mapOrderToInvoice(german, bank).totals
    expect(de.vatLabel).toBe("MwSt. (0%)")
    expect(de.vatNote).toMatch(/^Steuerschuldnerschaft des Leistungsempfängers/)

    const english = mapOrderToInvoice({ ...german, locale: null }, bank).totals
    expect(english.vatLabel).toBe("VAT (0%)")
    expect(english.vatNote).toBe("Reverse charge applies (Art. 196 VAT Directive) — VAT not charged.")
  })

  it("writes the shop's country in the customer's language", () => {
    const country = (order: InvoiceOrderData) => mapOrderToInvoice(order, bank).labels.companyCountry

    expect(country(hungarian)).toBe("Magyarország")
    expect(country(german)).toBe("Ungarn")
    expect(country({ ...german, locale: null })).toBe("Hungary")
  })
})

describe("numbers and dates", () => {
  it("follow the customer's country", () => {
    const hu = mapOrderToInvoice(hungarian, bank)
    expect(plain(hu.totals.total)).toBe("5 567 218 Ft")
    // the product rows keep the figure alone, as they always did for forints
    expect(plain(hu.items[0].unitPrice)).toBe("5 454 545")
    expect(hu.issueDate).toBe("2026. november 8.")
    expect(hu.dueDate).toBe("2026. november 22.")

    const de = mapOrderToInvoice(german, bank)
    expect(plain(de.totals.total)).toBe("2.630,00 €")
    expect(plain(de.items[0].unitPrice)).toBe("3.000,00 €")
    expect(de.issueDate).toBe("8. November 2026")
  })

  it("stay as they always were for English", () => {
    const english = mapOrderToInvoice({ ...hungarian, locale: null }, bank)

    expect(plain(english.totals.total)).toBe("HUF 5,567,218")
    expect(english.items[0].unitPrice).toBe("5,454,545")
    expect(english.issueDate).toBe("8 November 2026")
    expect(english.dueDate).toBe("22 November 2026")
    expect(fmt(1234.5, "eur")).toBe("€1,234.50")
    expect(fmtAmount(1234.5, "eur")).toBe("1,234.50")
  })
})

describe("the invoice dictionary entries", () => {
  const keys = (dictionary: Record<string, string>) =>
    Object.keys(dictionary)
      .filter((key) => key.startsWith("invoice."))
      .sort()

  it("has the invoice's words", () => {
    expect(keys(en).length).toBeGreaterThan(20)
  })

  it("has every key in every language, with a text", () => {
    for (const [locale, dictionary] of Object.entries(DICTIONARIES)) {
      expect([locale, keys(dictionary)]).toEqual([locale, keys(en)])
      for (const key of keys(dictionary)) expect(dictionary[key].trim()).not.toBe("")
    }
  })
})

describe("the fonts Hungarian needs", () => {
  // The base fonts hold the letters of Western Europe: ő and ű printed as empty
  // boxes until the latin-ext twins were added (theme.ts names them second)
  const fontDir = path.join(__dirname, "../../../fonts")
  const extensions = [
    "DMSans-LatinExt-Regular.woff",
    "DMSans-LatinExt-Bold.woff",
    "BodoniModa-LatinExt-Regular.woff",
  ]

  it.each(extensions)("ships %s", (file) => {
    expect(fs.statSync(path.join(fontDir, file)).size).toBeGreaterThan(1000)
  })

  it("names the twins after the base fonts in the font stacks", () => {
    expect(theme.typography.body).toEqual(["DM Sans", "DM Sans Ext"])
    expect(theme.typography.heading).toEqual(["Bodoni Moda", "Bodoni Moda Ext"])
  })

  // fontkit comes with react-pdf: without it the check is skipped
  let fontkit: any = null
  try {
    fontkit = require("fontkit")
  } catch {
    // not installed
  }

  ;(fontkit ? it.each(extensions) : it.skip.each(extensions))("%s has ő and ű", (file) => {
    const font = fontkit.openSync(path.join(fontDir, file))

    expect(font.hasGlyphForCodePoint(0x151)).toBe(true)
    expect(font.hasGlyphForCodePoint(0x171)).toBe(true)
  })
})
