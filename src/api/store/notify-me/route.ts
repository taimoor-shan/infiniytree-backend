import { MedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { Resend } from "resend"
import { z } from "zod"

const resend = new Resend(process.env.RESEND_API_KEY || process.env.SENDGRID_API_KEY)

export const NotifyMeSchema = z.object({
  email: z.email({ error: "Invalid email address" }),
  productId: z.string().min(1),
  variantId: z.string().min(1),
  productTitle: z.string().optional(),
  variantTitle: z.string().optional(),
  productUrl: z.string().optional(),
})

const RATE_LIMIT_WINDOW_MS = 60 * 60 * 1000 // 1 hour
const rateLimitMap = new Map<string, number>()

export async function POST(
  req: MedusaRequest<z.infer<typeof NotifyMeSchema>>,
  res: MedusaResponse
) {
  try {
    const { email, productId, variantId, productTitle, variantTitle, productUrl } =
      req.validatedBody

    const lastRequest = rateLimitMap.get(email)
    if (lastRequest && Date.now() - lastRequest < RATE_LIMIT_WINDOW_MS) {
      return res.status(429).json({
        message: "You've already requested a notification. Please check your inbox or try again later.",
      })
    }

    const subject = productTitle
      ? `Restock request: ${productTitle}${variantTitle ? ` — ${variantTitle}` : ""}`
      : `Restock request: ${productId}`

    const text = [
      "Restock Notification Request",
      "============================",
      "",
      `Product: ${productTitle || productId}${variantTitle ? ` — ${variantTitle}` : ""}`,
      `Variant ID: ${variantId}`,
      productUrl ? `URL: ${productUrl}` : "",
      "",
      `Customer: ${email}`,
      `Date: ${new Date().toISOString()}`,
    ]
      .filter((line) => line !== null)
      .join("\n")

    const { data, error } = await resend.emails.send({
      from:
        process.env.RESEND_FROM ||
        process.env.SENDGRID_FROM ||
        "onboarding@resend.dev",
      to: process.env.CONTACT_EMAIL || "info@infinytree.com",
      subject,
      replyTo: email,
      text,
    })

    if (error) {
      return res.status(400).json({ ...error, message: error.message })
    }

    rateLimitMap.set(email, Date.now())

    return res.status(200).json({ success: true, data })
  } catch (error) {
    return res.status(500).json({ message: "Failed to send message" })
  }
}
