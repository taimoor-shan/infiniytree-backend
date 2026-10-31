/**
 * Delivery rates by shipping class, country and postcode zone.
 *
 * A rate table is what a carrier's tariff sheet is: columns are zones (named
 * by the postcodes they cover), rows say how many units a shipment of that
 * size costs, and each cell is a price in euro. Everything here is plain
 * functions on plain data, so the checkout (`tariff-fulfillment`), the admin's
 * "try it" calculator and the tests all price a delivery the same way.
 *
 * The same shape holds a fixed charge: a table with one zone that is the
 * fallback and one row of "1 unit" is a price per unit, whatever the quantity.
 */

export type RateZone = {
  /** Key the rows' prices point at. It stays put when the zone is renamed. */
  id: string
  name: string
  /**
   * The postcodes this zone covers, as prefixes and ranges: `8, 90, 1000-1999`.
   * A prefix matches every postcode that starts with it; a range compares the
   * postcode's first digits (as many as the range has). Commas, semicolons
   * and spaces all separate. The longest match wins, so `90` beats `9`.
   */
  postcodes: string
  /**
   * Takes the postcodes no zone claims, and a delivery whose postcode is not
   * known yet. At most one zone.
   */
  is_fallback: boolean
}

export type RateTier = {
  id: string
  /** The carrier's name for the row, e.g. "1 pallet / 50 kg, 120 x 80 x 170 cm". Informational. */
  label: string
  /** How many units (pallets, cartons) this row's price covers. */
  quantity: number
  /** A row that is off stays on file but is never used. */
  active: boolean
  /** Price in euro by zone id. A zone with no price is not served by this row. */
  prices: Record<string, number | null>
}

export type RateTable = {
  shipping_class: string
  country_code: string
  zones: RateZone[]
  tiers: RateTier[]
}

export type RateBreakdownLine = {
  tier_id: string
  label: string
  quantity: number
  price: number
  /** How many times this row is bought to cover the order. */
  times: number
}

export type RateQuote = {
  zone: RateZone
  /** The postcode matched a zone's list, or fell to the fallback zone. */
  zone_match: "postcode" | "fallback"
  /** Euro, rounded to cents. */
  amount: number
  breakdown: RateBreakdownLine[]
}

export type RateLookupFailure =
  | "no_table"
  | "no_zone"
  | "no_price"
  | "invalid_units"
  | "no_currency"

/** Thrown when a delivery cannot be priced; `code` says why. */
export class RateLookupError extends Error {
  code: RateLookupFailure

  constructor(code: RateLookupFailure, message: string) {
    super(message)
    this.name = "RateLookupError"
    this.code = code
  }
}

/** More units than any real order has; stops a runaway quantity from looping. */
export const MAX_UNITS = 5000

const SLUG = /^[a-z][a-z0-9_-]{0,39}$/
const COUNTRY = /^[a-z]{2}$/

const roundCents = (value: number) => Math.round(value * 100) / 100

/** Postcodes compare without spaces or dashes and in capitals: `1 010` is `1010`. */
export const normalizePostcode = (postcode?: string | null): string =>
  (postcode ?? "").replace(/[\s-]/g, "").toUpperCase()

type PostcodeRule =
  | { kind: "prefix"; prefix: string }
  | { kind: "range"; from: number; to: number; length: number }

type ParsedRules = { rules: PostcodeRule[]; invalid: string[] }

/** Reads a zone's postcode list. Entries that make no sense come back in `invalid`. */
export const parsePostcodeRules = (postcodes: string): ParsedRules => {
  const rules: PostcodeRule[] = []
  const invalid: string[] = []

  const entries = (postcodes ?? "")
    .toUpperCase()
    .replace(/\s*-\s*/g, "-")
    .split(/[\s,;]+/)
    .filter(Boolean)

  for (const entry of entries) {
    const range = /^(\d+)-(\d+)$/.exec(entry)
    if (range) {
      const [, from, to] = range
      if (from.length !== to.length || Number(from) > Number(to)) {
        invalid.push(entry)
      } else {
        rules.push({
          kind: "range",
          from: Number(from),
          to: Number(to),
          length: from.length,
        })
      }
    } else if (/^[0-9A-Z]+$/.test(entry)) {
      rules.push({ kind: "prefix", prefix: entry })
    } else {
      invalid.push(entry)
    }
  }

  return { rules, invalid }
}

/** How many leading characters of `postcode` the rule matches; 0 for no match. */
const matchLength = (rule: PostcodeRule, postcode: string): number => {
  if (rule.kind === "prefix") {
    return postcode.startsWith(rule.prefix) ? rule.prefix.length : 0
  }
  const head = postcode.slice(0, rule.length)
  if (head.length !== rule.length || !/^\d+$/.test(head)) {
    return 0
  }
  const value = Number(head)
  return value >= rule.from && value <= rule.to ? rule.length : 0
}

