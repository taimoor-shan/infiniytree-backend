import { Modules } from "@medusajs/framework/utils"

interface PasswordResetEventData {
  entity_id: string
  actor_type: string
  token: string
  metadata?: Record<string, unknown>
}

export default async function passwordResetHandler({
  event,
  container,
}: {
  event: { name: string; data: PasswordResetEventData }
  container: any
}) {
  const logger = container.resolve("logger") as any
  const notificationService = container.resolve(Modules.NOTIFICATION) as any

  try {
    await notificationService.createNotifications({
      to: event.data.entity_id,
      channel: "email",
      template: "password-reset",
      data: {
        token: event.data.token,
        entity_id: event.data.entity_id,
        actor_type: event.data.actor_type,
      },
      trigger_type: "auth.password_reset",
    })
  } catch (error: any) {
    logger.error(
      `Failed to send password reset email to ${event.data.entity_id}: ${error.message}`
    )
  }
}

export const config = {
  event: "auth.password_reset",
}
