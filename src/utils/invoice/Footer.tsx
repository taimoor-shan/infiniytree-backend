/**
 * Footer — thank-you message, contact links, company info, payment terms.
 *
 * Uses natural flow layout (marginTop) — no absolute positioning — so it
 * works correctly on multi-page invoices without overlapping content.
 */

import React from "react"
import { View, Text } from "./react-pdf"
import { s } from "./styles"
import { COMPANY } from "./theme"

export function Footer() {
  return (
    <View style={s.footer}>
      <View style={s.footerDivider} />

      <Text style={s.footerHeading}>
        Thank you for choosing Infinytree.
      </Text>

      {/* <Text style={s.footerText}>{COMPANY.tagline}</Text> */}
      <Text style={s.footerText}>Payment is due within 14 days unless otherwise agreed.</Text>

      <View style={s.footerLinks}>
        <Text style={s.footerLink}>{COMPANY.site}</Text>
        <Text style={s.footerDot}>•</Text>
        <Text style={s.footerLink}>{COMPANY.email}</Text>
      </View>

      {/* <Text style={s.footerCompany}>
        {COMPANY.legalName} · {COMPANY.address.join(" · ")}
      </Text> */}

      {/* <Text style={s.footerSmall}>
        Payment is due within 14 days unless otherwise agreed.
      </Text> */}
    </View>
  )
}