/**
 * The zone a postcode belongs to: the one with the longest matching entry
 * (the earlier zone on a tie), else the fallback zone, else nothing.
 */
export const findZone = (
  zones: RateZone[],
  postcode?: string | null
): { zone: RateZone; match: "postcode" | "fallback" } | null => {
  const code = normalizePostcode(postcode)

  let best: RateZone | null = null
  let bestLength = 0
  if (code) {
    for (const zone of zones) {
      const { rules } = parsePostcodeRules(zone.postcodes)
      for (const rule of rules) {
        const length = matchLength(rule, code)
        if (length > bestLength) {
          best = zone
          bestLength = length
        }
      }
    }
  }
  if (best) {
    return { zone: best, match: "postcode" }
  }

  const fallback = zones.find((zone) => zone.is_fallback)
  return fallback ? { zone: fallback, match: "fallback" } : null
}

type Cover = { amount: number; breakdown: RateBreakdownLine[] }

/**
 * Prices `units` from the zone's rows that are on.
 *
 * A quantity with a row of its own costs what that row says, as the carrier's
 * sheet does: 2 pallets is the 2-pallet row, even where two 1-pallet rows
 * would add up to less (they are lighter pallets). A bigger quantity than any
 * row is built from the largest rows, then the remainder looked up in the
 * same way: with rows for 1 and 2 pallets, 3 pallets is the 2-pallet row plus
 * the 1-pallet row and 5 is two 2-pallet rows plus a 1-pallet row. Where
 * several rows are on for the same quantity (a lighter and a heavier pallet),
 * the cheapest is used. If the remainder is smaller than every row, the
 * smallest row is used.
 */
const coverUnits = (
  tiers: RateTier[],
  zoneId: string,
  units: number
): Cover | null => {
  // The cheapest row on for each quantity.
  const byQuantity = new Map<number, { tier: RateTier; price: number }>()
  for (const tier of tiers) {
    const price = tier.prices?.[zoneId]
    if (
      !tier.active ||
      !Number.isInteger(tier.quantity) ||
      tier.quantity < 1 ||
      typeof price !== "number"
    ) {
      continue
    }
    const held = byQuantity.get(tier.quantity)
    if (!held || price < held.price) {
      byQuantity.set(tier.quantity, { tier, price })
    }
  }
  if (!byQuantity.size) {
    return null
  }
  const quantities = [...byQuantity.keys()].sort((a, b) => a - b)

  const counts = new Map<number, number>()
  let remaining = units
  while (remaining > 0) {
    const fits = quantities.filter((quantity) => quantity <= remaining)
    const quantity = fits.length ? fits[fits.length - 1] : quantities[0]
    counts.set(quantity, (counts.get(quantity) ?? 0) + 1)
    remaining -= quantity
  }

  let amount = 0
  const breakdown: RateBreakdownLine[] = []
  for (const [quantity, times] of counts) {
    const { tier, price } = byQuantity.get(quantity)!
    amount += price * times
    breakdown.push({
      tier_id: tier.id,
      label: tier.label,
      quantity,
      price,
      times,
    })
  }

  return { amount: roundCents(amount), breakdown }
}

/** What a delivery of `units` to `postcode` costs from this table, in euro. */
export const quoteDelivery = (
  table: RateTable,
  { postcode, units }: { postcode?: string | null; units: number }
): RateQuote => {
  if (!Number.isInteger(units) || units < 1 || units > MAX_UNITS) {
    throw new RateLookupError(
      "invalid_units",
      `A delivery needs between 1 and ${MAX_UNITS} units, not ${units}.`
    )
  }

  const found = findZone(table.zones, postcode)
  if (!found) {
    throw new RateLookupError(
      "no_zone",
      `No zone of the ${table.shipping_class} rates for ${table.country_code.toUpperCase()} covers postcode "${postcode ?? ""}", and none is the fallback.`
    )
  }

  const cover = coverUnits(table.tiers, found.zone.id, units)
  if (!cover) {
    throw new RateLookupError(
      "no_price",
      `The ${table.shipping_class} rates for ${table.country_code.toUpperCase()} have no price for ${found.zone.name}.`
    )
  }

  return {
    zone: found.zone,
    zone_match: found.match,
    amount: cover.amount,
    breakdown: cover.breakdown,
  }
}

/**
 * A euro amount in the cart's currency. `rates` is units of a currency per
 * euro, keyed by lower-case currency code.
 */
export const convertFromEuro = (
  amount: number,
  currency: string,
  rates: Record<string, number>
): number => {
  const code = currency.toLowerCase()
  if (code === "eur") {
    return roundCents(amount)
  }
  const rate = rates[code]
  if (!(typeof rate === "number" && rate > 0)) {
    throw new RateLookupError(
      "no_currency",
      `Delivery rates are in euro and there is no exchange rate to ${code.toUpperCase()}.`
    )
  }
  return roundCents(amount * rate)
}

const isPlainObject = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null && !Array.isArray(value)

