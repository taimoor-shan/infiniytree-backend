import type { RateTable } from "./rates"

/**
 * The delivery rates the shop starts with (`yarn medusa exec
 * ./src/scripts/setup-shipping.ts` saves them). After that they belong to the
 * admin: Settings -> Shipping rates edits every figure here without code.
 *
 * Pallet products ship one pallet per unit. Austria and Germany are Sky-Log's
 * tariff ("Austrian and German delivery prices.xlsx"), Hungary is a fixed
 * 50 euro per pallet. Carton products are a fixed 50 euro per unit in all three.
 */

/** Euro rates for the shop's other currencies: how many units of it make 1 euro. */
export const INITIAL_CURRENCY_RATES: Record<string, number> = {
  // A placeholder to be replaced with the real rate in the admin.
  huf: 400,
}

/** What the unit is called in the price rows of a class, for the admin. */
const UNIT = { pallet: "pallet", carton: "carton" } as const

const COUNTRY_NAME: Record<string, string> = {
  at: "Austria",
  de: "Germany",
  hu: "Hungary",
}

/** One zone for the whole country and one price per unit, however many. */
const fixedRate = (
  shippingClass: keyof typeof UNIT,
  countryCode: string,
  euroPerUnit: number
): RateTable => ({
  shipping_class: shippingClass,
  country_code: countryCode,
  zones: [
    {
      id: "all",
      name: `All of ${COUNTRY_NAME[countryCode]}`,
      postcodes: "",
      is_fallback: true,
    },
  ],
  tiers: [
    {
      id: "one",
      label: `1 ${UNIT[shippingClass]}`,
      quantity: 1,
      active: true,
      prices: { all: euroPerUnit },
    },
  ],
})

/**
 * The sheet names one example postcode for each zone, not the list of
 * postcodes a zone covers. Each example is read as a prefix (8010 -> "8",
 * the first digit of an Austrian postcode is its region), and any postcode
 * not named goes to zone 4, the dearest, so a delivery is never undercharged.
 * Replace these with Sky-Log's full zone list in the admin.
 *
 * The sheet has more than one 1-pallet row (by weight and height). The first
 * of each country is on, the others are kept for switching on.
 */
const skyLogAustria: RateTable = {
  shipping_class: "pallet",
  country_code: "at",
  zones: [
    { id: "z1", name: "Zone 1", postcodes: "8", is_fallback: false },
    { id: "z2", name: "Zone 2", postcodes: "1", is_fallback: false },
    { id: "z3", name: "Zone 3", postcodes: "3", is_fallback: false },
    { id: "z4", name: "Zone 4", postcodes: "6", is_fallback: true },
  ],
  tiers: [
    {
      id: "p1-50",
      label: "1 pallet / 50 kg, 120 x 80 x 170 cm",
      quantity: 1,
      active: true,
      prices: { z1: 80, z2: 85, z3: 90, z4: 100 },
    },
    {
      id: "p1-100",
      label: "1 pallet / 100 kg, 120 x 80 x 120 cm",
      quantity: 1,
      active: false,
      prices: { z1: 100, z2: 110, z3: 120, z4: 130 },
    },
    {
      id: "p2",
      label: "2 pallets / 200 kg in total, 120 x 80 x 150 cm per pallet",
      quantity: 2,
      active: true,
      prices: { z1: 150, z2: 180, z3: 200, z4: 210 },
    },
  ],
}

const skyLogGermany: RateTable = {
  shipping_class: "pallet",
  country_code: "de",
  zones: [
    { id: "z1", name: "Zone 1", postcodes: "90", is_fallback: false },
    { id: "z2", name: "Zone 2", postcodes: "7", is_fallback: false },
    { id: "z3", name: "Zone 3", postcodes: "15", is_fallback: false },
    { id: "z4", name: "Zone 4", postcodes: "16", is_fallback: true },
  ],
  tiers: [
    {
      id: "p1-50",
      label: "1 pallet / 50 kg, 120 x 80 x 170 cm",
      quantity: 1,
      active: true,
      prices: { z1: 185, z2: 200, z3: 215, z4: 230 },
    },
    {
      id: "p1-100",
      label: "1 pallet / 100 kg, 120 x 80 x 120 cm",
      quantity: 1,
      active: false,
      prices: { z1: 140, z2: 150, z3: 160, z4: 170 },
    },
    {
      id: "p1-100-tall",
      label: "1 pallet / 100 kg, 120 x 80 x 215 cm",
      quantity: 1,
      active: false,
      prices: { z1: 215, z2: 235, z3: 260, z4: 265 },
    },
    {
      id: "p2",
      label: "2 pallets / 200 kg in total, 120 x 80 x 150 cm per pallet",
      quantity: 2,
      active: true,
      prices: { z1: 300, z2: 310, z3: 330, z4: 345 },
    },
  ],
}

export const INITIAL_RATE_TABLES: RateTable[] = [
  skyLogAustria,
  skyLogGermany,
  fixedRate("pallet", "hu", 50),
  fixedRate("carton", "hu", 50),
  fixedRate("carton", "at", 50),
  fixedRate("carton", "de", 50),
]
