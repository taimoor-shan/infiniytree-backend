import { model } from "@medusajs/framework/utils"

/**
 * A customer's request for a delivery quote to a country the shop has no
 * delivery prices for yet (anywhere in Europe outside the countries of the
 * store's regions).
 *
 * The checkout offers these countries under "Delivery on request": instead of
 * paying, the customer sends their cart, address and contact details, and a
 * representative answers by hand with a price. Nothing is ordered or charged.
 *
 * `items` is a copy of the cart's lines at the time of the request (title,
 * variant, quantity, unit price), so the request still reads right after the
 * cart changes or the product is renamed.
 */
const DeliveryRequest = model.define("delivery_request", {
  id: model.id({ prefix: "dreq" }).primaryKey(),
  // new: nobody has answered yet; handled: a representative has replied.
  status: model.enum(["new", "handled"]).default("new"),
  // A request needs a way to answer it: an email or a phone, at least one.
  email: model.text().nullable(),
  first_name: model.text().nullable(),
  last_name: model.text().nullable(),
  company: model.text().nullable(),
  vat_number: model.text().nullable(),
  phone: model.text().nullable(),
  address_1: model.text().nullable(),
  address_2: model.text().nullable(),
  postal_code: model.text().nullable(),
  city: model.text().nullable(),
  province: model.text().nullable(),
  country_code: model.text(),
  message: model.text().nullable(),
  // The storefront language the customer used, to answer in it.
  locale: model.text().nullable(),
  cart_id: model.text().nullable(),
  currency_code: model.text().nullable(),
  // Net of VAT and without delivery, in the cart's currency.
  item_subtotal: model.float().nullable(),
  items: model.json().nullable(),
  // The sales rep's client link the customer followed (the storefront's
  // `_sales_rep_ref` cookie) and the rep's name when it was sent. Nothing is
  // linked: a quote is not an account, so the owner assigns the client to the
  // rep when the quote becomes an order.
  sales_rep_ref: model.text().nullable(),
  sales_rep_name: model.text().nullable(),
})

export default DeliveryRequest
