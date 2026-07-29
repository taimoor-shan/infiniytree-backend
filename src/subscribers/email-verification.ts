import { Modules } from "@medusajs/framework/utils"

interface VerificationEventData {
  entity_id: string
  actor_type: string
  provider: string
  auth_identity_id: string
  provider_identity_id: string
  code: string
  expires_at: string
  metadata?: Record<string, unknown>
}

export default async function emailVerificationHandler({
  event,
  container,
}: {
  event: { name: string; data: VerificationEventData }
  container: any
}) {
  const logger = container.resolve("logger") as any
  const notificationService = container.resolve(Modules.NOTIFICATION) as any

  try {
    await notificationService.createNotifications({
      to: event.data.entity_id,
      channel: "email",
      template: "email-verification",
      data: {
        code: event.data.code,
        entity_id: event.data.entity_id,
        expires_at: event.data.expires_at,
      },
      trigger_type: "auth.verification_requested",
    })
  } catch (error: any) {
    logger.error(
      `Failed to send verification email to ${event.data.entity_id}: ${error.message}`
    )
  }
}

export const config = {
  event: "auth.verification_requested",
}
