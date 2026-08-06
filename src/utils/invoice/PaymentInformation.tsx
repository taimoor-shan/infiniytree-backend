/**
 * PaymentInformation — bank transfer details.
 *
 * Clean card with hairline row separators.
 */

import React from "react"
import { View, Text } from "./react-pdf"
import { s } from "./styles"
import type { PaymentInformationProps } from "./types"

function PaymentRow({
  label,
  value,
}: {
  label: string
  value: string
}) {
  return (
    <View style={s.paymentRow}>
      <Text style={s.paymentLabel}>{label}</Text>
      <Text style={s.paymentValue}>{value}</Text>
    </View>
  )
}

export function PaymentInformation({
  bank,
  iban,
  bic,
  beneficiary,
  reference,
}: PaymentInformationProps) {
  return (
    <View style={s.paymentSection}>
      <Text style={s.sectionHeading}>Payment Information</Text>

      <View style={s.paymentCard}>
        <PaymentRow label="Beneficiary" value={beneficiary} />
        <PaymentRow label="Bank" value={bank} />
        <PaymentRow label="IBAN" value={iban} />
        <PaymentRow label="BIC / SWIFT" value={bic} />
        <PaymentRow label="Reference" value={reference} />
      </View>
    </View>
  )
}
