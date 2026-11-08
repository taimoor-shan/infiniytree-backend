/**
 * TotalsCard — order total summary.
 *
 * Right-aligned card with Bodoni Moda headings and a subtle soft background.
 */

import React from "react"
import { View, Text } from "./react-pdf"
import { s } from "./styles"
import type { TotalsCardProps } from "./types"

function Row({
  label,
  value,
  strong = false,
  valueStyle,
}: {
  label: string
  value: string
  strong?: boolean
  valueStyle?: Record<string, unknown>
}) {
  return (
    <View style={s.summaryRow}>
      <Text style={[s.summaryLabel, strong && s.summaryLabelStrong]}>
        {label}
      </Text>
      <Text style={[s.summaryValue, strong && s.summaryValueStrong, valueStyle]}>
        {value}
      </Text>
    </View>
  )
}

export function TotalsCard({
  subtotalLabel,
  subtotal,
  shippingLabel,
  shipping,
  discountLabel,
  discount,
  vatLabel,
  vat,
  totalLabel,
  total,
  vatNote,
}: TotalsCardProps) {
  return (
    <View style={s.summaryWrapper}>
      <View style={s.summaryCard}>
        {/* <Text style={s.summaryHeading}>Order Total</Text> */}

        <Row label={subtotalLabel} value={subtotal} />

        {shipping ? <Row label={shippingLabel} value={shipping} /> : null}

        {discount ? <Row label={discountLabel} value={`-${discount}`} /> : null}

        <Row label={vatLabel} value={vat} />

        <View style={s.summaryDivider} />

        <Row label={totalLabel} value={total} strong valueStyle={s.total} />

        <Text style={s.vatNote}>{vatNote}</Text>
      </View>
    </View>
  )
}
