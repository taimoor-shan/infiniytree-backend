/**
 * Invoice header — logo + company info (left) / INVOICE title + metadata (right).
 *
 * The logo is resolved via fonts.ts (LOGO_DATA_URI) and rendered as a data URI
 * so it works offline and doesn't depend on process.cwd().
 */

import React from "react"
import { View, Text, Image } from "./react-pdf"
import { s } from "./styles"
import { COMPANY } from "./theme"
import { LOGO_DATA_URI } from "./fonts"
import type { HeaderProps } from "./types"

export function Header({
  invoiceNumber,
  orderNumber,
  issueDate,
  dueDate,
}: HeaderProps) {
  return (
    <>
      <View style={s.header}>
        {/* LEFT — Logo + Company */}
        <View style={s.companyColumn}>
          {LOGO_DATA_URI ? (
            <Image src={LOGO_DATA_URI} style={s.logoImage} />
          ) : null}

          {/* <Text style={s.company}>{COMPANY.displayName}</Text> */}
          <Text style={s.companyLegal}>{COMPANY.legalName}</Text>
          {COMPANY.address.map((line, i) => (
            <Text key={i} style={s.body}>
              {line}
            </Text>
      ))}

          <View style={{ height: 10 }} />

          <Text style={s.small}>Tax Number</Text>
          <Text style={s.value}>{COMPANY.taxNumber}</Text>
        </View>

        {/* RIGHT — INVOICE + Metadata */}
        <View style={s.invoiceColumn}>
          <Text style={s.invoiceTitle}>PROFORMA INVOICE</Text>
          <View style={s.goldDivider} />

          <View style={s.metaTable}>
            <MetaRow label="Invoice Number" value={invoiceNumber} />
            <MetaRow label="Order Number" value={orderNumber} />
            <MetaRow label="Issue Date" value={issueDate} />
            <MetaRow label="Due Date" value={dueDate} />
          </View>
        </View>
      </View>

      <View style={s.pageDivider} />
    </>
  )
}

/** Internal — label : value row for the invoice metadata block. */
function MetaRow({ label, value }: { label: string; value: string }) {
  return (
    <View style={s.metaRow}>
      <Text style={s.metaLabel}>{label}</Text>
      <Text style={s.metaValue}>{value}</Text>
    </View>
  )
}
