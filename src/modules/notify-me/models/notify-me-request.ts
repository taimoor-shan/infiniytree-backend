import { model } from "@medusajs/framework/utils"

/**
 * One visitor's "notify me when available" signup.
 *
 * The same email signing up for the same product and variant twice is one
 * signup (`createNotifyMeRequestStep`). `variant_id` is empty when the signup is
 * for the product as a whole, which is how a product whose options cannot be
 * chosen yet (no price, nothing in stock) takes signups.
 *
 * The titles are copied from the product at signup time, so the admin list
 * still reads right after a product is renamed or deleted.
 */
const NotifyMeRequest = model.define("notify_me_request", {
  id: model.id({ prefix: "nmr" }).primaryKey(),
  email: model.text(),
  product_id: model.text(),
  variant_id: model.text().nullable(),
  product_title: model.text().nullable(),
  variant_title: model.text().nullable(),
  // The storefront page the visitor signed up on (market and language included).
  product_url: model.text().nullable(),
})

export default NotifyMeRequest
