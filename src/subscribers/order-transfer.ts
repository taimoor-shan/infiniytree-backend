import { Modules } from "@medusajs/framework/utils"
import { IOrderModuleService } from "@medusajs/framework/types"

interface OrderTransferEventData {
  id: string
  order_change_id: string
}

export default async function orderTransferHandler({
  event,
  container,
}: {
  event: { name: string; data: OrderTransferEventData }
  container: any
}) {
  const logger = container.resolve("logger") as any
  const notificationService = container.resolve(Modules.NOTIFICATION) as any
  const orderModule: IOrderModuleService = container.resolve(Modules.ORDER)
  const query = container.resolve("query") as any

  try {
    // Fetch order change to get the token and target customer email
    const { data: orderChanges } = await query.graph({
      entity: "order_change",
      fields: ["id", "actions.*"],
      filters: { id: event.data.order_change_id },
    })

    const change = orderChanges?.[0]
    const transferAction = change?.actions?.find(
      (a: any) => a.action === "TRANSFER_CUSTOMER"
    )

    if (!transferAction?.details?.token) {
      logger.error(
        `No transfer token found for order change ${event.data.order_change_id}`
      )
      return
    }

    // Fetch order to get customer info
    const order = await orderModule.retrieveOrder(event.data.id)

    // If new_email is specified, send to that address; otherwise send to the current order email
    const recipientEmail =
      transferAction.details.new_email || order.email

    await notificationService.createNotifications({
      to: recipientEmail,
      channel: "email",
      template: "order-transfer",
      data: {
        order_id: order.id,
        token: transferAction.details.token,
        original_email: transferAction.details.original_email,
        locale: (order as any)?.locale || "en",
      },
      trigger_type: "order.transfer_requested",
      resource_id: order.id,
      resource_type: "order",
    })
  } catch (error: any) {
    logger.error(
      `Failed to send order transfer notification: ${error.message}`
    )
  }
}

export const config = {
  event: "order.transfer_requested",
}
