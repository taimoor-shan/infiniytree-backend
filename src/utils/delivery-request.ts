/**
 * The shop's email about a delivery quote request. Pure, so it is unit tested
 * (`src/utils/__tests__/delivery-request.unit.spec.ts`).
 */

export type DeliveryRequestEmailInput = {
  id: string
  email: string
  first_name: string | null
  last_name: string | null
  company: string | null
  vat_number: string | null
  phone: string | null
  address_1: string | null
  address_2: string | null
  postal_code: string | null
  city: string | null
  province: string | null
  country_code: string
  message: string | null
  locale: string | null
  currency_code: string | null
  item_subtotal: number | null
  items:
    | {
        title: string
        variant_title: string | null
        sku: string | null
        quantity: number
        unit_price: number
      }[]
    | null
  created_at: Date | string
}

/** "Greece" for "gr"; the code itself when the runtime has no name for it. */
export const countryName = (code: string): string => {
  const upper = (code || "").toUpperCase()
  try {
    const name = new Intl.DisplayNames(["en"], { type: "region" }).of(upper)
    return name && name !== upper ? name : upper
  } catch {
    return upper
  }
}

export const formatMoney = (
  amount: number | null | undefined,
  currency: string | null | undefined
): string => {
  if (amount == null || !Number.isFinite(Number(amount))) {
    return ""
  }
  if (!currency) {
    return String(amount)
  }
  try {
    return new Intl.NumberFormat("en-GB", {
      style: "currency",
      currency: currency.toUpperCase(),
    }).format(Number(amount))
  } catch {
    return `${amount} ${currency.toUpperCase()}`
  }
}

export const deliveryRequestEmailText = (
  request: DeliveryRequestEmailInput,
  updated = false
): { subject: string; text: string } => {
  const country = countryName(request.country_code)
  const name = [request.first_name, request.last_name].filter(Boolean).join(" ")
  const who = request.company || name || request.email

  const items = (request.items ?? []).map((item) => {
    const what = item.variant_title
      ? `${item.title} (${item.variant_title})`
      : item.title
    const price = formatMoney(item.unit_price, request.currency_code)
    return `- ${item.quantity} × ${what}${item.sku ? ` [${item.sku}]` : ""}${
      price ? ` — ${price} each` : ""
    }`
  })

  const address = [
    request.company,
    name,
    request.address_1,
    request.address_2,
    [request.postal_code, request.city].filter(Boolean).join(" "),
    request.province,
    country,
  ].filter(Boolean)

  const text = [
    updated ? "Delivery quote request (updated)" : "Delivery quote request",
    "========================",
    "",
    `A customer would like a delivery to ${country}, which the checkout does not deliver to yet.`,
    "Nothing was ordered or paid. Please send them a delivery quote; replying to this email answers the customer.",
    "",
    "Products",
    ...items,
    request.item_subtotal != null
      ? `Products subtotal (net, without delivery): ${formatMoney(
          request.item_subtotal,
          request.currency_code
        )}`
      : "",
    "",
    "Deliver to",
    ...address,
    "",
    "Contact",
    `Email: ${request.email}`,
    request.phone ? `Phone: ${request.phone}` : "",
    request.vat_number ? `VAT number: ${request.vat_number}` : "",
    request.locale ? `Language: ${request.locale}` : "",
    "",
    request.message ? `Message:\n${request.message}\n` : "",
    `Request: ${request.id} (Admin → Delivery requests)`,
    `Date: ${new Date(request.created_at).toISOString()}`,
  ]
    .filter((line, i, all) => !(line === "" && all[i - 1] === ""))
    .join("\n")

  return {
    subject: `${updated ? "Updated delivery" : "Delivery"} quote request: ${country} — ${who}`,
    text,
  }
}
