import { createStep, StepResponse } from "@medusajs/framework/workflows-sdk"
import { ContainerRegistrationKeys } from "@medusajs/framework/utils"
import { Resend } from "resend"
import type { CreateDeliveryRequestStepOutput } from "./create-delivery-request"
import { deliveryRequestEmailText } from "../../utils/delivery-request"

/**
 * Emails the shop about a delivery quote request, with the customer as the
 * reply-to address so a representative can answer straight from the inbox.
 * The request is already saved and listed in the admin by then, so this is a
 * courtesy: a missing key or a failed send is logged and never fails the
 * customer's request.
 */
export const sendDeliveryRequestAlertStep = createStep(
  "send-delivery-request-alert",
  async (input: CreateDeliveryRequestStepOutput, { container }) => {
    const logger = container.resolve(ContainerRegistrationKeys.LOGGER)
    const apiKey = process.env.RESEND_API_KEY || process.env.SENDGRID_API_KEY

    if (!apiKey) {
      logger.warn(
        "[delivery-request] No email key is set: the request is saved but the shop was not emailed"
      )
      return new StepResponse(null)
    }

    const { subject, text } = deliveryRequestEmailText(
      input.request,
      !input.created
    )

    try {
      const { error } = await new Resend(apiKey).emails.send({
        from:
          process.env.RESEND_FROM ||
          process.env.SENDGRID_FROM ||
          "onboarding@resend.dev",
        to: process.env.CONTACT_EMAIL || "info@infinytree.com",
        subject,
        replyTo: input.request.email,
        text,
      })

      if (error) {
        logger.warn(
          `[delivery-request] Alert email was refused: ${error.message}`
        )
      }
    } catch (err) {
      logger.warn(
        `[delivery-request] Alert email failed: ${
          err instanceof Error ? err.message : String(err)
        }`
      )
    }

    return new StepResponse(null)
  }
)
