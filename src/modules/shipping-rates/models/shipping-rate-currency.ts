import { model } from "@medusajs/framework/utils"

/**
 * How many units of a currency make one euro, for a cart that is not in
 * euro. Delivery rates are kept in euro, so a Hungarian cart pays
 * `euro amount x rate` forints.
 */
const ShippingRateCurrency = model
  .define("shipping_rate_currency", {
    id: model.id({ prefix: "src" }).primaryKey(),
    // Lower-case, like Medusa's currency codes.
    currency_code: model.text(),
    rate: model.float(),
  })
  .indexes([
    {
      on: ["currency_code"],
      unique: true,
      where: "deleted_at IS NULL",
    },
  ])

export default ShippingRateCurrency
