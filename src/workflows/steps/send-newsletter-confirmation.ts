import { createStep, StepResponse } from "@medusajs/framework/workflows-sdk"
import { ContainerRegistrationKeys } from "@medusajs/framework/utils"
import { Resend } from "resend"
import type { SubscribeNewsletterStepOutput } from "./subscribe-newsletter"
import { newsletterConfirmationEmail, newsletterLink } from "../../utils/newsletter"
import { storefrontUrl } from "../../utils/storefront-url"

/** Emails the double opt-in link. A failed send is logged; the visitor can sign up again. */
export const sendNewsletterConfirmationStep = createStep(
  "send-newsletter-confirmation",
  async (input: SubscribeNewsletterStepOutput, { container }) => {
    if (!input.confirm_token) {
      return new StepResponse(null)
    }
    const logger = container.resolve(ContainerRegistrationKeys.LOGGER)
    const apiKey = process.env.RESEND_API_KEY || process.env.SENDGRID_API_KEY
    if (!apiKey) {
      logger.warn("[newsletter] No email key is set: the confirmation email was not sent")
      return new StepResponse(null)
    }

    const { subject, text } = newsletterConfirmationEmail({
      locale: input.locale,
      confirmUrl: newsletterLink(storefrontUrl(), "confirm", input.confirm_token),
    })
    try {
      const { error } = await new Resend(apiKey).emails.send({
        from: process.env.RESEND_FROM || process.env.SENDGRID_FROM || "onboarding@resend.dev",
        to: input.email,
        subject,
        text,
      })
      if (error) {
        logger.warn(`[newsletter] Confirmation email was refused: ${error.message}`)
      }
    } catch (err) {
      logger.warn(
        `[newsletter] Confirmation email failed: ${err instanceof Error ? err.message : String(err)}`
      )
    }
    return new StepResponse(null)
  }
)
