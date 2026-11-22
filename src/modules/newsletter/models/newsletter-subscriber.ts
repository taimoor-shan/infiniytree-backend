import { model } from "@medusajs/framework/utils"

/**
 * A newsletter sign-up from the storefront's footer, with double opt-in: it is
 * `pending` until the visitor clicks the link in the confirmation email, and
 * only `confirmed` addresses may be written to. The confirmation link carries a
 * random token of which only the hash is kept. `unsubscribe_token` is the one
 * for the "unsubscribe" link every newsletter must carry
 * (`/newsletter/unsubscribe?token=`), kept as it is so the tool that sends the
 * newsletter can build that link.
 *
 * `consent_text` is the sentence the visitor agreed to, kept as proof of
 * consent with the time of sign-up (`created_at`) and of confirmation.
 */
const NewsletterSubscriber = model
  .define("newsletter_subscriber", {
    id: model.id({ prefix: "nlsub" }).primaryKey(),
    email: model.text(),
    status: model.enum(["pending", "confirmed", "unsubscribed"]).default("pending"),
    locale: model.text().nullable(),
    confirm_token_hash: model.text().nullable(),
    unsubscribe_token: model.text().nullable(),
    confirmed_at: model.dateTime().nullable(),
    unsubscribed_at: model.dateTime().nullable(),
    consent_text: model.text().nullable(),
  })
  .indexes([{ on: ["email"], unique: true, where: "deleted_at IS NULL" }])

export default NewsletterSubscriber
