import { MedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { NEWSLETTER_MODULE } from "../../../modules/newsletter"
import NewsletterModuleService from "../../../modules/newsletter/service"

/** Visitor-typed text: a leading = + - @ would run as a formula in a spreadsheet. */
const csvText = (value: string): string => (/^[=+\-@\t\r]/.test(value) ? `'${value}` : value)

/**
 * Newsletter sign-ups, newest first. `?format=csv` gives the confirmed
 * addresses with their unsubscribe token, to import into a mailing tool.
 */
export async function GET(req: MedusaRequest, res: MedusaResponse) {
  const service: NewsletterModuleService = req.scope.resolve(NEWSLETTER_MODULE)

  if (req.query.format === "csv") {
    const confirmed = await service.listNewsletterSubscribers(
      { status: "confirmed" },
      { order: { confirmed_at: "ASC" } }
    )
    const rows = [
      "email,locale,confirmed_at,unsubscribe_token",
      ...confirmed.map((s) =>
        [
          csvText(s.email),
          csvText(s.locale ?? ""),
          s.confirmed_at ? new Date(s.confirmed_at).toISOString() : "",
          s.unsubscribe_token ?? "",
        ]
          .map((v) => `"${String(v).replace(/"/g, '""')}"`)
          .join(",")
      ),
    ]
    res.setHeader("Content-Type", "text/csv; charset=utf-8")
    res.setHeader("Content-Disposition", 'attachment; filename="newsletter-subscribers.csv"')
    return res.send(rows.join("\n"))
  }

  const [subscribers, count] = await service.listAndCountNewsletterSubscribers(
    {},
    {
      take: 200,
      order: { created_at: "DESC" },
      select: ["id", "email", "status", "locale", "created_at", "confirmed_at", "unsubscribed_at"],
    }
  )
  return res.json({ subscribers, count })
}
