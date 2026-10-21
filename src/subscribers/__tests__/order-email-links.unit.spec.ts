import { ContainerRegistrationKeys, Modules } from "@medusajs/framework/utils"
import deliveryCreated from "../delivery-created"
import fulfillmentCreated from "../fulfillment-created"
import orderPlaced from "../order-placed"
import shippingUpdate from "../shipping-update"

type Row = Record<string, any>

const ORDERS: Record<string, Row> = {
  // Anna signed up at checkout: German-speaking, shipping to Austria
  order_REG: {
    id: "order_REG",
    display_id: 77,
    email: "anna@example.com",
    customer_id: "cus_REG",
    locale: "de-AT",
    currency_code: "eur",
    metadata: { order_access_token: "tok_REG" },
  },
  // A guest checkout: no language chosen, shipping to Hungary
  order_GUEST: {
    id: "order_GUEST",
    display_id: 74,
    email: "gus@example.com",
    customer_id: "cus_GUEST",
    locale: null,
    currency_code: "huf",
    metadata: { order_access_token: "tok_GUEST" },
  },
}
const ADDRESSES: Record<string, Row> = {
  order_REG: { first_name: "Anna", last_name: "Muster", country_code: "at" },
  order_GUEST: { first_name: "Gus", last_name: "Guest", country_code: "hu" },
}
const CUSTOMERS: Record<string, Row> = {
  cus_REG: { id: "cus_REG", has_account: true },
  cus_GUEST: { id: "cus_GUEST", has_account: false },
}
const FULFILLMENT_OF: Record<string, string> = { order_REG: "ful_REG", order_GUEST: "ful_GUEST" }
const ORDER_OF: Record<string, string> = { ful_REG: "order_REG", ful_GUEST: "order_GUEST" }

/**
 * A container whose services answer like the real ones: an order carries its
 * address or items only when they are asked for as relations.
 */
const run = async (handler: (args: any) => Promise<void>, event: Row) => {
  const sent: Row[] = []
  const errors: string[] = []
  const noop = () => undefined
  const services: Record<string, unknown> = {
    logger: { info: noop, warn: noop, error: (message: string) => errors.push(message) },
    [Modules.ORDER]: {
      retrieveOrder: async (id: string, config: { relations?: string[] } = {}) => {
        const order: Row = { ...ORDERS[id] }
        if (config.relations?.includes("shipping_address")) order.shipping_address = ADDRESSES[id]
        if (config.relations?.includes("items")) {
          order.items = [{ title: "Olive tree", quantity: 1, unit_price: 120 }]
        }
        return order
      },
      updateOrders: async () => ({}),
    },
    [Modules.CUSTOMER]: {
      retrieveCustomer: async (id: string) => {
        if (!CUSTOMERS[id]) throw new Error(`Customer with id: ${id} was not found`)
        return CUSTOMERS[id]
      },
    },
    [Modules.NOTIFICATION]: {
      createNotifications: async (notification: Row) => {
        sent.push(notification)
      },
    },
    [Modules.FULFILLMENT]: {
      retrieveFulfillment: async (id: string) => ({ id, labels: [] }),
    },
    [ContainerRegistrationKeys.QUERY]: {
      graph: async ({ filters }: { filters: { fulfillment_id: string } }) => ({
        data: [{ order_id: ORDER_OF[filters.fulfillment_id] }],
      }),
    },
  }

  await handler({ event, container: { resolve: (key: string) => services[key] } })

  return { sent, errors }
}

const EMAILS: [string, (args: any) => Promise<void>, (orderId: string) => Row][] = [
  ["order confirmation", orderPlaced, (id) => ({ name: "order.placed", data: { id } })],
  [
    "in-progress",
    fulfillmentCreated,
    (id) => ({ name: "order.fulfillment_created", data: { order_id: id, fulfillment_id: "ful_1" } }),
  ],
  ["shipped", shippingUpdate, (id) => ({ name: "shipment.created", data: { id: FULFILLMENT_OF[id] } })],
  ["delivered", deliveryCreated, (id) => ({ name: "delivery.created", data: { id: FULFILLMENT_OF[id] } })],
]

describe.each(EMAILS)("the %s email's order button", (_name, handler, eventFor) => {
  const saved = { ...process.env }

  beforeEach(() => {
    process.env.STOREFRONT_PUBLIC_URL = "https://infinytree.com"
  })

  afterEach(() => {
    process.env = { ...saved }
  })

  it("opens the order in the customer's account, in their language and country", async () => {
    const { sent, errors } = await run(handler, eventFor("order_REG"))

    expect(errors).toEqual([])
    expect(sent[0].data.order_url).toBe("https://infinytree.com/de-at/account/orders/details/order_REG")
  })

  it("keeps a guest on the guest page", async () => {
    const { sent, errors } = await run(handler, eventFor("order_GUEST"))

    expect(errors).toEqual([])
    expect(sent[0].data.order_url).toMatch(/^https:\/\/infinytree\.com\/order\/guest\/74\?token=\S+$/)
  })
})
