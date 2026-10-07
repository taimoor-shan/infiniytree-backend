import React from "react"
import { createTranslator, resolveLocale } from "../i18n"

/**
 * Pieces shared by the sales-team emails (invite, welcome, decision), so each
 * template only holds its own words. Styles match the other Infinytree emails.
 */

export function Heading({ children }: { children: React.ReactNode }) {
  return (
    <h2 style={{ fontSize: "22px", color: "#2d4a3e", margin: "0 0 8px", fontWeight: 400 }}>
      {children}
    </h2>
  )
}

export function Paragraph({ children }: { children: React.ReactNode }) {
  return (
    <p style={{ fontSize: "15px", color: "#555", margin: "0 0 16px", lineHeight: "1.6" }}>
      {children}
    </p>
  )
}

export function Muted({ children }: { children: React.ReactNode }) {
  return (
    <p style={{ fontSize: "13px", color: "#888", margin: "0 0 8px", lineHeight: "1.5" }}>
      {children}
    </p>
  )
}

export function CtaButton({ href, children }: { href: string; children: React.ReactNode }) {
  return (
    <table cellPadding="0" cellSpacing="0" border={0} width="100%" style={{ margin: "8px 0 24px" }}>
      <tr>
        <td align="center">
          <a
            href={href}
            style={{
              display: "inline-block",
              padding: "14px 36px",
              backgroundColor: "#2d4a3e",
              color: "#ffffff",
              fontSize: "15px",
              textDecoration: "none",
              borderRadius: "4px",
              fontWeight: 500,
            }}
          >
            {children}
          </a>
        </td>
      </tr>
    </table>
  )
}

/** The link as plain text, for mail clients that don't show the button. */
export function PastedLink({ href, locale }: { href: string; locale?: string }) {
  const t = createTranslator(locale)

  return (
    <>
      <p style={{ fontSize: "14px", color: "#555", margin: "0 0 8px", lineHeight: "1.6" }}>
        {t("email.rep.orPaste")}
      </p>
      <p
        style={{
          fontSize: "13px",
          color: "#2d4a3e",
          margin: "0 0 24px",
          lineHeight: "1.6",
          wordBreak: "break-all",
        }}
      >
        {href}
      </p>
    </>
  )
}

export function Questions({ locale }: { locale?: string }) {
  const t = createTranslator(locale)

  return (
    <p style={{ fontSize: "13px", color: "#888", margin: 0, lineHeight: "1.5" }}>
      {t("email.common.questionsReachOut")}{" "}
      <a href="mailto:info@infinytree.com" style={{ color: "#2d4a3e" }}>
        info@infinytree.com
      </a>
      .
    </p>
  )
}

/** "Hello Anna," in the reader's language; without a name just a hello. */
export const greeting = (locale: string | undefined, name?: string | null): string => {
  const t = createTranslator(locale)

  return name?.trim()
    ? t("email.rep.greeting", { name: name.trim() })
    : t("email.rep.greetingNoName")
}

/**
 * A date in the language the email is written in (the dictionary's own
 * language when the reader's isn't offered), as a day in the shop's time zone.
 */
export const formatDay = (iso: string, locale?: string): string => {
  try {
    return new Intl.DateTimeFormat(resolveLocale(locale), {
      day: "numeric",
      month: "long",
      year: "numeric",
      timeZone: "Europe/Budapest",
    }).format(new Date(iso))
  } catch {
    return new Date(iso).toISOString().slice(0, 10)
  }
}
