import { Modules } from "@medusajs/framework/utils"

export default async function customerCreatedHandler({
  event,
  container,
}: {
  event: { name: string; data: { id: string } }
  container: any
}) {
  const logger = container.resolve("logger") as any
  const notificationService = container.resolve(Modules.NOTIFICATION) as any
  const customerModule = container.resolve(Modules.CUSTOMER) as any

  try {
    const customer = await customerModule.retrieveCustomer(event.data.id)

    await notificationService.createNotifications({
      to: customer.email,
      channel: "email",
      template: "welcome",
      data: {
        first_name: customer.first_name,
        email: customer.email,
        locale: (customer as any)?.metadata?.locale || "en",
      },
      trigger_type: "customer.created",
      resource_id: customer.id,
      resource_type: "customer",
      receiver_id: customer.id,
    })
  } catch (error: any) {
    logger.error(
      `Failed to send welcome email for customer ${event.data.id}: ${error.message}`
    )
  }
}

export const config = {
  event: "customer.created",
}
