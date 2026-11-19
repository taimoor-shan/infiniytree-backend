import { createHash, randomBytes } from "crypto"

/**
 * Double opt-in for the newsletter: the token in the confirmation and
 * unsubscribe links, the sentence a visitor agrees to, and the confirmation
 * email in the visitor's language. Plain text emails, so nothing typed by a
 * visitor is ever rendered as markup.
 */

export const newToken = (): { raw: string; hash: string } => {
  const raw = randomBytes(24).toString("base64url")
  return { raw, hash: hashNewsletterToken(raw) }
}

export const hashNewsletterToken = (raw: string): string =>
  createHash("sha256").update(raw).digest("hex")

export const normalizeEmail = (email: string): string => email.trim().toLowerCase()

type Language = "en" | "de" | "hu"

const languageOf = (locale: string | null | undefined): Language => {
  const language = (locale || "en").toLowerCase().split("-")[0]
  return language === "de" || language === "hu" ? language : "en"
}

/** The consent sentence the form shows, kept with each sign-up as proof. */
export const CONSENT_TEXT: Record<Language, string> = {
  en: "I would like to receive the InfinYtree newsletter by email. I can unsubscribe at any time with the link in every email. Details are in the privacy policy.",
  de: "Ich möchte den InfinYtree-Newsletter per E-Mail erhalten. Ich kann mich jederzeit über den Link in jeder E-Mail abmelden. Details stehen in der Datenschutzerklärung.",
  hu: "Szeretném e-mailben megkapni az InfinYtree hírlevelét. Bármikor leiratkozhatok az e-mailekben található linkkel. A részletek az adatvédelmi tájékoztatóban olvashatók.",
}

export const consentTextFor = (locale: string | null | undefined): string =>
  CONSENT_TEXT[languageOf(locale)]

export const newsletterLink = (
  storefront: string,
  action: "confirm" | "unsubscribe",
  token: string
): string =>
  `${storefront.replace(/\/+$/, "")}/newsletter/${action}?token=${encodeURIComponent(token)}`

export const newsletterConfirmationEmail = ({
  locale,
  confirmUrl,
}: {
  locale: string | null | undefined
  confirmUrl: string
}): { subject: string; text: string } => {
  switch (languageOf(locale)) {
    case "de":
      return {
        subject: "Bitte bestätigen Sie Ihre Newsletter-Anmeldung",
        text: [
          "Guten Tag,",
          "",
          "vielen Dank für Ihr Interesse am InfinYtree-Newsletter. Bitte bestätigen Sie Ihre Anmeldung mit diesem Link:",
          "",
          confirmUrl,
          "",
          "Ohne Ihre Bestätigung senden wir Ihnen keinen Newsletter. Falls Sie sich nicht angemeldet haben, ignorieren Sie diese E-Mail einfach.",
          "",
          "Mit freundlichen Grüßen",
          "InfinYtree (Deltalivings Kft.)",
        ].join("\n"),
      }
    case "hu":
      return {
        subject: "Kérjük, erősítse meg hírlevél-feliratkozását",
        text: [
          "Kedves Érdeklődő!",
          "",
          "Köszönjük, hogy feliratkozott az InfinYtree hírlevelére. Kérjük, erősítse meg a feliratkozást ezzel a linkkel:",
          "",
          confirmUrl,
          "",
          "Megerősítés nélkül nem küldünk hírlevelet. Ha nem Ön iratkozott fel, hagyja figyelmen kívül ezt az e-mailt.",
          "",
          "Üdvözlettel:",
          "InfinYtree (Deltalivings Kft.)",
        ].join("\n"),
      }
    default:
      return {
        subject: "Please confirm your newsletter subscription",
        text: [
          "Hello,",
          "",
          "thank you for signing up to the InfinYtree newsletter. Please confirm your subscription with this link:",
          "",
          confirmUrl,
          "",
          "We send nothing until you confirm. If you did not sign up, simply ignore this email.",
          "",
          "Kind regards,",
          "InfinYtree (Deltalivings Kft.)",
        ].join("\n"),
      }
  }
}
