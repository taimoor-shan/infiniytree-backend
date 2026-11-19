/**
 * The emails of the online withdrawal function: the receipt the consumer gets
 * (the law asks for one "on a durable medium", stating what was declared and
 * when it was received) and the alert the shop gets. Plain text, so nothing
 * the customer typed can be rendered as markup.
 */

export type WithdrawalEmailInput = {
  id: string
  name: string
  email: string
  order_number: string
  order_display_id: number | null
  items: string | null
  message: string | null
  locale: string | null
  created_at: Date | string
}

type Language = "en" | "de" | "hu"

export const withdrawalLanguage = (locale: string | null | undefined): Language => {
  const language = (locale || "en").toLowerCase().split("-")[0]
  return language === "de" || language === "hu" ? language : "en"
}

/** The moment of receipt, in Budapest time (the seller's), in the reader's language. */
export const formatReceivedAt = (at: Date | string, language: Language): string => {
  const date = typeof at === "string" ? new Date(at) : at
  const locale = language === "de" ? "de-DE" : language === "hu" ? "hu-HU" : "en-GB"
  return (
    new Intl.DateTimeFormat(locale, {
      timeZone: "Europe/Budapest",
      dateStyle: "long",
      timeStyle: "medium",
    }).format(date) + " (CET/CEST)"
  )
}

const WORDS: Record<
  Language,
  {
    subject: (order: string) => string
    greeting: (name: string) => string
    intro: string
    received: string
    order: string
    items: string
    wholeOrder: string
    message: string
    reference: string
    next: string
    signoff: string
  }
> = {
  en: {
    subject: (order) => `Your withdrawal from order ${order} has been received`,
    greeting: (name) => `Dear ${name},`,
    intro:
      "we confirm that we have received your declaration of withdrawal from the contract. This email is your confirmation of receipt.",
    received: "Received on",
    order: "Order number",
    items: "Withdrawal covers",
    wholeOrder: "the whole order",
    message: "Your message",
    reference: "Reference",
    next:
      "We will contact you shortly about returning the goods and your refund. If you did not send this declaration, please reply to this email.",
    signoff: "Kind regards,\nInfinYtree (Deltalivings Kft.)",
  },
  de: {
    subject: (order) => `Ihr Widerruf zur Bestellung ${order} ist eingegangen`,
    greeting: (name) => `Guten Tag ${name},`,
    intro:
      "wir bestätigen den Eingang Ihrer Widerrufserklärung. Diese E-Mail ist Ihre Eingangsbestätigung.",
    received: "Eingegangen am",
    order: "Bestellnummer",
    items: "Der Widerruf betrifft",
    wholeOrder: "die gesamte Bestellung",
    message: "Ihre Nachricht",
    reference: "Vorgangsnummer",
    next:
      "Wir melden uns in Kürze zur Rücksendung der Ware und zur Erstattung. Falls Sie diese Erklärung nicht abgegeben haben, antworten Sie bitte auf diese E-Mail.",
    signoff: "Mit freundlichen Grüßen\nInfinYtree (Deltalivings Kft.)",
  },
  hu: {
    subject: (order) => `Megkaptuk elállási nyilatkozatát (rendelés: ${order})`,
    greeting: (name) => `Kedves ${name}!`,
    intro:
      "Visszaigazoljuk, hogy megkaptuk a szerződéstől való elállásra vonatkozó nyilatkozatát. Ez az e-mail az átvétel visszaigazolása.",
    received: "Beérkezett",
    order: "Rendelésszám",
    items: "Az elállás vonatkozik",
    wholeOrder: "a teljes rendelésre",
    message: "Üzenete",
    reference: "Ügyszám",
    next:
      "Hamarosan felvesszük Önnel a kapcsolatot a termékek visszaküldése és a visszatérítés ügyében. Ha nem Ön küldte ezt a nyilatkozatot, kérjük, válaszoljon erre az e-mailre.",
    signoff: "Üdvözlettel:\nInfinYtree (Deltalivings Kft.)",
  },
}

/** The receipt the consumer gets, in the language they used. */
export const withdrawalConfirmationEmail = (
  request: WithdrawalEmailInput
): { subject: string; text: string } => {
  const language = withdrawalLanguage(request.locale)
  const w = WORDS[language]
  const lines = [
    w.greeting(request.name),
    "",
    w.intro,
    "",
    `${w.received}: ${formatReceivedAt(request.created_at, language)}`,
    `${w.order}: ${request.order_number}`,
    `${w.items}: ${request.items?.trim() || w.wholeOrder}`,
  ]
  if (request.message?.trim()) {
    lines.push(`${w.message}: ${request.message.trim()}`)
  }
  lines.push(`${w.reference}: ${request.id}`, "", w.next, "", w.signoff)
  return { subject: w.subject(request.order_number), text: lines.join("\n") }
}

/** The shop's alert, always in English like its other alerts. */
export const withdrawalAlertEmail = (
  request: WithdrawalEmailInput,
  { confirmationSent = true }: { confirmationSent?: boolean } = {}
): { subject: string; text: string } => {
  const matched = request.order_display_id !== null
  const lines = [
    "A customer has withdrawn from a contract through the website's withdrawal function.",
    "",
    `Received: ${formatReceivedAt(request.created_at, "en")}`,
    `Name: ${request.name}`,
    `Email: ${request.email}`,
    `Order number given: ${request.order_number}${
      matched ? "" : " (no order with this number and email was found: check by hand)"
    }`,
    `Withdrawal covers: ${request.items?.trim() || "the whole order"}`,
    `Message: ${request.message?.trim() || "-"}`,
    `Language: ${request.locale || "en"}`,
    `Reference: ${request.id}`,
    "",
    confirmationSent
      ? "The customer has been sent a confirmation of receipt. Admin: Withdrawals."
      : "The confirmation of receipt to the customer could NOT be sent: send it by hand (the law requires one). Admin: Withdrawals.",
  ]
  return {
    subject: `Withdrawal from order ${request.order_number}${matched ? "" : " (not matched)"}`,
    text: lines.join("\n"),
  }
}
