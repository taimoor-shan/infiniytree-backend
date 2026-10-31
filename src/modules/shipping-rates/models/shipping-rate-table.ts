import { model } from "@medusajs/framework/utils"

/**
 * The delivery rates for one shipping class in one country: a carrier's
 * tariff sheet, with postcode zones as columns and shipment sizes as rows.
 *
 * `zones` and `tiers` are JSON because they are always read and saved as a
 * whole, the way the admin shows them; their shape is `RateZone[]` and
 * `RateTier[]` in `lib/rates.ts`, which also prices a delivery from them.
 *
 * `shipping_class` is the id of a fulfillment option of the `tariff` provider
 * (`pallet`, `carton`): a shipping option with that option picks this table.
 */
const ShippingRateTable = model
  .define("shipping_rate_table", {
    id: model.id({ prefix: "srt" }).primaryKey(),
    shipping_class: model.text(),
    // Lower-case ISO 3166-1 alpha-2, like Medusa's country codes.
    country_code: model.text(),
    zones: model.json(),
    tiers: model.json(),
  })
  .indexes([
    {
      on: ["shipping_class", "country_code"],
      unique: true,
      where: "deleted_at IS NULL",
    },
  ])

export default ShippingRateTable
