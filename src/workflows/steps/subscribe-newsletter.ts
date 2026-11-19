import { createStep, StepResponse } from "@medusajs/framework/workflows-sdk"
import { NEWSLETTER_MODULE } from "../../modules/newsletter"
import NewsletterModuleService from "../../modules/newsletter/service"
import { consentTextFor, newToken, normalizeEmail } from "../../utils/newsletter"

export type SubscribeNewsletterStepInput = { email: string; locale?: string }

export type SubscribeNewsletterStepOutput = {
  email: string
  locale: string | null
  /** The raw confirmation token to email, or null when nothing is to be sent. */
  confirm_token: string | null
}

type Previous =
  | { created: string }
  | { restore: Record<string, unknown> & { id: string } }
  | null

/**
 * Records a sign-up as pending with a fresh confirmation token. An address
 * that is already confirmed is left alone and gets no email, so the form says
 * the same thing for every address and reveals nothing about who subscribed.
 */
export const subscribeNewsletterStep = createStep(
  "subscribe-newsletter",
  async (input: SubscribeNewsletterStepInput, { container }) => {
    const service: NewsletterModuleService = container.resolve(NEWSLETTER_MODULE)
    const email = normalizeEmail(input.email)
    const locale = input.locale || null

    const [existing] = await service.listNewsletterSubscribers({ email }, { take: 1 })
    if (existing?.status === "confirmed") {
      return new StepResponse<SubscribeNewsletterStepOutput, Previous>(
        { email, locale, confirm_token: null },
        null
      )
    }

    const confirm = newToken()
    const fields = {
      email,
      locale,
      status: "pending" as const,
      confirm_token_hash: confirm.hash,
      consent_text: consentTextFor(locale),
      unsubscribed_at: null,
    }

    if (existing) {
      await service.updateNewsletterSubscribers({ id: existing.id, ...fields })
      return new StepResponse<SubscribeNewsletterStepOutput, Previous>(
        { email, locale, confirm_token: confirm.raw },
        {
          restore: {
            id: existing.id,
            locale: existing.locale,
            status: existing.status,
            confirm_token_hash: existing.confirm_token_hash,
            consent_text: existing.consent_text,
            unsubscribed_at: existing.unsubscribed_at,
          },
        }
      )
    }

    const created = await service.createNewsletterSubscribers({
      ...fields,
      unsubscribe_token: newToken().raw,
    })
    return new StepResponse<SubscribeNewsletterStepOutput, Previous>(
      { email, locale, confirm_token: confirm.raw },
      { created: created.id }
    )
  },
  async (previous, { container }) => {
    if (!previous) {
      return
    }
    const service: NewsletterModuleService = container.resolve(NEWSLETTER_MODULE)
    if ("created" in previous) {
      await service.deleteNewsletterSubscribers(previous.created)
    } else {
      await service.updateNewsletterSubscribers(previous.restore as any)
    }
  }
)