/**
 * Cleans a table that arrives from the admin: trims text, lower-cases the
 * class and country, turns prices into numbers (empty becomes none) and drops
 * prices for zones that no longer exist. Does not judge it; see `validateTable`.
 */
export const normalizeTable = (input: unknown): RateTable => {
  const raw = isPlainObject(input) ? input : {}
  const zones: RateZone[] = (Array.isArray(raw.zones) ? raw.zones : []).map(
    (zone: any) => ({
      id: String(zone?.id ?? "").trim(),
      name: String(zone?.name ?? "").trim(),
      postcodes: String(zone?.postcodes ?? "").trim(),
      is_fallback: zone?.is_fallback === true,
    })
  )
  const zoneIds = new Set(zones.map((zone) => zone.id))

  const tiers: RateTier[] = (Array.isArray(raw.tiers) ? raw.tiers : []).map(
    (tier: any) => {
      const prices: Record<string, number | null> = {}
      for (const [zoneId, value] of Object.entries(
        isPlainObject(tier?.prices) ? tier.prices : {}
      )) {
        if (!zoneIds.has(zoneId)) {
          continue
        }
        const price =
          value === null || value === "" || value === undefined
            ? null
            : Number(value)
        prices[zoneId] = price === null || Number.isNaN(price) ? null : price
      }
      return {
        id: String(tier?.id ?? "").trim(),
        label: String(tier?.label ?? "").trim(),
        quantity: Number(tier?.quantity),
        active: tier?.active !== false,
        prices,
      }
    }
  )

  return {
    shipping_class: String(raw.shipping_class ?? "").trim().toLowerCase(),
    country_code: String(raw.country_code ?? "").trim().toLowerCase(),
    zones,
    tiers,
  }
}

/**
 * What is wrong with a table, in words an admin can act on. An empty list
 * means it can be saved.
 */
export const validateTable = (table: RateTable): string[] => {
  const problems: string[] = []

  if (!SLUG.test(table.shipping_class)) {
    problems.push(
      "The shipping class is a short name in lower case letters, digits, - or _, such as pallet or carton."
    )
  }
  if (!COUNTRY.test(table.country_code)) {
    problems.push("The country is a two-letter code such as at, de or hu.")
  }

  if (!table.zones.length) {
    problems.push("Add at least one zone.")
  }
  const zoneIds = new Set<string>()
  const claimedBy = new Map<string, string>()
  for (const zone of table.zones) {
    const label = zone.name || "A zone"
    if (!zone.id || zoneIds.has(zone.id)) {
      problems.push(`${label} has a missing or repeated id.`)
    }
    zoneIds.add(zone.id)
    if (!zone.name) {
      problems.push("Every zone needs a name.")
    }

    const { rules, invalid } = parsePostcodeRules(zone.postcodes)
    if (invalid.length) {
      problems.push(
        `${label}: "${invalid.join('", "')}" is not a postcode start or a range such as 1000-1999.`
      )
    }
    for (const rule of rules) {
      const key =
        rule.kind === "prefix"
          ? rule.prefix
          : `${rule.from}-${rule.to}/${rule.length}`
      const owner = claimedBy.get(key)
      if (owner && owner !== zone.name) {
        problems.push(`${key} is listed in both ${owner} and ${label}.`)
      }
      claimedBy.set(key, zone.name)
    }
  }
  if (table.zones.filter((zone) => zone.is_fallback).length > 1) {
    problems.push("Only one zone can be the fallback.")
  }

  if (!table.tiers.length) {
    problems.push("Add at least one price row.")
  }
  const tierIds = new Set<string>()
  for (const tier of table.tiers) {
    const label = tier.label || `The row for ${tier.quantity}`
    if (!tier.id || tierIds.has(tier.id)) {
      problems.push(`${label} has a missing or repeated id.`)
    }
    tierIds.add(tier.id)
    if (!Number.isInteger(tier.quantity) || tier.quantity < 1) {
      problems.push(`${label}: the quantity is a whole number from 1.`)
    }
    for (const [zoneId, price] of Object.entries(tier.prices)) {
      if (price !== null && !(Number.isFinite(price) && price >= 0)) {
        problems.push(
          `${label}: the price for ${table.zones.find((z) => z.id === zoneId)?.name ?? zoneId} must be 0 or more.`
        )
      }
    }
  }

  for (const zone of table.zones) {
    const priced = table.tiers.some(
      (tier) =>
        tier.active &&
        Number.isInteger(tier.quantity) &&
        tier.quantity >= 1 &&
        typeof tier.prices[zone.id] === "number"
    )
    if (!priced) {
      problems.push(
        `${zone.name || "A zone"} has no price in any row that is switched on.`
      )
    }
  }

  return problems
}

/** Currency codes are three letters, kept in lower case like Medusa's. */
export const normalizeCurrencyCode = (code: unknown): string =>
  String(code ?? "").trim().toLowerCase()

export const isCurrencyCode = (code: string): boolean =>
  /^[a-z]{3}$/.test(code)
