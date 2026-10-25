import React from "react"
import { createTranslator } from "../i18n"

/** The column's width. At or below it the column fills the screen: a phone. */
const COLUMN_WIDTH = 600

/**
 * On a phone no side padding may be wider than 1rem. The layout is inline
 * styles, which only an `!important` rule can beat, and mail clients don't
 * reliably resolve rem, so 1rem is 16px. Clients that read a `<style>` (Gmail,
 * Apple Mail, Outlook for iOS and Android, Yahoo) apply the rule; the few that
 * drop it keep the roomier desktop padding.
 *
 * Every element whose inline padding is wider than 1rem on a side carries
 * `em-px` (both sides) or `em-pr` (right only); mobile-padding.unit.spec.ts
 * holds every template to that.
 */
const PHONE_CSS = `@media only screen and (max-width: ${COLUMN_WIDTH}px) {
  .em-px { padding-left: 16px !important; padding-right: 16px !important; }
  .em-pr { padding-right: 16px !important; }
}`

/**
 * Shared email layout for all InfinYtree transactional emails.
 * Handles doctype, responsive wrapper, branding, and footer.
 */
export interface EmailLayoutProps {
  children: React.ReactNode
  preview?: string
  locale?: string
}

export function EmailLayout({ children, preview, locale }: EmailLayoutProps) {
  const t = createTranslator(locale)

  return (
    <html>
      <head>
        <meta charSet="utf-8" />
        <meta name="viewport" content="width=device-width, initial-scale=1.0" />
        {preview && (
          <meta name="description" content={preview} />
        )}
        <title>InfinYtree</title>
        {/* Raw, because React would HTML-escape the text of a <style> */}
        <style dangerouslySetInnerHTML={{ __html: PHONE_CSS }} />
      </head>
      <body
        style={{
          margin: 0,
          padding: 0,
          backgroundColor: "#f7f7f5",
          fontFamily:
            "'Helvetica Neue', Helvetica, Arial, sans-serif",
        }}
      >
        <table
          cellPadding="0"
          cellSpacing="0"
          border={0}
          width="100%"
          style={{
            maxWidth: `${COLUMN_WIDTH}px`,
            margin: "0 auto",
            backgroundColor: "#ffffff",
          }}
        >
          {/* Preview text (hidden) */}
          {preview && (
            <tr>
              <td style={{ display: "none", maxHeight: 0, overflow: "hidden" }}>
                {preview}
              </td>
            </tr>
          )}

          {/* Header */}
          <tr>
            <td
              className="em-px"
              style={{
                padding: "32px 40px 16px",
                textAlign: "center",
              }}
            >
              <h1
                style={{
                  fontSize: "28px",
                  fontWeight: 400,
                  color: "#2d4a3e",
                  margin: 0,
                  fontFamily: "'Georgia', 'Times New Roman', serif",
                  letterSpacing: "-0.5px",
                }}
              >
                INFINYTREE
              </h1>
            </td>
          </tr>

          {/* Divider */}
          <tr>
            <td className="em-px" style={{ padding: "0 40px" }}>
              <table cellPadding="0" cellSpacing="0" border={0} width="100%">
                <tr>
                  <td
                    style={{
                      borderBottom: "1px solid #e8e8e4",
                      paddingBottom: "16px",
                    }}
                  ></td>
                </tr>
              </table>
            </td>
          </tr>

          {/* Content */}
          <tr>
            <td className="em-px" style={{ padding: "24px 40px 32px" }}>
              {children}
            </td>
          </tr>

          {/* Footer divider */}
          <tr>
            <td className="em-px" style={{ padding: "0 40px" }}>
              <table cellPadding="0" cellSpacing="0" border={0} width="100%">
                <tr>
                  <td
                    style={{
                      borderBottom: "1px solid #e8e8e4",
                      paddingBottom: "16px",
                    }}
                  ></td>
                </tr>
              </table>
            </td>
          </tr>

          {/* Footer */}
          <tr>
            <td
              className="em-px"
              style={{
                padding: "24px 40px 32px",
                textAlign: "center",
              }}
            >
              <p
                style={{
                  fontSize: "13px",
                  color: "#888",
                  margin: "0 0 8px",
                  lineHeight: "1.5",
                }}
              >
                {t("email.layout.tagline")}
              </p>
              <p
                style={{
                  fontSize: "12px",
                  color: "#aaa",
                  margin: 0,
                  lineHeight: "1.5",
                }}
              >
                {t("email.layout.footerNote")}
              </p>
            </td>
          </tr>
        </table>
      </body>
    </html>
  )
}
