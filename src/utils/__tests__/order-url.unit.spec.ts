import { Modules } from "@medusajs/framework/utils"
import { buildOrderAccessUrl, orderHasAccount } from "../order-url"

const SHOP = "https://infinytree.com"
const TOKEN = "b5d619cb-3e84-4e16-aaed-74437c78257e"
const ACCOUNT_PATH = "account/orders/details/order_01M5FCKQ0QXB06W73VX9XNANJW"

// Order 77 of the dev shop: a customer with an account, shipping to Hungary, no language chosen
const registered = {
  id: "order_01M5FCKQ0QXB06W73VX9XNANJW",
  display_id: 77,
  metadata: { order_access_token: TOKEN },
  has_account: true,
  shipping_address: { country_code: "hu" },
}

describe("buildOrderAccessUrl for a customer with an account", () => {
  it("opens the order in their account, in the order's market", () => {
    expect(buildOrderAccessUrl(registered, SHOP)).toBe(
      "https://infinytree.com/en-hu/account/orders/details/order_01M5FCKQ0QXB06W73VX9XNANJW"
    )
  })

  it("does not put the guest access token in the link", () => {
    expect(buildOrderAccessUrl(registered, SHOP)).not.toContain(TOKEN)
  })

  it.each<[string | null, string, string]>([
    ["de-AT", "at", "de-at"],
    ["de-DE", "de", "de-de"],
    ["de-DE", "hu", "de-hu"],
    ["en", "at", "en-at"],
    // Hungarian has no storefront pages: the country's usual language instead
    ["hu-HU", "hu", "en-hu"],
    ["hu-HU", "at", "de-at"],
    // No language is English, like the order's emails
    [null, "de", "en-de"],
    ["", "at", "en-at"],
  ])("opens an order in %p shipped to %s in the %s market", (locale, country, market) => {
    const order = { ...registered, locale, shipping_address: { country_code: country } }

    expect(buildOrderAccessUrl(order, SHOP)).toBe(`${SHOP}/${market}/${ACCOUNT_PATH}`)
  })

  it("leaves the market out when the order has no shipping country, for the storefront to pick", () => {
    expect(buildOrderAccessUrl({ ...registered, shipping_address: undefined }, SHOP)).toBe(
      `${SHOP}/${ACCOUNT_PATH}`
    )
  })
})

describe("buildOrderAccessUrl for a guest", () => {
  const guest = {
    id: "order_01M4GAX5MGK7GC78YP9ABN9P4J",
    display_id: 74,
    metadata: { order_access_token: "tok_74" },
    has_account: false,
    shipping_address: { country_code: "hu" },
  }

  it("opens the guest page with the order's access token", () => {
    expect(buildOrderAccessUrl(guest, SHOP)).toBe("https://infinytree.com/order/guest/74?token=tok_74")
  })

  it("escapes the token", () => {
    const order = { ...guest, metadata: { order_access_token: "a b/c" } }

    expect(buildOrderAccessUrl(order, SHOP)).toBe("https://infinytree.com/order/guest/74?token=a%20b%2Fc")
  })

  it("is a guest unless the order says its customer has an account", () => {
    const { has_account, ...unsaid } = guest

    expect(buildOrderAccessUrl(unsaid, SHOP)).toBe("https://infinytree.com/order/guest/74?token=tok_74")
  })

  it("has no link before the order has a token", () => {
    expect(buildOrderAccessUrl({ ...guest, metadata: {} }, SHOP)).toBe("")
  })
})

describe("orderHasAccount", () => {
  const check = async (
    customerId: string | null | undefined,
    customers: Record<string, { has_account: boolean }> = {}
  ) => {
    const asked: string[] = []
    const warnings: string[] = []
    const services: Record<string, unknown> = {
      [Modules.CUSTOMER]: {
        retrieveCustomer: async (id: string) => {
          asked.push(id)
          if (!customers[id]) {
            throw new Error(`Customer with id: ${id} was not found`)
          }
          return { id, ...customers[id] }
        },
      },
      logger: { warn: (message: string) => warnings.push(message) },
    }
    const container = { resolve: (key: string) => services[key] }

    return { result: await orderHasAccount(container, { customer_id: customerId }), asked, warnings }
  }

  it("is true for a customer who signed up", async () => {
    const { result } = await check("cus_1", { cus_1: { has_account: true } })

    expect(result).toBe(true)
  })

  it("is false for the customer a guest checkout creates", async () => {
    const { result } = await check("cus_2", { cus_2: { has_account: false } })

    expect(result).toBe(false)
  })

  it("is false, without asking anyone, for an order with no customer", async () => {
    const { result, asked } = await check(null)

    expect(result).toBe(false)
    expect(asked).toEqual([])
  })

  it("is false, with a warning, when the customer cannot be loaded, so the email still goes out", async () => {
    const { result, warnings } = await check("cus_gone")

    expect(result).toBe(false)
    expect(warnings).toHaveLength(1)
  })
})
