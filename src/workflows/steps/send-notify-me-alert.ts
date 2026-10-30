import { createStep, StepResponse } from "@medusajs/framework/workflows-sdk"
import { ContainerRegistrationKeys } from "@medusajs/framework/utils"
import { Resend } from "resend"
import type { CreateNotifyMeRequestStepOutput } from "./create-notify-me-request"

/**
 * Emails the shop that someone signed up. The signup is already saved and
 * listed in the admin by then, so this is a courtesy: a missing key or a
 * failed send is logged and never fails the visitor's request.
 */
export const sendNotifyMeAlertStep = createStep(
  "send-notify-me-alert",
  async (input: CreateNotifyMeRequestStepOutput, { container }) => {
    // A repeat signup from the same person is not news.
    if (!input.created) {
      return new StepResponse(null)
    }

    const logger = container.resolve(ContainerRegistrationKeys.LOGGER)
    const apiKey = process.env.RESEND_API_KEY || process.env.SENDGRID_API_KEY

    if (!apiKey) {
      logger.warn(
        "[notify-me] No email key is set: the signup is saved but the shop was not emailed"
      )
      return new StepResponse(null)
    }

    const { request } = input
    const what = `${request.product_title || request.product_id}${
      request.variant_title ? ` — ${request.variant_title}` : ""
    }`

    const text = [
      "Restock Notification Request",
      "============================",
      "",
      `Product: ${what}`,
      request.variant_id ? `Variant ID: ${request.variant_id}` : "",
      request.product_url ? `URL: ${request.product_url}` : "",
      "",
      `Customer: ${request.email}`,
      `Date: ${new Date(request.created_at).toISOString()}`,
    ].join("\n")

    try {
      const { error } = await new Resend(apiKey).emails.send({
        from:
          process.env.RESEND_FROM ||
          process.env.SENDGRID_FROM ||
          "onboarding@resend.dev",
        to: process.env.CONTACT_EMAIL || "info@infinytree.com",
        subject: `Restock request: ${what}`,
        replyTo: request.email,
        text,
      })

      if (error) {
        logger.warn(`[notify-me] Alert email was refused: ${error.message}`)
      }
    } catch (err) {
      logger.warn(
        `[notify-me] Alert email failed: ${
          err instanceof Error ? err.message : String(err)
        }`
      )
    }

    return new StepResponse(null)
  }
)
