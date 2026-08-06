/**
 * BillingDetails — "Bill To" customer information.
 *
 * Clean layout — no box, just text with a subtle bottom border.
 */

import React from "react"
import { View, Text } from "./react-pdf"
import { s } from "./styles"
import type { BillingDetailsProps } from "./types"

export function BillingDetails({
  company,
  firstName,
  lastName,
  address1,
  address2,
  city,
  postalCode,
  country,
  vat,
}: BillingDetailsProps) {
  const hasName = firstName || lastName
  const hasAddress = address1 || city || country

  if (!hasName && !hasAddress && !company && !vat) {
    return null
  }

  return (
    <View>
      <Text style={s.sectionHeading}>Bill To</Text>

      <View style={s.billToWrapper}>
        <View style={s.customerCard}>
          {company ? (
            <Text style={s.customerCompany}>{company}</Text>
          ) : null}

          {hasName ? (
            <Text style={s.customerName}>
              {firstName} {lastName}
            </Text>
          ) : null}

          {address1 ? <Text style={s.body}>{address1}</Text> : null}
          {address2 ? <Text style={s.body}>{address2}</Text> : null}

          {(postalCode || city) ? (
            <Text style={s.body}>
              {postalCode} {city}
            </Text>
          ) : null}

          {country ? <Text style={s.body}>{country}</Text> : null}

          {vat ? (
            <View style={s.vatRow}>
              <Text style={s.small}>VAT Number</Text>
              <Text style={s.vatValue}>{vat}</Text>
            </View>
          ) : null}
        </View>
      </View>
    </View>
  )
}
