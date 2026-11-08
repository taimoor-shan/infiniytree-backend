/**
 * PaymentInformation — bank transfer details.
 *
 * Clean card with hairline row separators.
 */

import React from "react"
import { View, Text } from "./react-pdf"
import { s } from "./styles"
import type { PaymentInformationProps, WithLabels } from "./types"

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
  ibanLabel,
  bic,
  beneficiary,
  reference,
  labels,
}: PaymentInformationProps & WithLabels) {
  return (
    <View style={s.paymentSection}>
      <Text style={s.sectionHeading}>{labels.paymentInformation}</Text>

      <View style={s.paymentCard}>
        <PaymentRow label={labels.beneficiary} value={beneficiary} />
        <PaymentRow label={labels.bank} value={bank} />
        <PaymentRow label={ibanLabel} value={iban} />
        <PaymentRow label={labels.bic} value={bic} />
        <PaymentRow label={labels.reference} value={reference} />
      </View>
    </View>
  )
}
