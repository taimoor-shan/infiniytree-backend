import { model } from "@medusajs/framework/utils"

/**
 * A consumer's declaration of withdrawal from a contract, sent with the
 * storefront's "Withdraw from contract" function (EU Directive 2023/2673,
 * Art. 11a of the Consumer Rights Directive: an online withdrawal function,
 * in force since 19 June 2026, and the Hungarian rules from 27 September 2026).
 *
 * Every declaration is kept as it was sent, even when the order number and
 * email do not match an order (`order_id` is then null): the law counts the
 * declaration, not our lookup, so the shop decides by hand. `created_at` is
 * the moment of receipt that the confirmation email states.
 */
const WithdrawalRequest = model.define("withdrawal_request", {
  id: model.id({ prefix: "wdr" }).primaryKey(),
  // new: nobody has dealt with it yet; handled: the shop has answered.
  status: model.enum(["new", "handled"]).default("new"),
  name: model.text(),
  email: model.text(),
  // The order number as the customer typed it (the display id, e.g. "1042").
  order_number: model.text(),
  // Set when the number and email match an order, for the admin's link.
  order_id: model.text().nullable(),
  order_display_id: model.number().nullable(),
  // Which products, in the customer's words; empty means the whole order.
  items: model.text().nullable(),
  message: model.text().nullable(),
  // The storefront language, so the confirmation and the answer use it.
  locale: model.text().nullable(),
})

export default WithdrawalRequest
