/**
 * What the store's cart and order routes may say about the customer behind a
 * cart or order: their id and email, nothing else.
 *
 * Medusa ties a signed-out visitor's cart to the registered customer whose
 * email they type (`findOrCreateCustomerStep`), which is how a returning
 * customer's order lands in their account without a sign-in. The visitor has
 * proved nothing, yet Medusa's store routes let any caller expand `customer.*`
 * and `customer.addresses` on a cart, and anything on an order, through the
 * `fields` query parameter: a stranger who typed someone's email would read
 * their name, phone, company, VAT number and saved addresses. The storefront
 * reads the signed-in customer from `/store/customers/me` and never needs
 * more than this from a cart or an order.
 */

type Entity = Record<string, unknown>

const isObject = (value: unknown): value is Entity =>
  typeof value === "object" && value !== null && !Array.isArray(value)

const withoutDetails = (entity: unknown): unknown => {
  if (!isObject(entity) || !isObject(entity.customer)) {
    return entity
  }
  const { id, email } = entity.customer
  return { ...entity, customer: { id, email } }
}

/** A store response body with every cart's and order's customer cut down. */
export const withoutCustomerDetails = <T>(body: T): T => {
  if (!isObject(body)) {
    return body
  }

  const out: Entity = { ...body }
  if ("cart" in out) out.cart = withoutDetails(out.cart)
  if ("order" in out) out.order = withoutDetails(out.order)
  if (Array.isArray(out.orders)) out.orders = out.orders.map(withoutDetails)
  return out as T
}
