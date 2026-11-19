import { createStep, StepResponse } from "@medusajs/framework/workflows-sdk"
import { NEWSLETTER_MODULE } from "../../modules/newsletter"
import NewsletterModuleService from "../../modules/newsletter/service"
import { hashNewsletterToken } from "../../utils/newsletter"

export type SetNewsletterStatusStepInput = {
  action: "confirm" | "unsubscribe"
  token: string
}

/**
 * Confirms a sign-up from the link in the confirmation email, or takes an
 * address off from the link in a newsletter. Answers whether a sign-up was
 * found; a used confirmation link finds nothing, an unsubscribe link keeps
 * working.
 */
export const setNewsletterStatusStep = createStep(
  "set-newsletter-status",
  async (input: SetNewsletterStatusStepInput, { container }) => {
    const service: NewsletterModuleService = container.resolve(NEWSLETTER_MODULE)
    const filter =
      input.action === "confirm"
        ? { confirm_token_hash: hashNewsletterToken(input.token) }
        : { unsubscribe_token: input.token }
    const [found] = await service.listNewsletterSubscribers(filter, { take: 1 })
    if (!found) {
      return new StepResponse({ found: false }, null)
    }

    const previous = {
      id: found.id,
      status: found.status,
      confirm_token_hash: found.confirm_token_hash,
      confirmed_at: found.confirmed_at,
      unsubscribed_at: found.unsubscribed_at,
    }
    await service.updateNewsletterSubscribers(
      input.action === "confirm"
        ? {
            id: found.id,
            status: "confirmed",
            confirm_token_hash: null,
            confirmed_at: new Date(),
            unsubscribed_at: null,
          }
        : { id: found.id, status: "unsubscribed", unsubscribed_at: new Date() }
    )
    return new StepResponse({ found: true }, previous)
  },
  async (previous, { container }) => {
    if (!previous) {
      return
    }
    const service: NewsletterModuleService = container.resolve(NEWSLETTER_MODULE)
    await service.updateNewsletterSubscribers(previous as any)
  }
)
