import React from "react"

/**
 * Shared email layout for all Infinytree transactional emails.
 * Handles doctype, responsive wrapper, branding, and footer.
 */
export interface EmailLayoutProps {
  children: React.ReactNode
  preview?: string
}

export function EmailLayout({ children, preview }: EmailLayoutProps) {
  return (
    <html>
      <head>
        <meta charSet="utf-8" />
        <meta name="viewport" content="width=device-width, initial-scale=1.0" />
        {preview && (
          <meta name="description" content={preview} />
        )}
        <title>Infinytree</title>
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
            maxWidth: "600px",
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
            <td style={{ padding: "0 40px" }}>
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
            <td style={{ padding: "24px 40px 32px" }}>
              {children}
            </td>
          </tr>

          {/* Footer divider */}
          <tr>
            <td style={{ padding: "0 40px" }}>
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
                Infinytree — Artificial Handmade Plants That Last Forever
              </p>
              <p
                style={{
                  fontSize: "12px",
                  color: "#aaa",
                  margin: 0,
                  lineHeight: "1.5",
                }}
              >
                You are receiving this email because it relates to your
                interaction with Infinytree.
              </p>
            </td>
          </tr>
        </table>
      </body>
    </html>
  )
}
