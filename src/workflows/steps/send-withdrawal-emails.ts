import { createStep, StepResponse } from "@medusajs/framework/workflows-sdk"
import { ContainerRegistrationKeys } from "@medusajs/framework/utils"
import { Resend } from "resend"
import type { WithdrawalRequestRecord } from "./create-withdrawal-request"
import {
  withdrawalAlertEmail,
  withdrawalConfirmationEmail,
} from "../../utils/withdrawal"

/**
 * Sends the consumer's confirmation of receipt and the shop's alert. The
 * declaration is already saved (and shown in the admin), so a missing key or
 * a failed send is logged and never fails the customer: the storefront shows
 * the same confirmation on screen.
 */
export const sendWithdrawalEmailsStep = createStep(
  "send-withdrawal-emails",
  async (request: WithdrawalRequestRecord, { container }) => {
    const logger = container.resolve(ContainerRegistrationKeys.LOGGER)
    const apiKey = process.env.RESEND_API_KEY || process.env.SENDGRID_API_KEY
    if (!apiKey) {
      logger.warn(
        "[withdrawal] No email key is set: the declaration is saved but no email was sent"
      )
      return new StepResponse(null)
    }

    const resend = new Resend(apiKey)
    const from =
      process.env.RESEND_FROM || process.env.SENDGRID_FROM || "onboarding@resend.dev"
    const shop = process.env.CONTACT_EMAIL || "info@infinytree.com"

    const send = async (
      label: string,
      message: { to: string; replyTo?: string; subject: string; text: string }
    ) => {
      try {
        const { error } = await resend.emails.send({ from, ...message })
        if (error) {
          logger.warn(`[withdrawal] ${label} was refused: ${error.message}`)
          return false
        }
        return true
      } catch (err) {
        logger.warn(
          `[withdrawal] ${label} failed: ${err instanceof Error ? err.message : String(err)}`
        )
        return false
      }
    }

    const confirmationSent = await send("Confirmation email", {
      to: request.email,
      replyTo: shop,
      ...withdrawalConfirmationEmail(request),
    })
    await send("Shop alert", {
      to: shop,
      replyTo: request.email,
      ...withdrawalAlertEmail(request, { confirmationSent }),
    })

    return new StepResponse(null)
  }
)
