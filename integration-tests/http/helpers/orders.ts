import {
  ContainerRegistrationKeys,
  Modules,
} from "@medusajs/framework/utils"
import { MedusaContainer } from "@medusajs/framework/types"
import { markPaymentCollectionAsPaid } from "@medusajs/medusa/core-flows"

// 2 x 100 EUR, 20 EUR discount, 27% VAT, 10 EUR shipping:
// items' net value 180, item tax 48.60, shipping 12.70, total 241.30
export const ORDER_TOTAL = 241.3

/** An order created straight in the order module, as checkout would leave it. */
export const createOrder = async (
  container: MedusaContainer,
  customer: { id: string; email: string }
) => {
  const orderModule = container.resolve(Modules.ORDER)

  const [order] = await orderModule.createOrders([
    {
      currency_code: "eur",
      customer_id: customer.id,
      email: customer.email,
      items: [
        {
          title: "Olive tree 120 cm",
          quantity: 2,
          unit_price: 100,
          tax_lines: [{ code: "HU27", rate: 27 }],
          adjustments: [{ code: "SPRING20", amount: 20 }],
        },
      ],
      shipping_methods: [
        {
          name: "Standard",
          amount: 10,
          tax_lines: [{ code: "HU27", rate: 27 }],
        },
      ],
    },
  ])

  return order
}

/** A not-yet-paid payment collection linked to the order. */
export const createPaymentCollection = async (
  container: MedusaContainer,
  orderId: string
) => {
  const paymentModule = container.resolve(Modules.PAYMENT)
  const link = container.resolve(ContainerRegistrationKeys.LINK)

  const collection = await paymentModule.createPaymentCollections({
    currency_code: "eur",
    amount: ORDER_TOTAL,
  })
  await link.create({
    [Modules.ORDER]: { order_id: orderId },
    [Modules.PAYMENT]: { payment_collection_id: collection.id },
  })

  return collection
}

/** Bank transfer received: same capture path Make.com and the admin use. */
export const markOrderPaid = async (
  container: MedusaContainer,
  orderId: string
) => {
  const collection = await createPaymentCollection(container, orderId)
  const { result: payment } = await markPaymentCollectionAsPaid(container).run({
    input: { order_id: orderId, payment_collection_id: collection.id },
  })

  return payment
}

export const waitFor = async <T>(
  check: () => Promise<T | undefined | null | false>,
  { timeout = 10000, interval = 200 } = {}
): Promise<T> => {
  const deadline = Date.now() + timeout
  for (;;) {
    const value = await check()
    if (value) {
      return value
    }
    if (Date.now() > deadline) {
      throw new Error("waitFor timed out")
    }
    await new Promise((resolve) => setTimeout(resolve, interval))
  }
}
